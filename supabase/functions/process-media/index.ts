import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN_EXPIRY_BUFFER_MS = 2 * 60 * 1000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SyncFileType = "image" | "video" | "audio" | "document";

function normalizeFolder(path: string | null | undefined): string {
  const cleaned = (path || "/SwiftWapDrive").trim().replace(/\/+/g, "/");
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

function folderNameByType(type: string): string {
  const map: Record<string, string> = {
    image: "Imagens",
    video: "Videos",
    audio: "Audios",
    document: "Documentos",
  };
  return map[type] || "Outros";
}

function buildFolderPath(
  baseFolder: string,
  fileType: SyncFileType,
  receivedAt: string,
  folderStructure: string,
  senderIdentifier: string,
): string {
  const date = new Date(receivedAt || Date.now());
  const yyyy = date.getUTCFullYear().toString();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const typeFolder = folderNameByType(fileType);

  const structures: Record<string, string[]> = {
    sender_date_type: [senderIdentifier, yyyy, `${mm}-${dd}`, typeFolder],
    date_type: [yyyy, `${mm}-${dd}`, senderIdentifier, typeFolder],
    type_date: [typeFolder, yyyy, `${mm}-${dd}`, senderIdentifier],
    type: [senderIdentifier, typeFolder],
    date: [yyyy, `${mm}-${dd}`, senderIdentifier],
  };

  const parts = structures[folderStructure] || structures.sender_date_type;
  const root = normalizeFolder(baseFolder).replace(/\/$/, "");
  return `${root}/${parts.join("/")}`;
}

async function refreshGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[REFRESH ERROR]", err);
    throw new Error("Falha ao renovar token do Google. Reconecte o Google Drive.");
  }

  return res.json();
}

async function downloadTwilioMedia(
  mediaUrl: string,
  accountSid: string,
  authToken: string,
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const credentials = btoa(`${accountSid}:${authToken}`)
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${credentials}` },
  })

  if (!res.ok) throw new Error(`Falha ao baixar mídia: HTTP ${res.status}`)

  const buffer = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  return { buffer, contentType }
}

async function findDriveFolder(
  token: string,
  folderName: string,
  parentId: string,
): Promise<string | null> {
  const escapedName = folderName.replace(/'/g, "\\'");
  const query = `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!listRes.ok) return null;
  const listJson = await listRes.json();
  return listJson?.files?.[0]?.id ?? null;
}

async function ensureDriveFolder(
  token: string,
  folderName: string,
  parentId: string,
): Promise<string> {
  // 1. Busca pasta existente
  const existing = await findDriveFolder(token, folderName, parentId);
  if (existing) return existing;

  // 2. Delay aleatório pequeno para reduzir colisões em processamento paralelo
  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 300) + 100));

  // 3. Busca novamente após delay (outra instância pode ter criado)
  const existingAfterDelay = await findDriveFolder(token, folderName, parentId);
  if (existingAfterDelay) return existingAfterDelay;

  // 4. Tenta criar
  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    },
  );

  const createJson = await createRes.json();

  // 5. Se criação falhou por conflito (outra instância criou antes), busca novamente
  if (!createRes.ok) {
    if (createRes.status === 409 || createRes.status === 403) {
      const retryFind = await findDriveFolder(token, folderName, parentId);
      if (retryFind) return retryFind;
    }
    throw new Error(`Erro ao criar pasta no Google Drive: ${createJson?.error?.message || createRes.status}`);
  }

  if (!createJson?.id) {
    // Ultimo fallback: busca a pasta que pode ter sido criada
    const lastFind = await findDriveFolder(token, folderName, parentId);
    if (lastFind) return lastFind;
    throw new Error("Erro ao criar pasta no Google Drive: ID não retornado");
  }

  return createJson.id as string;
}

async function ensureDrivePath(
  token: string,
  fullPath: string,
  userId: string,
  googleAccountId: string,
): Promise<string> {
  const parts = fullPath
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);

  let parentId = "root";
  let currentPath = "";

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;

    // Verifica cache para este nível
    const cached = await getCachedFolderId(userId, googleAccountId, currentPath);
    if (cached) {
      parentId = cached;
      continue;
    }

    // Não está no cache — cria e salva
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        parentId = await ensureDriveFolder(token, part, parentId);
        lastError = null;
        break;
      } catch (err) {
        lastError = err as Error;
        console.warn(`[DRIVE] Tentativa ${attempt + 1} falhou para "${part}":`, err);
        await new Promise(r => setTimeout(r, (attempt + 1) * 500));
      }
    }
    if (lastError) throw lastError;

    // Salva este nível no cache
    await cacheFolderId(userId, googleAccountId, currentPath, parentId);
  }

  return parentId;
}

async function acquireUserLock(userId: string): Promise<void> {
  // Converte userId (UUID) para um número inteiro para o advisory lock
  const lockKey = Math.abs(
    userId.split('-').join('').slice(0, 8).split('').reduce((acc, c) => {
      return ((acc << 5) - acc + c.charCodeAt(0)) | 0
    }, 0)
  )
  await supabase.rpc('pg_advisory_lock', { lock_key: lockKey })
}

async function releaseUserLock(userId: string): Promise<void> {
  const lockKey = Math.abs(
    userId.split('-').join('').slice(0, 8).split('').reduce((acc, c) => {
      return ((acc << 5) - acc + c.charCodeAt(0)) | 0
    }, 0)
  )
  await supabase.rpc('pg_advisory_unlock', { lock_key: lockKey })
}

// Busca ID de pasta no cache do banco
async function getCachedFolderId(
  userId: string,
  googleAccountId: string,
  folderPath: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('drive_folder_cache')
    .select('folder_id')
    .eq('user_id', userId)
    .eq('google_account_id', googleAccountId)
    .eq('folder_path', folderPath)
    .maybeSingle()
  return data?.folder_id ?? null
}

// Salva ID de pasta no cache do banco
async function cacheFolderId(
  userId: string,
  googleAccountId: string,
  folderPath: string,
  folderId: string,
): Promise<void> {
  await supabase
    .from('drive_folder_cache')
    .upsert({
      user_id: userId,
      google_account_id: googleAccountId,
      folder_path: folderPath,
      folder_id: folderId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,google_account_id,folder_path' })
    .select()
}

async function uploadToGoogleDrive(
  token: string,
  fileName: string,
  fileBuffer: ArrayBuffer,
  mimeType: string,
  folderId?: string,
): Promise<{ fileId: string; webViewLink: string }> {
  const metadata: Record<string, unknown> = { name: fileName };
  if (folderId) metadata.parents = [folderId];

  const boundary = "media_boundary_" + crypto.randomUUID();
  const metadataJson = JSON.stringify(metadata);
  const encoder = new TextEncoder();
  const metaPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataJson}\r\n`,
  );
  const filePart = encoder.encode(
    `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: binary\r\n\r\n`,
  );
  const endPart = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(metaPart.length + filePart.length + fileBuffer.byteLength + endPart.length);
  body.set(metaPart, 0);
  body.set(filePart, metaPart.length);
  body.set(new Uint8Array(fileBuffer), metaPart.length + filePart.length);
  body.set(endPart, metaPart.length + filePart.length + fileBuffer.byteLength);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Erro no upload para Google Drive: ${json.error?.message || res.status}`);
  }

  return { fileId: json.id, webViewLink: json.webViewLink || "" };
}

async function resolveTwilioCredentials(media: Record<string, unknown>): Promise<{
  accountSid: string
  authToken: string
}> {
  const whatsappConnectionId = media.whatsapp_connection_id as string | null

  if (whatsappConnectionId) {
    const { data } = await supabase
      .from('whatsapp_connections')
      .select('twilio_subaccount_sid, twilio_subaccount_auth_token')
      .eq('id', whatsappConnectionId)
      .maybeSingle()

    // Usa credenciais da subaccount do cliente se disponíveis
    if (data?.twilio_subaccount_sid && data?.twilio_subaccount_auth_token) {
      return {
        accountSid: data.twilio_subaccount_sid as string,
        authToken: data.twilio_subaccount_auth_token as string,
      }
    }
  }

  // Fallback: credenciais globais (sandbox/teste)
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  if (accountSid && authToken) return { accountSid, authToken }

  throw new Error('Credenciais Twilio não encontradas.')
}

async function resolveGoogleAccount(media: Record<string, unknown>) {
  const userId = media.user_id as string;
  const whatsappConnectionId = media.whatsapp_connection_id as string | null;
  const fileType = media.file_type as SyncFileType;
  const explicitGoogleAccountId = media.google_drive_account_id as string | null;

  if (explicitGoogleAccountId) {
    const { data } = await supabase
      .from("google_drive_accounts")
      .select("*")
      .eq("id", explicitGoogleAccountId)
      .maybeSingle();
    if (data) return { source: "multi", row: data };
  }

  if (whatsappConnectionId) {
    const { data: typedRule } = await supabase
      .from("media_routing_rules")
      .select("google_drive_account_id")
      .eq("user_id", userId)
      .eq("whatsapp_connection_id", whatsappConnectionId)
      .eq("is_active", true)
      .eq("file_type", fileType)
      .limit(1)
      .maybeSingle();

    const { data: defaultRule } = typedRule
      ? { data: null }
      : await supabase
          .from("media_routing_rules")
          .select("google_drive_account_id")
          .eq("user_id", userId)
          .eq("whatsapp_connection_id", whatsappConnectionId)
          .eq("is_active", true)
          .eq("is_default", true)
          .limit(1)
          .maybeSingle();

    const routedGoogleAccountId =
      (typedRule?.google_drive_account_id as string | null) ||
      (defaultRule?.google_drive_account_id as string | null);

    if (routedGoogleAccountId) {
      const { data } = await supabase
        .from("google_drive_accounts")
        .select("*")
        .eq("id", routedGoogleAccountId)
        .maybeSingle();
      if (data) return { source: "multi", row: data };
    }
  }

  const { data: firstConnected } = await supabase
    .from("google_drive_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "connected")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstConnected) return { source: "multi", row: firstConnected };

  const { data: legacyConn } = await supabase
    .from("connections")
    .select("google_access_token, google_refresh_token, google_token_expires_at, google_root_folder")
    .eq("user_id", userId)
    .maybeSingle();

  if (legacyConn) return { source: "legacy", row: legacyConn };
  throw new Error("Google Drive não conectado. Conecte o Google Drive nas configurações.");
}

async function enforcePlanBeforeProcessing(userId: string) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('monthly_file_limit, files_used_current_month, overage_enabled, current_period_end')
    .eq('user_id', userId)
    .maybeSingle()

  // Sem subscription: permite com limite padrão do Plano Essencial
  if (!sub) return { limit: 200, usedBefore: 0, overageEnabled: true }

  const limit = sub.monthly_file_limit == null ? 200 : Number(sub.monthly_file_limit)
  const overageEnabled = true // Plano Essencial sempre permite excedente (cobrado separado)
  const usedBefore = await supabase
    .from('subscriptions')
    .select('files_used_current_month')
    .eq('user_id', userId)
    .maybeSingle()
    .then(r => Number(r.data?.files_used_current_month ?? 0))

  // No modelo Essencial, nunca bloqueia — apenas registra excedente
  return { limit, usedBefore, overageEnabled: true }
}

async function registerPlanUsage(
  userId: string,
  mediaFileId: string,
  usedBefore: number,
  limit: number | null,
) {
  await supabase
    .from('subscriptions')
    .update({ files_used_current_month: usedBefore + 1 })
    .eq('user_id', userId)

  if (!limit || limit <= 0) return

  const usedAfter = usedBefore + 1

  // Avisos de uso: 80%, 100% (excedente), 150%
  const markers = [
    { ratio: 0.8, label: '80%' },
    { ratio: 1.0, label: '100% — excedente ativado (R$ 0,10/mídia)' },
    { ratio: 1.5, label: '150%' },
  ]

  for (const marker of markers) {
    const checkpoint = Math.ceil(limit * marker.ratio)
    if (usedBefore < checkpoint && usedAfter >= checkpoint) {
      await supabase.from('sync_logs').insert({
        user_id: userId,
        media_file_id: mediaFileId,
        action: 'plan_usage_warning',
        status: 'completed',
        message:
          usedAfter >= limit
            ? `Mídias inclusas esgotadas (${usedAfter}/${limit}) — excedente: R$ 0,25/mídia`
            : `Uso do plano atingiu ${marker.label} (${usedAfter}/${limit})`,
        metadata: { used: usedAfter, limit, ratio: marker.ratio },
        source: 'process-media',
      })
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();
  let mediaFileId: string | null = null;

  try {
    const body = await req.json();
    mediaFileId = body.mediaFileId;
    if (!mediaFileId) throw new Error("mediaFileId é obrigatório");

    const { data: media, error: fetchError } = await supabase
      .from("media_files")
      .select("*")
      .eq("id", mediaFileId)
      .single();

    if (fetchError || !media) throw new Error("Arquivo não encontrado");

    if (media.status === "processing") {
      return new Response(
        JSON.stringify({ success: true, message: "Arquivo já em processamento" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("media_files")
      .update({
        status: "processing",
        error_message: null,
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", mediaFileId);

    const userId = media.user_id as string;
    if (!userId) throw new Error("Arquivo sem usuário associado");

    // Plan limits (files/month)
    const planState = await enforcePlanBeforeProcessing(userId);

    // User settings control which media types are processed
    const { data: settings } = await supabase
      .from("user_settings")
      .select("auto_sync_enabled, sync_images, sync_videos, sync_audio, sync_documents, folder_structure")
      .eq("user_id", userId)
      .maybeSingle();

    if (settings && settings.auto_sync_enabled === false) {
      throw new Error("Sincronização automática está desativada nas configurações.");
    }

    const fileType = (media.file_type || "document") as SyncFileType;
    const typeAllowed =
      (fileType === "image" && (settings?.sync_images ?? true)) ||
      (fileType === "video" && (settings?.sync_videos ?? true)) ||
      (fileType === "audio" && (settings?.sync_audio ?? true)) ||
      (fileType === "document" && (settings?.sync_documents ?? true));

    if (!typeAllowed) {
      throw new Error(`Sincronização de ${fileType} desativada nas configurações.`);
    }

    const { accountSid, authToken } = await resolveTwilioCredentials(media as Record<string, unknown>)
    const { buffer: fileBuffer, contentType } = await downloadTwilioMedia(
      media.whatsapp_media_id,
      accountSid,
      authToken,
    )

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!googleClientId || !googleClientSecret) {
      throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados nos secrets.");
    }

    const googleAccount = await resolveGoogleAccount(media as Record<string, unknown>);
    const accountRow = googleAccount.row as Record<string, unknown>;
    let googleToken = (accountRow.access_token as string | null) || null;
    const refreshToken = (accountRow.refresh_token as string | null) || null;
    const tokenExpiresAt = (accountRow.token_expires_at as string | null) || null;

    if (!googleToken && !refreshToken) {
      throw new Error("Google Drive não conectado. Conecte o Google Drive nas configurações.");
    }

    const shouldRefresh =
      !googleToken ||
      (tokenExpiresAt &&
        new Date(tokenExpiresAt).getTime() - Date.now() < TOKEN_EXPIRY_BUFFER_MS);

    if (shouldRefresh) {
      if (!refreshToken) {
        throw new Error("Refresh token do Google não disponível. Reconecte o Google Drive.");
      }

      const refreshed = await refreshGoogleAccessToken(
        googleClientId,
        googleClientSecret,
        refreshToken,
      );
      googleToken = refreshed.access_token;
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      if (googleAccount.source === "multi") {
        await supabase
          .from("google_drive_accounts")
          .update({ access_token: googleToken, token_expires_at: newExpiresAt })
          .eq("id", accountRow.id as string);
      } else {
        await supabase
          .from("connections")
          .update({
            google_access_token: googleToken,
            google_token_expires_at: newExpiresAt,
          })
          .eq("user_id", userId);
      }
    }

    const folderStructure = (settings?.folder_structure as string | null) || "sender_date_type";
    const baseFolderPath =
      (accountRow.root_folder_path as string | null) ||
      (accountRow.google_root_folder as string | null) ||
      "/SwiftWapDrive";
    const rawSender = (media.sender_name as string | null)?.trim() ||
                      (media.sender_phone as string | null)?.trim() ||
                      'desconhecido'
    const senderIdentifier = rawSender.replace(/[^a-zA-Z0-9\s\+\-\_]/g, '').trim().slice(0, 50)
    const targetPath = buildFolderPath(baseFolderPath, fileType, media.received_at, folderStructure, senderIdentifier);
    
    // Busca ID da pasta no cache antes de criar no Drive
    const googleAccountId = googleAccount.source === "multi" 
      ? (accountRow.id as string) 
      : 'legacy'
    
    // Adquire lock exclusivo por usuário para evitar criação paralela de pastas
    await acquireUserLock(userId)
    let targetFolderId: string
    try {
      // Busca no cache dentro do lock (outro processo pode ter criado enquanto aguardava)
      const cachedAfterLock = await getCachedFolderId(userId, googleAccountId, targetPath)
      if (cachedAfterLock) {
        targetFolderId = cachedAfterLock
      } else {
        targetFolderId = await ensureDrivePath(
          googleToken!,
          targetPath,
          userId,
          googleAccountId,
        )
      }
    } finally {
      // Sempre libera o lock, mesmo em caso de erro
      await releaseUserLock(userId)
    }

    const { fileId: driveFileId, webViewLink } = await uploadToGoogleDrive(
      googleToken!,
      media.file_name,
      fileBuffer,
      media.mime_type || contentType,
      targetFolderId,
    );

    await supabase
      .from("media_files")
      .update({
        status: "completed",
        google_drive_file_id: driveFileId,
        google_drive_url: webViewLink,
        google_drive_folder_id: targetFolderId,
        google_drive_account_id: googleAccount.source === "multi" ? (accountRow.id as string) : null,
        file_size_bytes: fileBuffer.byteLength,
        processed_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", mediaFileId);

    // Atualiza root_folder_id na google_drive_accounts se ainda não estiver salvo
    if (googleAccount.source === "multi" && accountRow.id && !accountRow.root_folder_id) {
      await supabase
        .from("google_drive_accounts")
        .update({ root_folder_id: targetFolderId })
        .eq("id", accountRow.id as string)
        .is("root_folder_id", null)
    }

    await registerPlanUsage(userId, mediaFileId, planState.usedBefore, planState.limit);

    await supabase.from("sync_logs").insert({
      user_id: userId,
      media_file_id: mediaFileId,
      action: "process_media",
      status: "completed",
      message: `Arquivo ${media.file_name} processado e enviado ao Drive`,
      metadata: {
        drive_file_id: driveFileId,
        file_size: fileBuffer.byteLength,
        duration_ms: Date.now() - startTime,
        folder_path: targetPath,
      },
      source: "process-media",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Arquivo processado com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[ERROR]", err);

    if (mediaFileId) {
      const { data: currentMedia } = await supabase
        .from("media_files")
        .select("retry_count, user_id")
        .eq("id", mediaFileId)
        .single();

      const retryCount = (currentMedia?.retry_count || 0) + 1;
      const rawMessage = String(err);
      const policyFailure = /Limite do plano|desativada nas configurações|desativado nas configurações/i.test(
        rawMessage,
      );
      const isPermanentFailure = policyFailure || retryCount >= 3;

      await supabase
        .from("media_files")
        .update({
          status: "failed",
          error_message: rawMessage,
          retry_count: retryCount,
          is_permanent_failure: isPermanentFailure,
        })
        .eq("id", mediaFileId);

      if (currentMedia?.user_id) {
        await supabase.from("sync_logs").insert({
          user_id: currentMedia.user_id,
          media_file_id: mediaFileId,
          action: "process_media",
          status: "failed",
          message: rawMessage,
          metadata: { retry_count: retryCount, is_permanent: isPermanentFailure },
          source: "process-media",
        });
      }
    }

    return new Response(
      JSON.stringify({ success: false, message: String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  } finally {
    console.log(`[END] process-media (${Date.now() - startTime}ms)`);
  }
});

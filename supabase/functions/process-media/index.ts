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
  const cleaned = (path || "/WhatsApp Uploads").trim().replace(/\/+/g, "/");
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
): string {
  const date = new Date(receivedAt || Date.now());
  const yyyy = date.getUTCFullYear().toString();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const typeFolder = folderNameByType(fileType);

  const structures: Record<string, string[]> = {
    date_type: [yyyy, mm, dd, typeFolder],
    type_date: [typeFolder, yyyy, mm, dd],
    type: [typeFolder],
    date: [yyyy, mm, dd],
  };

  const parts = structures[folderStructure] || structures.date_type;
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
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Falha ao baixar mídia do Twilio: HTTP ${res.status} em ${mediaUrl}`)
  }

  const buffer = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  return { buffer, contentType }
}

async function ensureDriveFolder(
  token: string,
  folderName: string,
  parentId: string,
): Promise<string> {
  const escapedName = folderName.replace(/'/g, "\\'");
  const query = `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (listRes.ok) {
    const listJson = await listRes.json();
    if (listJson?.files?.[0]?.id) {
      return listJson.files[0].id;
    }
  }

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
  if (!createRes.ok || !createJson?.id) {
    throw new Error("Erro ao criar pasta no Google Drive");
  }

  return createJson.id as string;
}

async function ensureDrivePath(token: string, fullPath: string): Promise<string> {
  const parts = fullPath
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);

  let parentId = "root";
  for (const part of parts) {
    parentId = await ensureDriveFolder(token, part, parentId);
  }
  return parentId;
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
      .select('twilio_account_sid, twilio_auth_token')
      .eq('id', whatsappConnectionId)
      .maybeSingle()

    if (data?.twilio_account_sid && data?.twilio_auth_token) {
      return {
        accountSid: data.twilio_account_sid as string,
        authToken: data.twilio_auth_token as string,
      }
    }
  }

  // Fallback: credenciais globais dos Secrets
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')

  if (accountSid && authToken) return { accountSid, authToken }

  throw new Error('Credenciais Twilio não encontradas. Reconecte o WhatsApp.')
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
  const now = new Date();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("monthly_file_limit, files_used_current_month, overage_enabled, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (!sub) {
    return { limit: null as number | null, usedBefore: 0, overageEnabled: false };
  }

  let usedBefore = Number(sub.files_used_current_month || 0);
  const limit = sub.monthly_file_limit == null ? null : Number(sub.monthly_file_limit);
  const overageEnabled = Boolean(sub.overage_enabled);

  if (sub.current_period_end && new Date(sub.current_period_end).getTime() < now.getTime()) {
    await supabase
      .from("subscriptions")
      .update({ files_used_current_month: 0 })
      .eq("user_id", userId);
    usedBefore = 0;
  }

  if (limit !== null && usedBefore >= limit && !overageEnabled) {
    throw new Error(`Limite do plano atingido (${usedBefore}/${limit} arquivos no ciclo).`);
  }

  return { limit, usedBefore, overageEnabled };
}

async function registerPlanUsage(userId: string, mediaFileId: string, usedBefore: number, limit: number | null) {
  await supabase
    .from("subscriptions")
    .update({
      files_used_current_month: usedBefore + 1,
    })
    .eq("user_id", userId);

  if (!limit || limit <= 0) return;
  const usedAfter = usedBefore + 1;
  const markers = [
    { ratio: 0.8, label: "80%" },
    { ratio: 0.9, label: "90%" },
    { ratio: 1.0, label: "100%" },
  ];

  for (const marker of markers) {
    const checkpoint = Math.ceil(limit * marker.ratio);
    if (usedBefore < checkpoint && usedAfter >= checkpoint) {
      await supabase.from("sync_logs").insert({
        user_id: userId,
        media_file_id: mediaFileId,
        action: "plan_usage_warning",
        status: "completed",
        message:
          marker.ratio === 1
            ? `Limite mensal atingido (${usedAfter}/${limit})`
            : `Uso do plano atingiu ${marker.label} (${usedAfter}/${limit})`,
        metadata: { used: usedAfter, limit, ratio: marker.ratio },
        source: "process-media",
      });
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
      media.whatsapp_media_id, // agora é a URL direta da mídia Twilio
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

    const folderStructure = (settings?.folder_structure as string | null) || "date_type";
    const baseFolderPath =
      (accountRow.root_folder_path as string | null) ||
      (accountRow.google_root_folder as string | null) ||
      "/WhatsApp Uploads";
    const targetPath = buildFolderPath(baseFolderPath, fileType, media.received_at, folderStructure);
    const targetFolderId = await ensureDrivePath(googleToken!, targetPath);

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
        google_drive_account_id: googleAccount.source === "multi" ? (accountRow.id as string) : null,
        file_size_bytes: fileBuffer.byteLength,
        processed_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", mediaFileId);

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

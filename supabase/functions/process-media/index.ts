// =====================================================
// SwiftwapdriveSync - Process Media (Production Ready)
// Downloads media from WhatsApp Graph API, uploads to Google Drive
// Uses centralized Google credentials from Supabase Secrets
// =====================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_EXPIRY_BUFFER_MS = 2 * 60 * 1000; // 2 min buffer

// =====================================================
// HELPERS
// =====================================================

async function refreshGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
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

/**
 * Download media binary from WhatsApp Graph API.
 * Step 1: GET /{media_id} → returns download URL
 * Step 2: GET download URL → returns binary
 */
async function downloadWhatsAppMedia(
  mediaId: string,
  accessToken: string
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  // Step 1: Get media URL
  const metaRes = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!metaRes.ok) {
    const err = await metaRes.text();
    console.error("[WA MEDIA META ERROR]", err);
    throw new Error(`Falha ao obter URL da mídia do WhatsApp: ${metaRes.status}`);
  }

  const metaData = await metaRes.json();
  const downloadUrl = metaData.url;

  if (!downloadUrl) {
    throw new Error("URL de download da mídia não retornada pela API do WhatsApp");
  }

  // Step 2: Download binary
  const downloadRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!downloadRes.ok) {
    const err = await downloadRes.text();
    console.error("[WA MEDIA DOWNLOAD ERROR]", err);
    throw new Error(`Falha ao baixar mídia do WhatsApp: ${downloadRes.status}`);
  }

  const buffer = await downloadRes.arrayBuffer();
  const contentType = downloadRes.headers.get("content-type") || "application/octet-stream";

  console.log(`[WA DOWNLOAD] OK - ${buffer.byteLength} bytes, type: ${contentType}`);
  return { buffer, contentType };
}

/**
 * Upload file to Google Drive using multipart upload.
 */
async function uploadToGoogleDrive(
  token: string,
  fileName: string,
  fileBuffer: ArrayBuffer,
  mimeType: string,
  folderId?: string
): Promise<{ fileId: string; webViewLink: string }> {
  const metadata: Record<string, unknown> = { name: fileName };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = "media_boundary_" + crypto.randomUUID();
  const metadataJson = JSON.stringify(metadata);

  // Build multipart body manually for better control
  const encoder = new TextEncoder();
  const metaPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataJson}\r\n`
  );
  const filePart = encoder.encode(
    `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: binary\r\n\r\n`
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
      body: body,
    }
  );

  const json = await res.json();
  if (!res.ok) {
    console.error("[UPLOAD ERROR]", json);
    throw new Error(`Erro no upload para Google Drive: ${json.error?.message || res.status}`);
  }

  return { fileId: json.id, webViewLink: json.webViewLink || "" };
}

// =====================================================
// HANDLER
// =====================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();
  let mediaFileId: string | null = null;

  try {
    const body = await req.json();
    mediaFileId = body.mediaFileId;
    if (!mediaFileId) throw new Error("mediaFileId é obrigatório");

    console.log("[START] process-media", mediaFileId);

    // 1️⃣ BUSCA ARQUIVO
    const { data: media, error: fetchError } = await supabase
      .from("media_files")
      .select("*")
      .eq("id", mediaFileId)
      .single();

    if (fetchError || !media) throw new Error("Arquivo não encontrado");

    // 2️⃣ LOCK - evitar processamento duplo
    if (media.status === "processing") {
      console.warn("[LOCK] Arquivo já está em processamento");
      return new Response(
        JSON.stringify({ success: true, message: "Arquivo já em processamento" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("media_files")
      .update({ status: "processing", error_message: null, last_attempt_at: new Date().toISOString() })
      .eq("id", mediaFileId);

    console.log("[LOCK] Marcado como processing");

    // 3️⃣ BUSCAR TOKEN DO WHATSAPP (para download da mídia)
    if (!media.user_id) throw new Error("Arquivo sem usuário associado");

    const { data: connection, error: connError } = await supabase
      .from("connections")
      .select(
        "whatsapp_access_token, google_access_token, google_refresh_token, google_token_expires_at, google_root_folder"
      )
      .eq("user_id", media.user_id)
      .single();

    if (connError || !connection) {
      throw new Error("Conexão não encontrada");
    }

    // Validar token do WhatsApp
    if (!connection.whatsapp_access_token) {
      throw new Error("Token do WhatsApp não encontrado. Reconecte o WhatsApp.");
    }

    // 4️⃣ DOWNLOAD DA MÍDIA DO WHATSAPP
    console.log("[WA] Baixando mídia:", media.whatsapp_media_id);
    const { buffer: fileBuffer, contentType } = await downloadWhatsAppMedia(
      media.whatsapp_media_id,
      connection.whatsapp_access_token
    );

    // 5️⃣ PREPARAR TOKEN DO GOOGLE DRIVE (secrets centralizadas)
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!googleClientId || !googleClientSecret) {
      throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados nos secrets.");
    }

    let googleToken = connection.google_access_token;

    if (!googleToken && !connection.google_refresh_token) {
      throw new Error("Google Drive não conectado. Conecte o Google Drive nas configurações.");
    }

    // Renovar token se necessário
    if (!googleToken || (connection.google_token_expires_at &&
        new Date(connection.google_token_expires_at).getTime() - Date.now() < TOKEN_EXPIRY_BUFFER_MS)) {
      if (!connection.google_refresh_token) {
        throw new Error("Refresh token do Google não disponível. Reconecte o Google Drive.");
      }

      console.log("[AUTH] Renovando token do Google...");
      const refreshed = await refreshGoogleAccessToken(
        googleClientId,
        googleClientSecret,
        connection.google_refresh_token
      );
      googleToken = refreshed.access_token;
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await supabase
        .from("connections")
        .update({
          google_access_token: googleToken,
          google_token_expires_at: newExpiresAt,
        })
        .eq("user_id", media.user_id);

      console.log("[AUTH] Token Google renovado");
    }

    console.log("[AUTH] Token Google obtido");

    // 6️⃣ UPLOAD PARA O GOOGLE DRIVE
    console.log("[UPLOAD] Enviando para Google Drive:", media.file_name);
    const { fileId: driveFileId, webViewLink } = await uploadToGoogleDrive(
      googleToken!,
      media.file_name,
      fileBuffer,
      media.mime_type || contentType
    );
    console.log("[UPLOAD] Sucesso, Drive File ID:", driveFileId);

    // 7️⃣ FINALIZAR - atualizar status
    await supabase
      .from("media_files")
      .update({
        status: "completed",
        google_drive_file_id: driveFileId,
        google_drive_url: webViewLink,
        file_size_bytes: fileBuffer.byteLength,
        processed_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", mediaFileId);

    // Log de sucesso
    await supabase.from("sync_logs").insert({
      user_id: media.user_id,
      media_file_id: mediaFileId,
      action: "process_media",
      status: "completed",
      message: `Arquivo ${media.file_name} processado e enviado ao Drive`,
      metadata: {
        drive_file_id: driveFileId,
        file_size: fileBuffer.byteLength,
        duration_ms: Date.now() - startTime,
      },
      source: "process-media",
    });

    console.log("[SUCCESS] Arquivo finalizado");

    return new Response(
      JSON.stringify({ success: true, message: "Arquivo processado com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ERROR]", err);

    if (mediaFileId) {
      // Incrementar retry_count e marcar como failed
      const { data: currentMedia } = await supabase
        .from("media_files")
        .select("retry_count, user_id")
        .eq("id", mediaFileId)
        .single();

      const retryCount = (currentMedia?.retry_count || 0) + 1;
      const isPermanentFailure = retryCount >= 3;

      await supabase
        .from("media_files")
        .update({
          status: "failed",
          error_message: String(err),
          retry_count: retryCount,
          is_permanent_failure: isPermanentFailure,
        })
        .eq("id", mediaFileId);

      // Log de erro
      if (currentMedia?.user_id) {
        await supabase.from("sync_logs").insert({
          user_id: currentMedia.user_id,
          media_file_id: mediaFileId,
          action: "process_media",
          status: "failed",
          message: String(err),
          metadata: { retry_count: retryCount, is_permanent: isPermanentFailure },
          source: "process-media",
        });
      }
    }

    return new Response(
      JSON.stringify({ success: false, message: String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[END] process-media (${duration}ms)`);
  }
});

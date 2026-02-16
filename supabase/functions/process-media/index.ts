// @ts-nocheck - Deno edge runtime types

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================
   ENV
========================= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* =========================
   CORS
========================= */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* =========================
   Helpers
========================= */
const TOKEN_EXPIRY_BUFFER_MS = 2 * 60 * 1000; // 2 min antes de expirar

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

async function uploadToGoogleDrive(token: string, file: any): Promise<string> {
  const metadata = { name: file.file_name };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([file.file_buffer], { type: file.mime_type || "application/octet-stream" }));

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("[UPLOAD ERROR]", json);
    throw new Error("Erro no upload para Google Drive");
  }
  return json.id; // Drive File ID
}

/* =========================
   Handler
========================= */
serve(async (req) => {
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

    // 2️⃣ LOCK
    if (media.status === "processing") {
      console.warn("[LOCK] Arquivo já está em processamento");
      return new Response(JSON.stringify({ success: true, message: "Arquivo já em processamento" }), { headers: corsHeaders });
    }

    await supabase.from("media_files").update({ status: "processing", error_message: null }).eq("id", mediaFileId);
    console.log("[LOCK] Marcado como processing");

    // 3️⃣ PEGAR TOKEN DO USUÁRIO (tabela connections)
    if (!media.user_id) throw new Error("Arquivo sem usuário associado");

    const { data: connection, error: connError } = await supabase
      .from("connections")
      .select("google_access_token, google_refresh_token, google_token_expires_at, google_client_id, google_client_secret")
      .eq("user_id", media.user_id)
      .single();

    if (connError || !connection) {
      console.error("[AUTH] connections query:", connError?.message ?? "no row");
      throw new Error("Conexão não encontrada ou Google Drive não conectado");
    }

    let token = connection.google_access_token;
    if (!token && connection.google_refresh_token) {
      const refreshed = await refreshGoogleAccessToken(
        connection.google_client_id!,
        connection.google_client_secret!,
        connection.google_refresh_token
      );
      token = refreshed.access_token;
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase.from("connections").update({ google_access_token: token, google_token_expires_at: expiresAt }).eq("user_id", media.user_id);
      console.log("[AUTH] Token renovado via refresh_token");
    }
    if (!token) throw new Error("Token do Google não encontrado. Conecte o Google Drive nas configurações.");

    const expiresAt = connection.google_token_expires_at ? new Date(connection.google_token_expires_at).getTime() : 0;
    if (expiresAt && expiresAt - Date.now() < TOKEN_EXPIRY_BUFFER_MS && connection.google_refresh_token) {
      const refreshed = await refreshGoogleAccessToken(
        connection.google_client_id!,
        connection.google_client_secret!,
        connection.google_refresh_token
      );
      token = refreshed.access_token;
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase.from("connections").update({ google_access_token: token, google_token_expires_at: newExpiresAt }).eq("user_id", media.user_id);
      console.log("[AUTH] Token renovado (expiração próxima)");
    }

    console.log("[AUTH] Token Google obtido");

    // 4️⃣ UPLOAD
    console.log("[UPLOAD] Enviando para Google Drive");
    const driveFileId = await uploadToGoogleDrive(token, media);
    console.log("[UPLOAD] Sucesso:", driveFileId);

    // 5️⃣ FINALIZA
    await supabase.from("media_files").update({
      status: "completed",
      google_drive_file_id: driveFileId,
      file_size_bytes: media.file_buffer?.length ?? null,
      processed_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", mediaFileId);

    console.log("[SUCCESS] Arquivo finalizado");

    return new Response(JSON.stringify({ success: true, message: "Arquivo processado com sucesso" }), { headers: corsHeaders });

  } catch (err) {
    console.error("[ERROR]", err);

    if (mediaFileId) {
      await supabase.from("media_files").update({ status: "failed", error_message: String(err) }).eq("id", mediaFileId);
    }

    return new Response(JSON.stringify({ success: false, message: String(err) }), { headers: corsHeaders, status: 500 });
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[END] process-media (${duration}ms)`);
  }
});

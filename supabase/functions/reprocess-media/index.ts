/// <reference types="https://deno.land/x/supabase_edge_runtime@v1.70.0/types/global.d.ts" />

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mediaFileId = body.mediaFileId as string | undefined;
    if (!mediaFileId) throw new Error("mediaFileId é obrigatório");

    const { data: media, error: fetchError } = await supabase
      .from("media_files")
      .select("id, user_id, status, last_attempt_at")
      .eq("id", mediaFileId)
      .maybeSingle();

    if (fetchError || !media) throw new Error("Arquivo não encontrado");

    const lastAttemptTs = media.last_attempt_at ? new Date(media.last_attempt_at).getTime() : 0;
    const processingStaleMs = 5 * 60 * 1000;
    const isStaleProcessing =
      media.status === "processing" && lastAttemptTs > 0 && Date.now() - lastAttemptTs > processingStaleMs;

    if (media.status === "processing" && !isStaleProcessing) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Arquivo já está em processamento",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Reset state and delegate all processing logic to process-media
    await supabase
      .from("media_files")
      .update({
        status: "pending",
        error_message: null,
        is_permanent_failure: false,
      })
      .eq("id", mediaFileId);

    const { error: invokeError } = await supabase.functions.invoke("process-media", {
      body: { mediaFileId },
    });

    if (invokeError) {
      throw new Error(invokeError.message || "Falha ao disparar reprocessamento");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Reprocessamento disparado com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: String(err) }), { headers: corsHeaders, status: 500 });
  }
});

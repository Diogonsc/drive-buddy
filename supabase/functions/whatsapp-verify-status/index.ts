// =====================================================
// SwiftwapdriveSync - Verify WhatsApp Status
// =====================================================
// - Valida JWT do usuário
// - Usa credenciais salvas (connection)
// - Verifica status real na API Meta
// - Atualiza whatsapp_status corretamente
// =====================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // =========================
  // CORS
  // =========================
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // =========================
    // Authorization
    // =========================
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Não autorizado" }, 401);
    }

    const jwt = authHeader.replace("Bearer ", "").trim();

    // =========================
    // Supabase clients
    // =========================
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // =========================
    // Validate session
    // =========================
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(jwt);

    if (authError || !user) {
      return json(
        { success: false, error: "Sessão inválida. Faça login novamente." },
        401,
      );
    }

    // =========================
    // Load connection
    // =========================
    const { data: connectionData } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("id, twilio_account_sid, twilio_auth_token, twilio_whatsapp_number")
      .eq("user_id", user.id)
      .in("status", ["connected", "pending"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const connection = {
      whatsapp_connection_id: connectionData?.id as string | undefined,
      twilio_account_sid: connectionData?.twilio_account_sid as string | null,
      twilio_auth_token: connectionData?.twilio_auth_token as string | null,
      twilio_whatsapp_number: connectionData?.twilio_whatsapp_number as string | null,
    }

    // Credenciais Twilio: usa da conexão (modelo subaccount) ou fallback
    // para os Secrets globais (modelo compartilhado atual)
    const twilioAccountSid = (
      connection.twilio_account_sid?.trim() ||
      Deno.env.get('TWILIO_ACCOUNT_SID') ||
      ''
    )
    const twilioAuthToken = (
      connection.twilio_auth_token?.trim() ||
      Deno.env.get('TWILIO_AUTH_TOKEN') ||
      ''
    )

    if (!twilioAccountSid || !twilioAuthToken) {
      return json(
        {
          success: false,
          error: 'Credenciais Twilio não configuradas na plataforma.',
        },
        400,
      )
    }

    const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`)
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}.json`,
      { headers: { Authorization: `Basic ${credentials}` } },
    )

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data?.message || "Credenciais Twilio inválidas ou expiradas"

      await supabaseAdmin
        .from("whatsapp_connections")
        .update({ status: "disconnected" })
        .eq("id", connection.whatsapp_connection_id)

      return json({ success: false, error: message }, 400);
    }

    // Atualizar status para connected
    await supabaseAdmin
      .from("whatsapp_connections")
      .update({
        status: "connected",
        connected_at: new Date().toISOString(),
      })
      .eq("id", connection.whatsapp_connection_id)

    return json({
      success: true,
      friendly_name: data.friendly_name,
      twilio_status: data.status,
      whatsapp_number: (
        connection.twilio_whatsapp_number ||
        Deno.env.get('TWILIO_WHATSAPP_NUMBER') ||
        null
      ),
    })
  } catch (e) {
    console.error("whatsapp-verify-status error:", e);

    return json(
      { success: false, error: (e as Error).message || "Erro interno" },
      500,
    );
  }
});

// =========================
// Helpers
// =========================
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

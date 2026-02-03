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
    const { data: connection } = await supabaseAdmin
      .from("connections")
      .select("whatsapp_phone_number_id, whatsapp_access_token")
      .eq("user_id", user.id)
      .single();

    if (
      !connection?.whatsapp_phone_number_id ||
      !connection?.whatsapp_access_token
    ) {
      return json(
        {
          success: false,
          error:
            "Configure Phone Number ID e Access Token nas Configurações primeiro.",
        },
        400,
      );
    }

    const phoneNumberId = connection.whatsapp_phone_number_id.trim();
    const accessToken = connection.whatsapp_access_token.trim();

    // =========================
    // Call Meta API
    // =========================
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        data?.error?.error_user_msg ||
        data?.error?.message ||
        "Credenciais inválidas ou expiradas";

      await supabaseAdmin
        .from("connections")
        .update({
          whatsapp_status: "disconnected",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      return json({ success: false, error: message }, 400);
    }

    // =========================
    // Validate real connection
    // =========================
    if (!data.display_phone_number || !data.verified_name) {
      await supabaseAdmin
        .from("connections")
        .update({
          whatsapp_status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      return json(
        {
          success: false,
          error: "Conta WhatsApp incompleta ou não verificada.",
        },
        400,
      );
    }

    // =========================
    // Update status
    // =========================
    await supabaseAdmin
      .from("connections")
      .update({
        whatsapp_status: "connected",
        whatsapp_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return json({
      success: true,
      display_phone_number: data.display_phone_number,
      verified_name: data.verified_name,
    });
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

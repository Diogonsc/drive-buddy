// @ts-nocheck - Deno edge runtime types

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Cooldown: don't send same alert type to same user within 2 hours
const COOLDOWN_HOURS = 2;

interface AlertPayload {
  userId: string;
  alertType: "whatsapp_critical" | "google_critical" | "processing_critical";
  message: string;
  details?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const { userId, alertType, message, details } = (await req.json()) as AlertPayload;

    if (!userId || !alertType || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "userId, alertType e message são obrigatórios" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check cooldown - avoid spam
    const cooldownSince = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recentAlert } = await supabase
      .from("email_notifications_log")
      .select("id")
      .eq("user_id", userId)
      .eq("alert_type", alertType)
      .gte("sent_at", cooldownSince)
      .limit(1)
      .maybeSingle();

    if (recentAlert) {
      console.log(`[EMAIL] Cooldown ativo para ${alertType} do user ${userId}. Ignorando.`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "cooldown" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user email from auth
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user?.email) {
      console.error("[EMAIL] Usuário não encontrado:", userError);
      return new Response(
        JSON.stringify({ success: false, error: "Email do usuário não encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const userEmail = userData.user.email;
    const userName = userData.user.user_metadata?.full_name || userEmail.split("@")[0];

    // Build email
    const alertLabels: Record<string, string> = {
      whatsapp_critical: "WhatsApp",
      google_critical: "Google Drive",
      processing_critical: "Processamento de Mídia",
    };

    const serviceName = alertLabels[alertType] || alertType;

    const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0d9488, #0f766e); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">⚠️ Alerta Crítico - ${serviceName}</h1>
      </div>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <p style="color: #1f2937; margin: 0 0 12px;">Olá <strong>${userName}</strong>,</p>
        <p style="color: #1f2937; margin: 0 0 16px;">Detectamos um problema crítico na sua integração:</p>
        <div style="background: white; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 0 0 16px;">
          <p style="color: #dc2626; font-weight: 600; margin: 0 0 4px;">${serviceName}</p>
          <p style="color: #4b5563; margin: 0;">${message}</p>
          ${details ? `<p style="color: #6b7280; font-size: 13px; margin: 8px 0 0;">${details}</p>` : ""}
        </div>
        <p style="color: #4b5563; margin: 0 0 20px;">Acesse o painel para verificar e corrigir o problema o mais rápido possível.</p>
        <a href="${SUPABASE_URL.replace('.supabase.co', '')}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Acessar Painel</a>
        <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0;">Este é um email automático do DriveZapSync. Você não receberá outro alerta do mesmo tipo nas próximas ${COOLDOWN_HOURS} horas.</p>
      </div>
    </div>`;

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DriveZapSync <onboarding@resend.dev>",
        to: [userEmail],
        subject: `⚠️ Alerta Crítico: ${serviceName} - Ação Necessária`,
        html: htmlBody,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("[EMAIL] Erro Resend:", resendData);
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`);
    }

    // Log the notification
    await supabase.from("email_notifications_log").insert({
      user_id: userId,
      alert_type: alertType,
      service_name: serviceName,
      message,
      email_to: userEmail,
      resend_id: resendData.id,
      sent_at: new Date().toISOString(),
    });

    console.log(`[EMAIL] Alerta enviado para ${userEmail}: ${alertType}`);

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[EMAIL] Erro fatal:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

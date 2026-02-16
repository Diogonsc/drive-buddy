// @ts-nocheck - Deno edge runtime types

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_WARNING_HOURS = 24;
const MEDIA_FAILURE_THRESHOLD = 0.3; // 30% failure rate = warning
const STALE_MEDIA_HOURS = 48; // No media in 48h when connected = warning

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId;

    // If userId provided, check single user. Otherwise check all active users.
    let users: { user_id: string }[] = [];

    if (targetUserId) {
      users = [{ user_id: targetUserId }];
    } else {
      // Get all users with at least one connection active
      const { data } = await supabase
        .from("connections")
        .select("user_id")
        .or("whatsapp_status.eq.connected,google_status.eq.connected");
      users = data || [];
    }

    console.log(`[HEALTH] Checking ${users.length} user(s)`);

    const results = [];

    for (const { user_id } of users) {
      try {
        const result = await checkUserHealth(user_id);
        results.push({ user_id, ...result });
      } catch (err) {
        console.error(`[HEALTH] Error for user ${user_id}:`, err);
        results.push({ user_id, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[HEALTH] Fatal error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function checkUserHealth(userId: string) {
  const { data: conn } = await supabase
    .from("connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!conn) return { error: "No connection found" };

  const checks: any = {};
  const logs: any[] = [];

  // 1. WhatsApp Token Check
  checks.whatsapp = await checkWhatsApp(conn, userId, logs);

  // 2. Google Drive Token Check
  checks.google = await checkGoogle(conn, userId, logs);

  // 3. Media Processing Health
  checks.processing = await checkProcessing(userId, logs);

  // Calculate overall status
  const statuses = [checks.whatsapp.status, checks.google.status, checks.processing.status];
  let overall: string = "healthy";
  if (statuses.includes("critical")) overall = "critical";
  else if (statuses.includes("warning")) overall = "warning";
  else if (statuses.every((s: string) => s === "unknown")) overall = "unknown";

  // Save health logs
  if (logs.length > 0) {
    await supabase.from("integration_health_logs").insert(logs);
  }

  // Upsert integration_status
  await supabase.from("integration_status").upsert({
    user_id: userId,
    whatsapp_health: checks.whatsapp.status,
    whatsapp_last_check: new Date().toISOString(),
    whatsapp_message: checks.whatsapp.message,
    google_health: checks.google.status,
    google_last_check: new Date().toISOString(),
    google_message: checks.google.message,
    processing_health: checks.processing.status,
    processing_last_check: new Date().toISOString(),
    processing_message: checks.processing.message,
    overall_status: overall,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  // Send email alerts for critical issues
  if (overall === "critical") {
    await sendCriticalAlerts(userId, checks);
  }

  return { overall, checks };
}

async function checkWhatsApp(conn: any, userId: string, logs: any[]) {
  if (conn.whatsapp_status !== "connected") {
    return { status: "unknown", message: "WhatsApp não conectado" };
  }

  if (!conn.whatsapp_access_token) {
    logs.push({
      user_id: userId,
      check_type: "whatsapp_token",
      status: "critical",
      message: "Token de acesso ausente",
    });
    return { status: "critical", message: "Token de acesso ausente" };
  }

  // Test token by calling Graph API
  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${conn.whatsapp_phone_number_id}`,
      { headers: { Authorization: `Bearer ${conn.whatsapp_access_token}` } }
    );

    if (res.status === 401 || res.status === 190) {
      logs.push({
        user_id: userId,
        check_type: "whatsapp_token",
        status: "critical",
        message: "Token expirado ou inválido",
      });
      // Update connection status
      await supabase.from("connections").update({ whatsapp_status: "error" }).eq("user_id", userId);
      return { status: "critical", message: "Token expirado ou inválido. Reconecte o WhatsApp." };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `API retornou ${res.status}`;
      logs.push({
        user_id: userId,
        check_type: "whatsapp_token",
        status: "warning",
        message: errMsg,
      });
      return { status: "warning", message: errMsg };
    }

    logs.push({
      user_id: userId,
      check_type: "whatsapp_token",
      status: "healthy",
      message: "Token válido",
    });
    return { status: "healthy", message: "WhatsApp funcionando normalmente" };
  } catch (err) {
    logs.push({
      user_id: userId,
      check_type: "whatsapp_webhook",
      status: "warning",
      message: `Erro ao verificar API: ${String(err)}`,
    });
    return { status: "warning", message: "Não foi possível verificar a API da Meta" };
  }
}

async function checkGoogle(conn: any, userId: string, logs: any[]) {
  if (conn.google_status !== "connected") {
    return { status: "unknown", message: "Google Drive não conectado" };
  }

  if (!conn.google_access_token && !conn.google_refresh_token) {
    logs.push({
      user_id: userId,
      check_type: "google_token",
      status: "critical",
      message: "Tokens ausentes",
    });
    return { status: "critical", message: "Tokens do Google ausentes. Reconecte o Drive." };
  }

  // Check token expiry
  if (conn.google_token_expires_at) {
    const expiresAt = new Date(conn.google_token_expires_at).getTime();
    const hoursUntilExpiry = (expiresAt - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilExpiry < 0 && !conn.google_refresh_token) {
      logs.push({
        user_id: userId,
        check_type: "google_token",
        status: "critical",
        message: "Token expirado sem refresh token",
      });
      return { status: "critical", message: "Token do Google expirado. Reconecte o Drive." };
    }

    if (hoursUntilExpiry < TOKEN_WARNING_HOURS && hoursUntilExpiry > 0 && !conn.google_refresh_token) {
      logs.push({
        user_id: userId,
        check_type: "google_token",
        status: "warning",
        message: `Token expira em ${Math.round(hoursUntilExpiry)}h`,
      });
      return { status: "warning", message: `Token expira em ${Math.round(hoursUntilExpiry)} horas` };
    }
  }

  // Test API access
  try {
    const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
      headers: { Authorization: `Bearer ${conn.google_access_token}` },
    });

    if (res.status === 401) {
      if (conn.google_refresh_token) {
        logs.push({
          user_id: userId,
          check_type: "google_token",
          status: "warning",
          message: "Token expirado, será renovado automaticamente",
        });
        return { status: "healthy", message: "Token será renovado automaticamente" };
      }
      logs.push({
        user_id: userId,
        check_type: "google_token",
        status: "critical",
        message: "Token expirado",
      });
      await supabase.from("connections").update({ google_status: "error" }).eq("user_id", userId);
      return { status: "critical", message: "Token do Google expirado. Reconecte o Drive." };
    }

    if (!res.ok) {
      logs.push({
        user_id: userId,
        check_type: "google_api",
        status: "warning",
        message: `API retornou ${res.status}`,
      });
      return { status: "warning", message: "Erro na API do Google Drive" };
    }

    logs.push({
      user_id: userId,
      check_type: "google_token",
      status: "healthy",
      message: "Token válido",
    });
    return { status: "healthy", message: "Google Drive funcionando normalmente" };
  } catch (err) {
    logs.push({
      user_id: userId,
      check_type: "google_api",
      status: "warning",
      message: `Erro ao verificar: ${String(err)}`,
    });
    return { status: "warning", message: "Não foi possível verificar o Google Drive" };
  }
}

async function checkProcessing(userId: string, logs: any[]) {
  // Check recent media processing stats (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recent } = await supabase
    .from("media_files")
    .select("status")
    .eq("user_id", userId)
    .gte("received_at", since);

  if (!recent || recent.length === 0) {
    // Check if user has any media at all
    const { count } = await supabase
      .from("media_files")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (count && count > 0) {
      return { status: "healthy", message: "Nenhuma mídia nas últimas 24h" };
    }
    return { status: "unknown", message: "Nenhuma mídia recebida ainda" };
  }

  const total = recent.length;
  const failed = recent.filter((m: any) => m.status === "failed").length;
  const pending = recent.filter((m: any) => m.status === "pending" || m.status === "processing").length;
  const failureRate = total > 0 ? failed / total : 0;

  if (failureRate > MEDIA_FAILURE_THRESHOLD) {
    logs.push({
      user_id: userId,
      check_type: "media_processing",
      status: "critical",
      message: `${failed}/${total} mídias falharam (${Math.round(failureRate * 100)}%)`,
    });
    return {
      status: "critical",
      message: `${failed} de ${total} mídias falharam nas últimas 24h`,
    };
  }

  if (pending > 3) {
    logs.push({
      user_id: userId,
      check_type: "media_processing",
      status: "warning",
      message: `${pending} mídias pendentes`,
    });
    return { status: "warning", message: `${pending} mídias aguardando processamento` };
  }

  return {
    status: "healthy",
    message: `${total} mídias processadas nas últimas 24h`,
  };
}

async function sendCriticalAlerts(userId: string, checks: any) {
  const alerts = [
    { key: "whatsapp", alertType: "whatsapp_critical" },
    { key: "google", alertType: "google_critical" },
    { key: "processing", alertType: "processing_critical" },
  ];

  for (const { key, alertType } of alerts) {
    if (checks[key]?.status === "critical") {
      try {
        const fnUrl = `${SUPABASE_URL}/functions/v1/send-health-alert`;
        await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            userId,
            alertType,
            message: checks[key].message,
          }),
        });
        console.log(`[HEALTH] Email alert sent: ${alertType} for ${userId}`);
      } catch (err) {
        console.error(`[HEALTH] Failed to send email alert ${alertType}:`, err);
      }
    }
  }
}

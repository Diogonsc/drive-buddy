import { supabase } from "@/integrations/supabase/client";

/**
 * Queries administrativas separadas.
 * Todas respeitam RLS existente (admin tem SELECT em user_roles e sync_logs).
 */

export interface RoleCount {
  role: string;
  count: number;
}

export interface LogStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  processing: number;
}

export interface SyncLogRow {
  id: string;
  user_id: string;
  media_file_id: string | null;
  action: string;
  status: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  source: string | null;
  created_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  /** E-mail da conta Google vinculada (google_drive_accounts.account_email), quando existir */
  account_email?: string | null;
}

export interface IntegrationOverview {
  whatsapp: {
    total: number;
    connected: number;
    pending: number;
    disconnected: number;
    error: number;
  };
  google: {
    total: number;
    connected: number;
    pending: number;
    disconnected: number;
    error: number;
  };
  routingRules: {
    total: number;
    active: number;
  };
}

export interface PlanDistributionRow {
  plan: string;
  users: number;
}

/** Contagem de usuários por role */
export async function fetchRoleCounts(): Promise<RoleCount[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, user_id");

  if (error) throw error;

  const counts: Record<string, Set<string>> = {};
  (data ?? []).forEach((row) => {
    if (!counts[row.role]) counts[row.role] = new Set();
    counts[row.role].add(row.user_id);
  });

  return Object.entries(counts).map(([role, users]) => ({
    role,
    count: users.size,
  }));
}

/** Estatísticas de sync_logs (últimas 24h ou geral) */
export async function fetchLogStats(since?: string): Promise<LogStats> {
  let query = supabase.from("sync_logs").select("id, status");
  if (since) query = query.gte("created_at", since);

  const { data, error } = await query;
  if (error) throw error;

  const list = data ?? [];
  return {
    total: list.length,
    completed: list.filter((r) => r.status === "completed").length,
    failed: list.filter((r) => r.status === "failed").length,
    pending: list.filter((r) => r.status === "pending").length,
    processing: list.filter((r) => r.status === "processing").length,
  };
}

/** Logs recentes (limite configurável) */
export async function fetchRecentLogs(limit = 10): Promise<SyncLogRow[]> {
  const { data, error } = await supabase
    .from("sync_logs")
    .select(
      "id, user_id, media_file_id, action, status, message, metadata, source, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as SyncLogRow[];
}

/** Lista de user_roles (para página de usuários / settings). E-mail vem de google_drive_accounts. */
export async function fetchUserRoles(): Promise<UserRoleRow[]> {
  const [{ data: roles, error: rolesError }, { data: driveRows, error: driveError }] =
    await Promise.all([
      supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("google_drive_accounts").select("user_id, account_email"),
    ]);

  if (rolesError) throw rolesError;
  if (driveError) throw driveError;

  const emailByUserId = new Map<string, string>();
  for (const row of driveRows ?? []) {
    const em = row.account_email?.trim();
    if (!em) continue;
    if (!emailByUserId.has(row.user_id)) {
      emailByUserId.set(row.user_id, em);
    }
  }

  return (roles ?? []).map((r) => ({
    ...r,
    account_email: emailByUserId.get(r.user_id) ?? null,
  })) as UserRoleRow[];
}

/** Todos os logs com filtros (para página de logs) */
export async function fetchAllLogs(filters?: {
  status?: string;
  action?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<SyncLogRow[]> {
  let q = supabase
    .from("sync_logs")
    .select(
      "id, user_id, media_file_id, action, status, message, metadata, source, created_at"
    )
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    q = q.eq("status", filters.status);
  }
  if (filters?.action) {
    q = q.ilike("action", `%${filters.action}%`);
  }
  if (filters?.userId) {
    q = q.eq("user_id", filters.userId);
  }
  if (filters?.dateFrom) {
    q = q.gte("created_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    q = q.lte("created_at", end.toISOString());
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SyncLogRow[];
}

export async function fetchIntegrationOverview(): Promise<IntegrationOverview> {
  const [{ data: wa }, { data: google }, { data: rules }] = await Promise.all([
    supabase.from("whatsapp_connections").select("id, status"),
    supabase.from("google_drive_accounts").select("id, status"),
    supabase.from("media_routing_rules").select("id, is_active"),
  ]);

  const waRows = wa ?? [];
  const googleRows = google ?? [];
  const ruleRows = rules ?? [];

  return {
    whatsapp: {
      total: waRows.length,
      connected: waRows.filter((row) => row.status === "connected").length,
      pending: waRows.filter((row) => row.status === "pending").length,
      disconnected: waRows.filter((row) => row.status === "disconnected").length,
      error: waRows.filter((row) => row.status === "error").length,
    },
    google: {
      total: googleRows.length,
      connected: googleRows.filter((row) => row.status === "connected").length,
      pending: googleRows.filter((row) => row.status === "pending").length,
      disconnected: googleRows.filter((row) => row.status === "disconnected").length,
      error: googleRows.filter((row) => row.status === "error").length,
    },
    routingRules: {
      total: ruleRows.length,
      active: ruleRows.filter((row) => row.is_active).length,
    },
  };
}

export async function fetchPlanDistribution(): Promise<PlanDistributionRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, user_id");

  if (error) throw error;

  const counts = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const key = row.plan || "unknown";
    if (!counts.has(key)) counts.set(key, new Set<string>());
    counts.get(key)?.add(row.user_id);
  }

  return Array.from(counts.entries()).map(([plan, users]) => ({
    plan,
    users: users.size,
  }));
}

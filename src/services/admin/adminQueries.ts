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

/** Lista de user_roles (para página de usuários) */
export async function fetchUserRoles(): Promise<UserRoleRow[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id, user_id, role, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as UserRoleRow[];
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

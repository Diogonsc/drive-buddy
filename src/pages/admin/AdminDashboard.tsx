import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/MetricCard";
import { AdminSection } from "@/components/admin/AdminSection";
import { BlockedAccess } from "@/components/admin/BlockedAccess";
import { EmptyState } from "@/components/admin/EmptyState";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchRoleCounts,
  fetchIntegrationOverview,
  fetchLogStats,
  fetchRecentLogs,
  type SyncLogRow,
} from "@/services/admin/adminQueries";
import { Users, Shield, Activity, AlertCircle, Loader2, ScrollText, Link as LinkIcon, HardDrive, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Dashboard Admin — visão geral do sistema (somente leitura).
 * Usa AppLayout global. Dados via user_roles e sync_logs (RLS permitido para admin).
 */
export default function AdminDashboard() {
  const { data: roleCounts, isLoading: loadingRoles } = useQuery({
    queryKey: ["admin-role-counts"],
    queryFn: fetchRoleCounts,
  });

  const { data: logStats, isLoading: loadingStats } = useQuery({
    queryKey: ["admin-log-stats-24h"],
    queryFn: () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      return fetchLogStats(since);
    },
  });

  const { data: recentLogs, isLoading: loadingLogs } = useQuery({
    queryKey: ["admin-recent-logs"],
    queryFn: () => fetchRecentLogs(10),
  });

  const { data: integrationOverview, isLoading: loadingIntegration } = useQuery({
    queryKey: ["admin-integration-overview"],
    queryFn: fetchIntegrationOverview,
  });

  const loading = loadingRoles || loadingStats || loadingLogs || loadingIntegration;

  const adminCount = roleCounts?.find((r) => r.role === "admin")?.count ?? 0;
  const userCount = roleCounts?.find((r) => r.role === "user")?.count ?? 0;
  const totalUsers = roleCounts?.reduce((sum, r) => sum + r.count, 0) ?? 0;

  const statusBadge = (status: string) => {
    const variant =
      status === "failed"
        ? "destructive"
        : status === "completed"
        ? "default"
        : "secondary";
    return <Badge variant={variant}>{status}</Badge>;
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard Admin
          </h1>
        </div>
        <p className="text-muted-foreground">
          Visão geral do sistema (somente leitura). Métricas baseadas em user_roles e sync_logs.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      ) : (
        <div className="space-y-8 min-w-0 overflow-x-hidden">
          {/* Métricas de Usuários */}
          <AdminSection title="Usuários por Role" description="Fonte: user_roles (SELECT permitido)">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                title="Total de usuários"
                value={totalUsers}
                subtitle="user_roles (distinct user_id)"
                icon={Users}
              />
              <MetricCard
                title="Admins"
                value={adminCount}
                subtitle="role = admin"
                icon={Shield}
              />
              <MetricCard
                title="Usuários comuns"
                value={userCount}
                subtitle="role = user"
                icon={Users}
              />
            </div>
          </AdminSection>

          {/* Métricas de Sync Logs */}
          <AdminSection title="Execuções de Sync (24h)" description="Fonte: sync_logs (SELECT permitido)">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Total de execuções"
                value={logStats?.total ?? 0}
                subtitle="Entradas em sync_logs"
                icon={Activity}
              />
              <MetricCard
                title="Sucesso"
                value={logStats?.completed ?? 0}
                subtitle="status = completed"
                icon={Activity}
              />
              <MetricCard
                title="Erros"
                value={logStats?.failed ?? 0}
                subtitle="status = failed"
                icon={AlertCircle}
                className={logStats?.failed ? "border-destructive/50" : ""}
              />
              <MetricCard
                title="Pendentes/Processando"
                value={(logStats?.pending ?? 0) + (logStats?.processing ?? 0)}
                subtitle="pending + processing"
                icon={Activity}
              />
            </div>
          </AdminSection>

          <AdminSection title="Integrações B2B" description="Status multi-conexão e roteamento">
            {integrationOverview ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="WhatsApp conectados"
                  value={integrationOverview.whatsapp.connected}
                  subtitle={`de ${integrationOverview.whatsapp.total} números`}
                  icon={MessageSquare}
                />
                <MetricCard
                  title="Google conectados"
                  value={integrationOverview.google.connected}
                  subtitle={`de ${integrationOverview.google.total} contas`}
                  icon={HardDrive}
                />
                <MetricCard
                  title="Regras de roteamento"
                  value={integrationOverview.routingRules.total}
                  subtitle={`${integrationOverview.routingRules.active} ativas`}
                  icon={LinkIcon}
                />
                <MetricCard
                  title="Integrações com erro"
                  value={integrationOverview.whatsapp.error + integrationOverview.google.error}
                  subtitle="whatsapp + google"
                  icon={AlertCircle}
                  className={
                    integrationOverview.whatsapp.error + integrationOverview.google.error > 0
                      ? "border-destructive/50"
                      : ""
                  }
                />
              </div>
            ) : (
              <BlockedAccess
                title="Sem dados de integração"
                description="Não foi possível carregar os indicadores de integrações."
                variant="info"
              />
            )}
          </AdminSection>

          {/* Logs Recentes */}
          <AdminSection title="Logs Recentes" description="Últimos 10 registros em sync_logs">
            <Card>
              <CardContent className="p-0">
                {recentLogs && recentLogs.length > 0 ? (
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <Table className="w-full min-w-[760px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>user_id</TableHead>
                          <TableHead>action</TableHead>
                          <TableHead>status</TableHead>
                          <TableHead className="max-w-[200px]">message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentLogs.map((log: SyncLogRow) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {format(new Date(log.created_at), "dd/MM/yy HH:mm", {
                                locale: ptBR,
                              })}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {log.user_id.slice(0, 8)}…
                            </TableCell>
                            <TableCell>{log.action}</TableCell>
                            <TableCell>{statusBadge(log.status)}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                              {log.message ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <EmptyState
                    icon={ScrollText}
                    title="Nenhum log recente"
                    description="Não há registros em sync_logs ainda."
                  />
                )}
              </CardContent>
            </Card>
          </AdminSection>
        </div>
      )}
    </AppLayout>
  );
}

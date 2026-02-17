import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminSection } from "@/components/admin/AdminSection";
import { StatusCard } from "@/components/admin/StatusCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { fetchIntegrationOverview, fetchPlanDistribution, fetchUserRoles } from "@/services/admin/adminQueries";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Shield,
  Settings,
  Database,
  MessageSquare,
  HardDrive,
  Link as LinkIcon,
  Lock,
  ExternalLink,
  Info,
  Loader2,
  ScrollText,
} from "lucide-react";

/**
 * Configurações Admin — informações do sistema, status de integrações,
 * roles/permissões e segurança. Sem escrita no banco.
 * Usa AppLayout global.
 */
export default function AdminSettings() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "—";
  const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "—";
  const appVersion = "1.0.0"; // Poderia vir de package.json ou env
  const environment = import.meta.env.MODE ?? "development";

  const { data: userRoles, isLoading } = useQuery({
    queryKey: ["admin-settings-roles"],
    queryFn: fetchUserRoles,
  });

  const { data: integrationOverview } = useQuery({
    queryKey: ["admin-settings-integration-overview"],
    queryFn: fetchIntegrationOverview,
  });

  const { data: planDistribution } = useQuery({
    queryKey: ["admin-settings-plan-distribution"],
    queryFn: fetchPlanDistribution,
  });

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Configurações
          </h1>
        </div>
        <p className="text-muted-foreground">
          Informações administrativas e técnicas. Sem escrita no banco.
        </p>
      </div>

      <div className="space-y-8">
        {/* 1. Informações do Sistema */}
        <AdminSection
          title="Informações do Sistema"
          description="Dados do ambiente e configuração (somente leitura)"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Ambiente</p>
                  <Badge variant={environment === "production" ? "default" : "secondary"}>
                    {environment}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Versão</p>
                  <p className="text-sm font-medium">{appVersion}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Supabase Project ID</p>
                  <p className="text-sm font-mono">{supabaseProjectId.slice(0, 12)}…</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Supabase URL</p>
                  <p className="text-sm font-mono truncate">{supabaseUrl}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </AdminSection>

        {/* 2. Status de Integrações */}
        <AdminSection
          title="Status de Integrações"
          description="Visão geral das conexões do sistema (visual, sem ações)"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <StatusCard
              title="WhatsApp (multi)"
              status={integrationOverview?.whatsapp.connected ? "connected" : "disconnected"}
              statusLabel={`${integrationOverview?.whatsapp.connected ?? 0} conectados de ${integrationOverview?.whatsapp.total ?? 0}`}
              icon={MessageSquare}
            />
            <StatusCard
              title="Google Drive (multi)"
              status={integrationOverview?.google.connected ? "active" : "disconnected"}
              statusLabel={`${integrationOverview?.google.connected ?? 0} conectados de ${integrationOverview?.google.total ?? 0}`}
              icon={HardDrive}
            />
            <StatusCard
              title="Regras de roteamento"
              status={integrationOverview?.routingRules.active ? "active" : "unknown"}
              statusLabel={`${integrationOverview?.routingRules.active ?? 0} ativas de ${integrationOverview?.routingRules.total ?? 0}`}
              icon={LinkIcon}
            />
            <StatusCard
              title="Supabase"
              status="connected"
              statusLabel="Online"
              icon={Database}
            />
          </div>
        </AdminSection>

        {/* 2.1 Planos B2B */}
        <AdminSection title="Distribuição de Planos" description="Usuários por plano comercial (subscriptions)">
          <Card>
            <CardContent className="p-0">
              {planDistribution && planDistribution.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plano</TableHead>
                        <TableHead>Usuários</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {planDistribution.map((row) => (
                        <TableRow key={row.plan}>
                          <TableCell className="font-medium">{row.plan}</TableCell>
                          <TableCell>{row.users}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Sem dados de plano.
                </div>
              )}
            </CardContent>
          </Card>
        </AdminSection>

        {/* 3. Roles e Permissões */}
        <AdminSection
          title="Roles e Permissões"
          description="Fonte: user_roles (apenas user_id e role visíveis)"
        >
          <Alert variant="default" className="border-muted mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Permissões são controladas exclusivamente por RLS no backend.
              Emails não disponíveis (auth.users não acessível).
            </AlertDescription>
          </Alert>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : userRoles && userRoles.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>user_id</TableHead>
                        <TableHead>email</TableHead>
                        <TableHead>role</TableHead>
                        <TableHead>Criado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userRoles.slice(0, 10).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs">
                            {row.user_id.slice(0, 8)}…
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            — (não disponível)
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.role === "admin" ? "default" : "secondary"}>
                              {row.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(row.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhum registro em user_roles.
                </div>
              )}
            </CardContent>
          </Card>
        </AdminSection>

        {/* 4. Segurança */}
        <AdminSection title="Segurança" description="Informações sobre políticas de acesso">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
                    <Lock className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">RLS ativo</p>
                    <p className="text-sm text-muted-foreground">
                      Row Level Security habilitado em todas as tabelas sensíveis.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Acesso restrito</p>
                    <p className="text-sm text-muted-foreground">
                      Admin não possui acesso irrestrito. Todas as ações respeitam policies definidas.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Auditoria</p>
                    <p className="text-sm text-muted-foreground">
                      Todas as operações são registradas em sync_logs para auditoria.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AdminSection>

        {/* 5. Atalho para Logs */}
        <AdminSection>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <ScrollText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Logs de Sincronização</CardTitle>
                  <CardDescription>
                    Acesse todos os registros de sync_logs com filtros avançados.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link to="/admin/logs">
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver logs de sincronização
                </Button>
              </Link>
            </CardContent>
          </Card>
        </AdminSection>
      </div>
    </AppLayout>
  );
}

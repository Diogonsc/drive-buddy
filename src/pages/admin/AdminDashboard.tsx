import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileStack, Upload, AlertCircle, Loader2, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Métricas possíveis via RLS atual: user_roles (admin ALL), sync_logs (admin SELECT). Sem acesso a media_files. */
export default function AdminDashboard() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: userCount, isLoading: loadingUsers } = useQuery({
    queryKey: ["admin-users-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id");
      if (error) throw error;
      const ids = new Set((data ?? []).map((r) => r.user_id));
      return ids.size;
    },
  });

  const { data: logs24h, isLoading: loadingLogs } = useQuery({
    queryKey: ["admin-logs-24h", since24h],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("id, status")
        .gte("created_at", since24h);
      if (error) throw error;
      const list = data ?? [];
      return {
        total: list.length,
        errors: list.filter((r) => r.status === "failed").length,
      };
    },
  });

  const loading = loadingUsers || loadingLogs;

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard Admin
        </h1>
        <p className="text-muted-foreground">
          Visão geral do sistema (somente leitura). Métricas limitadas às tabelas acessíveis via RLS.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de usuários
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount ?? "—"}</div>
              <p className="text-xs text-muted-foreground">
                user_roles (distinct user_id)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                Total de arquivos
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      Sem policy admin em media_files. Apenas leitura própria por usuário.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <FileStack className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground">
                N/D (sem acesso admin)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sync logs (24h)
              </CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{logs24h?.total ?? "—"}</div>
              <p className="text-xs text-muted-foreground">
                Entradas em sync_logs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Erros (24h)
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {logs24h?.errors ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                status = failed em sync_logs
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Origem dos dados</CardTitle>
          <CardDescription>
            Dashboard usa apenas SELECT em user_roles e sync_logs (já permitidos para admin via RLS).
            Totais por status em media_files (pending, processing, completed, failed) e uploads
            específicos exigiriam policy ou RPC adicional.
          </CardDescription>
        </CardHeader>
      </Card>
    </AdminLayout>
  );
}

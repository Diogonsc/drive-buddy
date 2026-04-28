import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConnections } from "@/hooks/useConnections";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  HardDrive,
  Settings,
  RefreshCw,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";

interface SubscriptionInfo {
  whatsapp_numbers_limit: number;
  google_accounts_limit: number;
}

export default function Connections() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const {
    isLoading: isLoadingConnections,
    whatsappConnections,
    googleAccounts,
    routingRules,
    refetch: refetchConnections,
  } = useConnections(user?.id);

  const loadConnections = useCallback(async () => {
    if (!user) return;

    try {
      const [{ data: sub }] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("whatsapp_numbers_limit, google_accounts_limit")
          .eq("user_id", user.id)
          .maybeSingle(),
        refetchConnections(),
      ]);

      if (sub) {
        setSubscription({
          whatsapp_numbers_limit: sub.whatsapp_numbers_limit || 1,
          google_accounts_limit: sub.google_accounts_limit || 1,
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar conexões");
    }
  }, [refetchConnections, user]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const connectedWhatsApp = useMemo(
    () => whatsappConnections.filter((item) => item.status === "connected" || item.status === "pending").length,
    [whatsappConnections],
  );
  const connectedGoogle = useMemo(
    () => googleAccounts.filter((item) => item.status === "connected" || item.status === "pending").length,
    [googleAccounts],
  );
  const activeRules = useMemo(
    () => routingRules.filter((item) => item.is_active).length,
    [routingRules],
  );

  const handleRefreshGoogle = async (accountId: string) => {
    setIsRefreshing(accountId);
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth", {
        body: { action: "refresh", accountId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao atualizar token");
      toast.success("Token Google atualizado!");
      await loadConnections();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar token");
    } finally {
      setIsRefreshing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "connected") {
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Conectado
        </Badge>
      );
    }
    if (status === "pending") {
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Pendente
        </Badge>
      );
    }
    if (status === "error") {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Erro
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <XCircle className="h-3 w-3 mr-1" />
        Não conectado
      </Badge>
    );
  };

  const getRuleTypeLabel = (fileType: (typeof routingRules)[number]["file_type"]) => {
    if (!fileType) return "Todos";
    if (fileType === "image") return "Imagens";
    if (fileType === "video") return "Vídeos";
    if (fileType === "audio") return "Áudios";
    return "Documentos";
  };

  const waLabelById = (id: string) =>
    whatsappConnections.find((row) => row.id === id)?.label ||
    whatsappConnections.find((row) => row.id === id)?.twilio_whatsapp_number ||
    whatsappConnections.find((row) => row.id === id)?.phone_number_id ||
    id;

  const googleLabelById = (id: string) =>
    googleAccounts.find((row) => row.id === id)?.label ||
    googleAccounts.find((row) => row.id === id)?.account_email ||
    id;

  if (isLoadingConnections) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 min-w-0 overflow-hidden">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Conexões
          </h1>
          <p className="text-muted-foreground">
            Visão de múltiplos números WhatsApp, contas Google Drive e regras de roteamento.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <Card className="w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">WhatsApp conectados</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {connectedWhatsApp}/{subscription?.whatsapp_numbers_limit ?? 1}
            </CardContent>
          </Card>
          <Card className="w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Drives conectados</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {connectedGoogle}/{subscription?.google_accounts_limit ?? 1}
            </CardContent>
          </Card>
          <Card className="w-full min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Regras ativas</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {activeRules}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="w-full min-w-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Números WhatsApp</CardTitle>
                  <CardDescription>Conexões por número</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/settings?tab=whatsapp")}>
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Gerenciar</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {whatsappConnections.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum número conectado.</p>
            )}
            {whatsappConnections.map((item) => (
              <div key={item.id} className="rounded-md border p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.label || item.twilio_whatsapp_number || item.phone_number_id}</p>
                  <p className="text-xs text-muted-foreground">{item.twilio_whatsapp_number || "—"}</p>
                </div>
                {getStatusBadge(item.status)}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="w-full min-w-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <HardDrive className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Contas Google Drive</CardTitle>
                  <CardDescription>Conexões por conta</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/settings?tab=google")}>
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Gerenciar</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {googleAccounts.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma conta conectada.</p>
            )}
            {googleAccounts.map((item) => (
              <div key={item.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.label || "Conta Google"}</p>
                    <p className="text-xs text-muted-foreground">{item.account_email || "Email não identificado"}</p>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRefreshGoogle(item.id)}
                  disabled={isRefreshing === item.id}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing === item.id ? "animate-spin" : ""}`} />
                  Renovar token
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
        </div>

      <Card className="w-full min-w-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Roteamento ativo</CardTitle>
              <CardDescription>Como as mídias são direcionadas para cada conta Drive</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings?tab=routing")}>
              <LinkIcon className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Editar regras</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {routingRules.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma regra de roteamento configurada.</p>
          )}
          {routingRules.map((rule) => (
            <div key={rule.id} className="rounded-md border p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{waLabelById(rule.whatsapp_connection_id)} {"->"} {googleLabelById(rule.google_drive_account_id)}</p>
                <p className="text-xs text-muted-foreground">{getRuleTypeLabel(rule.file_type)} {rule.is_default ? "• padrão" : ""}</p>
              </div>
              <Badge variant={rule.is_active ? "default" : "outline"}>
                {rule.is_active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}

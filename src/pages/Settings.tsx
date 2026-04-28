import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppConnectButton } from "@/components/whatsapp/WhatsAppConnectButton";
import { useAuth } from "@/contexts/AuthContext";
import { useConnections } from "@/hooks/useConnections";
import { supabase } from "@/integrations/supabase/client";
import {
    FolderTree,
    Link as LinkIcon,
    Loader2,
    RefreshCw,
    Save,
    Shield,
    Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FaWhatsapp, FaGoogleDrive } from "react-icons/fa6";

const VALID_TABS = ["whatsapp", "google", "routing", "general"] as const;
type SettingsTab = (typeof VALID_TABS)[number];
type RuleFileType = "image" | "video" | "audio" | "document" | "all";

interface SubscriptionInfo {
  plan: string;
  monthly_file_limit: number | null;
  files_used_current_month: number | null;
  overage_enabled: boolean;
}

interface GeneralConfigState {
  autoSyncEnabled: boolean;
  syncImages: boolean;
  syncVideos: boolean;
  syncAudio: boolean;
  syncDocuments: boolean;
  folderStructure: string;
  notificationOnError: boolean;
  notificationOnSuccess: boolean;
}

export default function Settings() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (VALID_TABS.includes(searchParams.get("tab") as SettingsTab)
    ? searchParams.get("tab")
    : "whatsapp") as SettingsTab;

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingGoogle, setIsRefreshingGoogle] = useState<string | null>(null);

  const [newGoogleLabel, setNewGoogleLabel] = useState("");
  const [folderDrafts, setFolderDrafts] = useState<Record<string, string>>({});
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const {
    isLoading: isLoadingConnections,
    whatsappConnections,
    googleAccounts,
    routingRules,
    refetch: refetchConnections,
  } = useConnections(user?.id);
  const [generalConfig, setGeneralConfig] = useState<GeneralConfigState>({
    autoSyncEnabled: true,
    syncImages: true,
    syncVideos: true,
    syncAudio: true,
    syncDocuments: true,
    folderStructure: "date_type",
    notificationOnError: true,
    notificationOnSuccess: false,
  });
  const [newRule, setNewRule] = useState<{
    whatsappConnectionId: string;
    googleDriveAccountId: string;
    fileType: RuleFileType;
    isDefault: boolean;
  }>({
    whatsappConnectionId: "",
    googleDriveAccountId: "",
    fileType: "all",
    isDefault: false,
  });

  const connectedWhatsAppCount = useMemo(
    () => whatsappConnections.filter((item) => item.status === "connected" || item.status === "pending").length,
    [whatsappConnections],
  );
  const connectedGoogleCount = useMemo(
    () => googleAccounts.filter((item) => item.status === "connected" || item.status === "pending").length,
    [googleAccounts],
  );

  const loadConfig = useCallback(async () => {
    if (!user) return;

    try {
      const [
        { data: subscriptionData },
        { data: settingsData },
      ] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("plan, monthly_file_limit, files_used_current_month, overage_enabled")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        refetchConnections(),
      ]);

      if (subscriptionData) {
        setSubscription({
          plan: "Plano Essencial",
          monthly_file_limit: subscriptionData.monthly_file_limit ?? 200,
          files_used_current_month: subscriptionData.files_used_current_month ?? 0,
          overage_enabled: true,
        });
      }

      if (settingsData) {
        setGeneralConfig({
          autoSyncEnabled: settingsData.auto_sync_enabled,
          syncImages: settingsData.sync_images,
          syncVideos: settingsData.sync_videos,
          syncAudio: settingsData.sync_audio,
          syncDocuments: settingsData.sync_documents,
          folderStructure: settingsData.folder_structure,
          notificationOnError: settingsData.notification_on_error,
          notificationOnSuccess: settingsData.notification_on_success,
        });
      }

    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar configurações");
    }
  }, [refetchConnections, user]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    setFolderDrafts(
      Object.fromEntries(
        googleAccounts.map((account) => [account.id, account.root_folder_path || "/SwiftWapDrive"]),
      ),
    );
  }, [googleAccounts]);

  const handleSaveGeneral = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          auto_sync_enabled: generalConfig.autoSyncEnabled,
          sync_images: generalConfig.syncImages,
          sync_videos: generalConfig.syncVideos,
          sync_audio: generalConfig.syncAudio,
          sync_documents: generalConfig.syncDocuments,
          folder_structure: generalConfig.folderStructure,
          notification_on_error: generalConfig.notificationOnError,
          notification_on_success: generalConfig.notificationOnSuccess,
        }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Configurações gerais salvas!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuthorizeGoogle = async () => {
    toast.info("Iniciando autenticação OAuth...");
    try {
      localStorage.setItem("google_oauth_account_label", newGoogleLabel.trim() || "Drive Principal");
      const { data, error } = await supabase.functions.invoke("google-oauth", {
        body: {
          action: "authorize",
          redirectUri: `${window.location.origin}/oauth/callback`,
          accountLabel: newGoogleLabel.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao iniciar autenticação");
    }
  };

  const handleWhatsAppConnected = async () => {
    await loadConfig();
    toast.success("Conexão WhatsApp atualizada!");
  };

  const handleDisconnectWhatsApp = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from("whatsapp_connections")
        .update({
          status: "disconnected",
          twilio_account_sid: null,
          twilio_auth_token: null,
          twilio_whatsapp_number: null,
          connected_at: null,
        })
        .eq("id", connectionId);
      if (error) throw error;
      await loadConfig();
      toast.success("Número WhatsApp desconectado.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao desconectar WhatsApp");
    }
  };

  const handleDisconnectGoogle = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from("google_drive_accounts")
        .update({
          status: "disconnected",
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          connected_at: null,
        })
        .eq("id", accountId);
      if (error) throw error;
      await loadConfig();
      toast.success("Conta Google Drive desconectada.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao desconectar conta Google");
    }
  };

  const handleRefreshGoogleAccount = async (accountId: string) => {
    setIsRefreshingGoogle(accountId);
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth", {
        body: { action: "refresh", accountId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao renovar token");
      await loadConfig();
      toast.success("Token Google renovado!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao renovar token Google");
    } finally {
      setIsRefreshingGoogle(null);
    }
  };

  const handleSaveGoogleFolder = async (accountId: string) => {
    const folderPath = (folderDrafts[accountId] || "").trim() || "/SwiftWapDrive";
    try {
      const { error } = await supabase
        .from("google_drive_accounts")
        .update({ root_folder_path: folderPath })
        .eq("id", accountId);
      if (error) throw error;
      await loadConfig();
      toast.success("Pasta raiz atualizada.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar pasta raiz");
    }
  };

  const handleCreateRoutingRule = async () => {
    if (!user) return;
    if (!newRule.whatsappConnectionId || !newRule.googleDriveAccountId) {
      toast.error("Selecione o número WhatsApp e a conta Google Drive.");
      return;
    }

    try {
      if (newRule.isDefault) {
        await supabase
          .from("media_routing_rules")
          .update({ is_default: false })
          .eq("user_id", user.id)
          .eq("whatsapp_connection_id", newRule.whatsappConnectionId);
      }

      const payload = {
        user_id: user.id,
        whatsapp_connection_id: newRule.whatsappConnectionId,
        google_drive_account_id: newRule.googleDriveAccountId,
        file_type: newRule.fileType === "all" ? null : newRule.fileType,
        is_default: newRule.isDefault || newRule.fileType === "all",
        is_active: true,
      };

      const { error } = await supabase.from("media_routing_rules").insert(payload);
      if (error) throw error;

      setNewRule({
        whatsappConnectionId: "",
        googleDriveAccountId: "",
        fileType: "all",
        isDefault: false,
      });
      await loadConfig();
      toast.success("Regra de roteamento criada.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar regra de roteamento");
    }
  };

  const handleToggleRoutingRule = async (ruleId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from("media_routing_rules")
        .update({ is_active: active })
        .eq("id", ruleId);
      if (error) throw error;
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar regra");
    }
  };

  const handleDeleteRoutingRule = async (ruleId: string) => {
    try {
      const { error } = await supabase.from("media_routing_rules").delete().eq("id", ruleId);
      if (error) throw error;
      await loadConfig();
      toast.success("Regra removida.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover regra");
    }
  };

  const statusBadge = (status: string) => {
    if (status === "connected") return <Badge className="bg-primary/10 text-primary border-primary/20">Conectado</Badge>;
    if (status === "pending") return <Badge variant="secondary">Pendente</Badge>;
    if (status === "error") return <Badge variant="destructive">Erro</Badge>;
    return <Badge variant="outline">Desconectado</Badge>;
  };

  const ruleTypeLabel = (fileType: (typeof routingRules)[number]["file_type"]) => {
    if (!fileType) return "Todos os tipos";
    if (fileType === "image") return "Imagens";
    if (fileType === "video") return "Vídeos";
    if (fileType === "audio") return "Áudios";
    return "Documentos";
  };

  const whatsappLabelById = (id: string) =>
    whatsappConnections.find((item) => item.id === id)?.label ||
    whatsappConnections.find((item) => item.id === id)?.twilio_whatsapp_number ||
    whatsappConnections.find((item) => item.id === id)?.phone_number_id ||
    id;

  const googleLabelById = (id: string) =>
    googleAccounts.find((item) => item.id === id)?.label ||
    googleAccounts.find((item) => item.id === id)?.account_email ||
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Gerencie múltiplos números WhatsApp, contas Google Drive e regras de roteamento.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 overflow-x-auto">
          <TabsTrigger value="whatsapp" className="gap-2">
            <FaWhatsapp className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2">
            <FaGoogleDrive className="h-4 w-4" />
            <span className="hidden sm:inline">Google Drive</span>
          </TabsTrigger>
          <TabsTrigger value="routing" className="gap-2">
            <LinkIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Roteamento</span>
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <FolderTree className="h-4 w-4" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Números WhatsApp</CardTitle>
              {/* Remover completamente o alerta de limite de conexões WhatsApp */}
              {/* O Plano Essencial inclui 1 número WhatsApp — sem alerta de limite */}
            </CardHeader>
            <CardContent className="space-y-4">
              <WhatsAppConnectButton onSuccess={handleWhatsAppConnected} currentStatus={"disconnected"} />
              <div className="space-y-3">
                {whatsappConnections.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum número conectado.</p>
                )}
                {whatsappConnections.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.label || `WhatsApp ${(item.twilio_whatsapp_number || item.phone_number_id).slice(-4)}`}</p>
                        <p className="text-xs text-muted-foreground">
                          Número atribuído: {item.twilio_whatsapp_number || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Seu número: {item.customer_phone_number || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Subaccount: ...{item.twilio_subaccount_sid?.slice(-6) || "------"}
                        </p>
                      </div>
                      {statusBadge(item.status)}
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleDisconnectWhatsApp(item.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Desconectar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="google" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contas Google Drive</CardTitle>
              {/* Remover completamente o alerta de limite de conexões Google Drive */}
              {/* O Plano Essencial inclui 1 Google Drive — sem alerta de limite */}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  placeholder="Rótulo da nova conta (ex: Financeiro)"
                  value={newGoogleLabel}
                  onChange={(event) => setNewGoogleLabel(event.target.value)}
                />
                <Button onClick={handleAuthorizeGoogle}>
                  <Shield className="mr-2 h-4 w-4" />
                  Conectar Google Drive
                </Button>
              </div>

              <div className="space-y-3">
                {googleAccounts.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma conta Google Drive conectada.</p>
                )}
                {googleAccounts.map((account) => (
                  <div key={account.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{account.label || "Conta Google Drive"}</p>
                        <p className="text-xs text-muted-foreground">{account.account_email || "Email não identificado"}</p>
                      </div>
                      {statusBadge(account.status)}
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <Input
                        value={folderDrafts[account.id] || "/SwiftWapDrive"}
                        onChange={(event) =>
                          setFolderDrafts((prev) => ({ ...prev, [account.id]: event.target.value }))
                        }
                        placeholder="/SwiftWapDrive"
                      />
                      <Button variant="outline" onClick={() => handleSaveGoogleFolder(account.id)}>
                        Salvar pasta
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleRefreshGoogleAccount(account.id)}
                        disabled={isRefreshingGoogle === account.id}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshingGoogle === account.id ? "animate-spin" : ""}`} />
                        Renovar token
                      </Button>
                      <Button variant="destructive" onClick={() => handleDisconnectGoogle(account.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Desconectar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Regras de roteamento</CardTitle>
              <CardDescription>
                Defina para qual conta Google cada número WhatsApp envia mídias, por tipo de arquivo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Número WhatsApp</Label>
                  <Select
                    value={newRule.whatsappConnectionId}
                    onValueChange={(value) =>
                      setNewRule((prev) => ({ ...prev, whatsappConnectionId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {whatsappConnections.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label || item.twilio_whatsapp_number || item.phone_number_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conta Google Drive</Label>
                  <Select
                    value={newRule.googleDriveAccountId}
                    onValueChange={(value) =>
                      setNewRule((prev) => ({ ...prev, googleDriveAccountId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {googleAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.label || account.account_email || account.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de arquivo</Label>
                  <Select
                    value={newRule.fileType}
                    onValueChange={(value) =>
                      setNewRule((prev) => ({ ...prev, fileType: value as RuleFileType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="image">Imagens</SelectItem>
                      <SelectItem value="video">Vídeos</SelectItem>
                      <SelectItem value="audio">Áudios</SelectItem>
                      <SelectItem value="document">Documentos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <Label>Marcar como regra padrão</Label>
                  <Switch
                    checked={newRule.isDefault}
                    onCheckedChange={(checked) => setNewRule((prev) => ({ ...prev, isDefault: checked }))}
                  />
                </div>
              </div>
              <Button onClick={handleCreateRoutingRule}>
                <LinkIcon className="mr-2 h-4 w-4" />
                Criar regra
              </Button>

              <div className="space-y-3 pt-2">
                {routingRules.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma regra criada.</p>
                )}
                {routingRules.map((rule) => (
                  <div key={rule.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{whatsappLabelById(rule.whatsapp_connection_id)} {"->"} {googleLabelById(rule.google_drive_account_id)}</p>
                        <p className="text-xs text-muted-foreground">{ruleTypeLabel(rule.file_type)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {rule.is_default && <Badge>Padrão</Badge>}
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) => handleToggleRoutingRule(rule.id, checked)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRoutingRule(rule.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sincronização</CardTitle>
              <CardDescription>Configure quais tipos de mídia serão sincronizados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sincronização automática</Label>
                  <p className="text-xs text-muted-foreground">Sincroniza automaticamente ao receber mídias</p>
                </div>
                <Switch
                  checked={generalConfig.autoSyncEnabled}
                  onCheckedChange={(checked) => setGeneralConfig((prev) => ({ ...prev, autoSyncEnabled: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Sincronizar imagens</Label>
                <Switch
                  checked={generalConfig.syncImages}
                  onCheckedChange={(checked) => setGeneralConfig((prev) => ({ ...prev, syncImages: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Sincronizar vídeos</Label>
                <Switch
                  checked={generalConfig.syncVideos}
                  onCheckedChange={(checked) => setGeneralConfig((prev) => ({ ...prev, syncVideos: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Sincronizar áudios</Label>
                <Switch
                  checked={generalConfig.syncAudio}
                  onCheckedChange={(checked) => setGeneralConfig((prev) => ({ ...prev, syncAudio: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Sincronizar documentos</Label>
                <Switch
                  checked={generalConfig.syncDocuments}
                  onCheckedChange={(checked) => setGeneralConfig((prev) => ({ ...prev, syncDocuments: checked }))}
                />
              </div>

              <div className="pt-4">
                <Button onClick={handleSaveGeneral} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notificações</CardTitle>
              <CardDescription>Configure quando receber notificações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label>Notificar em erros</Label>
                <Switch
                  checked={generalConfig.notificationOnError}
                  onCheckedChange={(checked) =>
                    setGeneralConfig((prev) => ({ ...prev, notificationOnError: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Notificar em sucesso</Label>
                <Switch
                  checked={generalConfig.notificationOnSuccess}
                  onCheckedChange={(checked) =>
                    setGeneralConfig((prev) => ({ ...prev, notificationOnSuccess: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consumo do mês</CardTitle>
              <CardDescription>
                Plano Essencial — 200 mídias inclusas | R$ 0,10 por mídia excedente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Mídias processadas</span>
                <span className="font-semibold">
                  {subscription?.files_used_current_month ?? 0}
                  {" "}/{" "}
                  {subscription?.monthly_file_limit ?? 200} inclusas
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((subscription?.files_used_current_month ?? 0) /
                        (subscription?.monthly_file_limit ?? 200)) *
                        100,
                    )}%`,
                  }}
                />
              </div>
              {(subscription?.files_used_current_month ?? 0) > (subscription?.monthly_file_limit ?? 200) && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  <strong>Excedente ativo:</strong>{" "}
                  {(subscription?.files_used_current_month ?? 0) - (subscription?.monthly_file_limit ?? 200)} mídias extras
                  {" "}= R${" "}
                  {(
                    ((subscription?.files_used_current_month ?? 0) -
                      (subscription?.monthly_file_limit ?? 200)) *
                    0.1
                  ).toFixed(2).replace(".", ",")} adicionais este mês
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                O contador é zerado automaticamente a cada ciclo mensal.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

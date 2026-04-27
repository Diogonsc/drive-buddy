import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { WhatsAppConnectButton } from "@/components/whatsapp/WhatsAppConnectButton";
import {
  MessageSquare,
  HardDrive,
  FolderTree,
  Save,
  Loader2,
  Shield,
  Link as LinkIcon,
  RefreshCw,
  Trash2,
} from "lucide-react";

const VALID_TABS = ["whatsapp", "google", "routing", "general"] as const;
type SettingsTab = (typeof VALID_TABS)[number];
type ConnectionStatus = "connected" | "disconnected" | "pending" | "error";
type RuleFileType = "image" | "video" | "audio" | "document" | "all";

interface SubscriptionInfo {
  plan: string;
  monthly_file_limit: number | null;
  files_used_current_month: number | null;
  whatsapp_numbers_limit: number;
  google_accounts_limit: number;
}

interface WhatsAppConnection {
  id: string;
  label: string | null;
  phone_number_id: string;
  twilio_account_sid: string | null;
  twilio_whatsapp_number: string | null;
  status: ConnectionStatus;
  connected_at: string | null;
}

interface GoogleDriveAccount {
  id: string;
  label: string | null;
  account_email: string | null;
  status: ConnectionStatus;
  connected_at: string | null;
  root_folder_path: string;
}

interface RoutingRule {
  id: string;
  whatsapp_connection_id: string;
  google_drive_account_id: string;
  file_type: "image" | "video" | "audio" | "document" | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingGoogle, setIsRefreshingGoogle] = useState<string | null>(null);

  const [newGoogleLabel, setNewGoogleLabel] = useState("");
  const [folderDrafts, setFolderDrafts] = useState<Record<string, string>>({});
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [whatsappConnections, setWhatsappConnections] = useState<WhatsAppConnection[]>([]);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleDriveAccount[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
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
        { data: waData },
        { data: googleData },
        { data: rulesData },
      ] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("plan, monthly_file_limit, files_used_current_month, whatsapp_numbers_limit, google_accounts_limit")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("whatsapp_connections")
          .select("id, label, phone_number_id, twilio_account_sid, twilio_whatsapp_number, status, connected_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("google_drive_accounts")
          .select("id, label, account_email, status, connected_at, root_folder_path")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("media_routing_rules")
          .select("id, whatsapp_connection_id, google_drive_account_id, file_type, is_default, is_active, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (subscriptionData) {
        setSubscription({
          plan: subscriptionData.plan || "starter",
          monthly_file_limit: subscriptionData.monthly_file_limit,
          files_used_current_month: subscriptionData.files_used_current_month,
          whatsapp_numbers_limit: subscriptionData.whatsapp_numbers_limit || 1,
          google_accounts_limit: subscriptionData.google_accounts_limit || 1,
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

      const waRows = (waData || []) as unknown as WhatsAppConnection[];
      const googleRows = (googleData || []) as unknown as GoogleDriveAccount[];
      const ruleRows = (rulesData || []) as unknown as RoutingRule[];

      setWhatsappConnections(waRows);
      setGoogleAccounts(googleRows);
      setRoutingRules(ruleRows);
      setFolderDrafts(
        Object.fromEntries(
          googleRows.map((account) => [account.id, account.root_folder_path || "/WhatsApp Uploads"]),
        ),
      );
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

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
    const folderPath = (folderDrafts[accountId] || "").trim() || "/WhatsApp Uploads";
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

  const ruleTypeLabel = (fileType: RoutingRule["file_type"]) => {
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

  if (isLoading) {
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
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2">
            <HardDrive className="h-4 w-4" />
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
              <CardDescription>
                Limite do plano: {connectedWhatsAppCount}/{subscription?.whatsapp_numbers_limit ?? 1} conectados/pendentes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WhatsAppConnectButton onSuccess={handleWhatsAppConnected} currentStatus={"disconnected"} />
              {connectedWhatsAppCount >= (subscription?.whatsapp_numbers_limit ?? 1) && (
                <Alert>
                  <AlertTitle>Limite do plano atingido</AlertTitle>
                  <AlertDescription>
                    Faça upgrade para conectar mais números WhatsApp.
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-3">
                {whatsappConnections.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum número conectado.</p>
                )}
                {whatsappConnections.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.label || `WhatsApp ${(item.twilio_whatsapp_number || item.phone_number_id).slice(-4)}`}</p>
                        <p className="text-xs text-muted-foreground">{item.twilio_whatsapp_number || item.phone_number_id}</p>
                        <p className="text-xs text-muted-foreground">
                          SID: ...{item.twilio_account_sid?.slice(-4) || "----"}
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
              <CardDescription>
                Limite do plano: {connectedGoogleCount}/{subscription?.google_accounts_limit ?? 1} conectadas/pendentes
              </CardDescription>
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
                        value={folderDrafts[account.id] || "/WhatsApp Uploads"}
                        onChange={(event) =>
                          setFolderDrafts((prev) => ({ ...prev, [account.id]: event.target.value }))
                        }
                        placeholder="/WhatsApp Uploads"
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
              <div className="grid gap-3 md:grid-cols-2">
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
              <CardTitle>Consumo do plano</CardTitle>
              <CardDescription>Acompanhamento de arquivos processados no ciclo atual.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span>Plano atual: <strong>{subscription?.plan || "starter"}</strong></span>
                <span>
                  {subscription?.files_used_current_month ?? 0} / {subscription?.monthly_file_limit ?? "ilimitado"} arquivos
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

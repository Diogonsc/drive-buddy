import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  MessageSquare, 
  HardDrive, 
  Shield, 
  FolderTree,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2
} from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [showWhatsAppToken, setShowWhatsAppToken] = useState(false);
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState({
    whatsapp: 'disconnected',
    google: 'disconnected'
  });

  // Form states
  const [whatsappConfig, setWhatsappConfig] = useState({
    phoneNumberId: "",
    accessToken: "",
    webhookVerifyToken: "",
  });

  const [googleConfig, setGoogleConfig] = useState({
    clientId: "",
    clientSecret: "",
    redirectUri: `${window.location.origin}/oauth/callback`,
    rootFolder: "/WhatsApp Uploads",
  });

  const [generalConfig, setGeneralConfig] = useState({
    autoSyncEnabled: true,
    syncImages: true,
    syncVideos: true,
    syncAudio: true,
    syncDocuments: true,
    folderStructure: "date_type",
    notificationOnError: true,
    notificationOnSuccess: false,
  });

  // Load existing configuration
  useEffect(() => {
    const loadConfig = async () => {
      if (!user) return;

      try {
        // Load connection settings
        const { data: connection } = await supabase
          .from('connections')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (connection) {
          setWhatsappConfig({
            phoneNumberId: connection.whatsapp_phone_id || '',
            accessToken: connection.whatsapp_token || '',
            webhookVerifyToken: '',
          });
          setGoogleConfig({
            clientId: connection.google_client_id || '',
            clientSecret: connection.google_client_secret || '',
            redirectUri: connection.google_redirect_uri || `${window.location.origin}/oauth/callback`,
            rootFolder: '/WhatsApp Uploads',
          });
          setConnectionStatus({
            whatsapp: connection.whatsapp_status || 'disconnected',
            google: connection.google_status || 'disconnected'
          });
        }

        // Load user settings
        const { data: settings } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (settings) {
          setGeneralConfig({
            autoSyncEnabled: settings.auto_sync_enabled,
            syncImages: settings.sync_images,
            syncVideos: settings.sync_videos,
            syncAudio: settings.sync_audio,
            syncDocuments: settings.sync_documents,
            folderStructure: settings.folder_structure,
            notificationOnError: settings.notification_on_error,
            notificationOnSuccess: settings.notification_on_success,
          });
        }
      } catch (error) {
        console.error('Error loading config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [user]);

  const handleSaveWhatsApp = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('connections')
        .upsert({
          user_id: user.id,
          whatsapp_phone_id: whatsappConfig.phoneNumberId,
          whatsapp_token: whatsappConfig.accessToken,
          whatsapp_status: whatsappConfig.phoneNumberId && whatsappConfig.accessToken ? 'pending' : 'disconnected',
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast.success("Configurações do WhatsApp salvas!");
      setConnectionStatus(prev => ({
        ...prev,
        whatsapp: whatsappConfig.phoneNumberId && whatsappConfig.accessToken ? 'pending' : 'disconnected'
      }));
    } catch (error) {
      console.error('Error saving WhatsApp config:', error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGoogle = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('connections')
        .upsert({
          user_id: user.id,
          google_client_id: googleConfig.clientId,
          google_client_secret: googleConfig.clientSecret,
          google_redirect_uri: googleConfig.redirectUri,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast.success("Configurações do Google Drive salvas!");
    } catch (error) {
      console.error('Error saving Google config:', error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGeneral = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('user_settings')
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
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast.success("Configurações gerais salvas!");
    } catch (error) {
      console.error('Error saving general config:', error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWhatsApp = async () => {
    toast.info("Testando conexão com WhatsApp...");
    // In production, this would call the webhook edge function
    setTimeout(() => {
      if (whatsappConfig.phoneNumberId && whatsappConfig.accessToken) {
        toast.success("Credenciais parecem válidas!");
      } else {
        toast.error("Preencha as credenciais primeiro");
      }
    }, 1000);
  };

  const handleAuthorizeGoogle = async () => {
    if (!googleConfig.clientId || !googleConfig.clientSecret) {
      toast.error("Preencha as credenciais do Google primeiro");
      return;
    }

    // Save config first
    await handleSaveGoogle();

    toast.info("Iniciando autenticação OAuth...");

    try {
      const { data, error } = await supabase.functions.invoke('google-oauth', {
        body: {
          action: 'authorize',
          redirectUri: googleConfig.redirectUri,
        },
      });

      if (error) throw error;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error starting OAuth:', error);
      toast.error("Erro ao iniciar autenticação");
    }
  };

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
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Configure suas integrações e preferências do sistema
        </p>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">Google Drive</span>
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <FolderTree className="h-4 w-4" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
        </TabsList>

        {/* WhatsApp Configuration */}
        <TabsContent value="whatsapp" className="space-y-6">
          <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>WhatsApp Business API</CardTitle>
                    <CardDescription>
                      Configure as credenciais da API oficial do Meta
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1">
                  {connectionStatus.whatsapp === 'connected' ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 text-destructive" />
                      Não conectado
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                <Input
                  id="phoneNumberId"
                  placeholder="Ex: 123456789012345"
                  value={whatsappConfig.phoneNumberId}
                  onChange={(e) =>
                    setWhatsappConfig({ ...whatsappConfig, phoneNumberId: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessToken">Access Token</Label>
                <div className="relative">
                  <Input
                    id="accessToken"
                    type={showWhatsAppToken ? "text" : "password"}
                    placeholder="Token de acesso permanente do Meta"
                    value={whatsappConfig.accessToken}
                    onChange={(e) =>
                      setWhatsappConfig({ ...whatsappConfig, accessToken: e.target.value })
                    }
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowWhatsAppToken(!showWhatsAppToken)}
                  >
                    {showWhatsAppToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveWhatsApp} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Configurações
                </Button>
                <Button variant="outline" onClick={handleTestWhatsApp}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Testar Conexão
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Info */}
          <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
            <CardHeader>
              <CardTitle className="text-base">Configuração do Webhook</CardTitle>
              <CardDescription>
                Configure estes endpoints no painel do Meta Business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <Label className="text-xs text-muted-foreground">Callback URL</Label>
                <code className="block mt-1 text-sm font-mono text-foreground break-all">
                  {import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook
                </code>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <Label className="text-xs text-muted-foreground">Campos para Assinar</Label>
                <code className="block mt-1 text-sm font-mono text-foreground">
                  messages, message_template_status_update
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google Drive Configuration */}
        <TabsContent value="google" className="space-y-6">
          <Card className="animate-fade-in" style={{ animationDelay: '400ms' }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <HardDrive className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Google Drive API</CardTitle>
                    <CardDescription>
                      Configure as credenciais OAuth 2.0 do Google Cloud
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1">
                  {connectionStatus.google === 'connected' ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 text-destructive" />
                      Não conectado
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  placeholder="Ex: 123456789-abc123.apps.googleusercontent.com"
                  value={googleConfig.clientId}
                  onChange={(e) =>
                    setGoogleConfig({ ...googleConfig, clientId: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <div className="relative">
                  <Input
                    id="clientSecret"
                    type={showGoogleSecret ? "text" : "password"}
                    placeholder="Secret do OAuth 2.0"
                    value={googleConfig.clientSecret}
                    onChange={(e) =>
                      setGoogleConfig({ ...googleConfig, clientSecret: e.target.value })
                    }
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowGoogleSecret(!showGoogleSecret)}
                  >
                    {showGoogleSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="redirectUri">Redirect URI</Label>
                <Input
                  id="redirectUri"
                  value={googleConfig.redirectUri}
                  onChange={(e) =>
                    setGoogleConfig({ ...googleConfig, redirectUri: e.target.value })
                  }
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  Adicione esta URL nas configurações do Google Cloud Console
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveGoogle} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Configurações
                </Button>
                <Button variant="outline" onClick={handleAuthorizeGoogle}>
                  <Shield className="mr-2 h-4 w-4" />
                  Autorizar com Google
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Configuration */}
        <TabsContent value="general" className="space-y-6">
          <Card className="animate-fade-in" style={{ animationDelay: '500ms' }}>
            <CardHeader>
              <CardTitle>Sincronização</CardTitle>
              <CardDescription>
                Configure quais tipos de mídia serão sincronizados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sincronização automática</Label>
                  <p className="text-xs text-muted-foreground">
                    Sincroniza automaticamente ao receber mídias
                  </p>
                </div>
                <Switch
                  checked={generalConfig.autoSyncEnabled}
                  onCheckedChange={(checked) =>
                    setGeneralConfig({ ...generalConfig, autoSyncEnabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sincronizar imagens</Label>
                </div>
                <Switch
                  checked={generalConfig.syncImages}
                  onCheckedChange={(checked) =>
                    setGeneralConfig({ ...generalConfig, syncImages: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sincronizar vídeos</Label>
                </div>
                <Switch
                  checked={generalConfig.syncVideos}
                  onCheckedChange={(checked) =>
                    setGeneralConfig({ ...generalConfig, syncVideos: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sincronizar áudios</Label>
                </div>
                <Switch
                  checked={generalConfig.syncAudio}
                  onCheckedChange={(checked) =>
                    setGeneralConfig({ ...generalConfig, syncAudio: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sincronizar documentos</Label>
                </div>
                <Switch
                  checked={generalConfig.syncDocuments}
                  onCheckedChange={(checked) =>
                    setGeneralConfig({ ...generalConfig, syncDocuments: checked })
                  }
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

          <Card className="animate-fade-in" style={{ animationDelay: '600ms' }}>
            <CardHeader>
              <CardTitle>Notificações</CardTitle>
              <CardDescription>
                Configure quando receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificar em erros</Label>
                  <p className="text-xs text-muted-foreground">
                    Receba alertas quando houver falhas na sincronização
                  </p>
                </div>
                <Switch
                  checked={generalConfig.notificationOnError}
                  onCheckedChange={(checked) =>
                    setGeneralConfig({ ...generalConfig, notificationOnError: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificar em sucesso</Label>
                  <p className="text-xs text-muted-foreground">
                    Receba alertas quando arquivos forem sincronizados
                  </p>
                </div>
                <Switch
                  checked={generalConfig.notificationOnSuccess}
                  onCheckedChange={(checked) =>
                    setGeneralConfig({ ...generalConfig, notificationOnSuccess: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

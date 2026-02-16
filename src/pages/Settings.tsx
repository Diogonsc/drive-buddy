import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
} from "lucide-react";

const VALID_TABS = ['whatsapp', 'google', 'general'] as const;
type SettingsTab = (typeof VALID_TABS)[number];

export default function Settings() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (VALID_TABS.includes(searchParams.get('tab') as SettingsTab)
    ? searchParams.get('tab')
    : 'whatsapp') as SettingsTab;

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState({
    whatsapp: 'disconnected',
    google: 'disconnected'
  });
  const [whatsappDetails, setWhatsappDetails] = useState({
    phoneNumberId: '',
    wabaId: '',
  });

  const [googleConfig, setGoogleConfig] = useState({
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
        const { data: connection } = await supabase
          .from('connections')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (connection) {
          setConnectionStatus({
            whatsapp: connection.whatsapp_status || 'disconnected',
            google: connection.google_status || 'disconnected'
          });
          setWhatsappDetails({
            phoneNumberId: connection.whatsapp_phone_number_id || '',
            wabaId: connection.whatsapp_business_account_id || '',
          });
          setGoogleConfig({
            redirectUri: connection.google_redirect_uri || `${window.location.origin}/oauth/callback`,
            rootFolder: '/WhatsApp Uploads',
          });
        }

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

  const handleAuthorizeGoogle = async () => {
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

  const handleWhatsAppConnected = (data: any) => {
    setConnectionStatus(prev => ({ ...prev, whatsapp: data.status || 'connected' }));
    setWhatsappDetails({
      phoneNumberId: data.phone_number_id || '',
      wabaId: data.waba_id || '',
    });
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      const { error } = await supabase.functions.invoke('whatsapp-embedded-signup', {
        body: { action: 'disconnect' },
      });

      if (error) throw error;

      setConnectionStatus(prev => ({ ...prev, whatsapp: 'disconnected' }));
      setWhatsappDetails({ phoneNumberId: '', wabaId: '' });
      toast.success("WhatsApp desconectado.");
    } catch (err) {
      toast.error("Erro ao desconectar WhatsApp");
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Configure suas integrações e preferências do sistema
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
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

        {/* WhatsApp Configuration — Embedded Signup */}
        <TabsContent value="whatsapp" className="space-y-6">
          <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>WhatsApp Business</CardTitle>
                    <CardDescription>
                      Conecte sua conta do WhatsApp Business em 1 clique
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
              {connectionStatus.whatsapp === 'connected' ? (
                <div className="space-y-4">
                  <Alert className="border-primary/30 bg-primary/5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertTitle>WhatsApp conectado</AlertTitle>
                    <AlertDescription>
                      Sua conta está recebendo mídias automaticamente. O webhook foi configurado pelo sistema.
                    </AlertDescription>
                  </Alert>

                  {(whatsappDetails.phoneNumberId || whatsappDetails.wabaId) && (
                    <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                      {whatsappDetails.phoneNumberId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone Number ID:</span>
                          <code className="text-xs bg-background px-2 py-0.5 rounded">{whatsappDetails.phoneNumberId}</code>
                        </div>
                      )}
                      {whatsappDetails.wabaId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">WABA ID:</span>
                          <code className="text-xs bg-background px-2 py-0.5 rounded">{whatsappDetails.wabaId}</code>
                        </div>
                      )}
                    </div>
                  )}

                  <Button variant="destructive" size="sm" onClick={handleDisconnectWhatsApp}>
                    Desconectar WhatsApp
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Conecte sua conta do WhatsApp Business de forma automática. 
                    O sistema irá configurar o webhook, registrar o número e iniciar o recebimento de mídias — tudo sem sair do app.
                  </p>
                  <WhatsAppConnectButton
                    onSuccess={handleWhatsAppConnected}
                    currentStatus={connectionStatus.whatsapp as any}
                  />
                </div>
              )}
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
                    <CardTitle>Google Drive</CardTitle>
                    <CardDescription>
                      Conecte sua conta para salvar mídias automaticamente
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
              {connectionStatus.google === 'connected' ? (
                <Alert className="border-primary/30 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertTitle>Google Drive conectado</AlertTitle>
                  <AlertDescription>
                    Suas mídias serão salvas automaticamente na pasta <code>/WhatsApp Uploads</code>.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Clique no botão abaixo para autorizar o acesso ao Google Drive.
                    Suas credenciais são gerenciadas de forma segura pelo sistema.
                  </p>
                  <Button onClick={handleAuthorizeGoogle} className="w-full sm:w-auto">
                    <Shield className="mr-2 h-4 w-4" />
                    Conectar Google Drive
                  </Button>
                </div>
              )}

              <div className="rounded-lg bg-muted p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Pasta de destino</p>
                <code className="text-sm font-mono text-foreground">{googleConfig.rootFolder}</code>
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

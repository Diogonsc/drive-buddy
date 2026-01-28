import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  MessageSquare, 
  HardDrive, 
  Key, 
  Shield, 
  FolderTree,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  RefreshCw
} from "lucide-react";

export default function Settings() {
  const [showWhatsAppToken, setShowWhatsAppToken] = useState(false);
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [whatsappConfig, setWhatsappConfig] = useState({
    phoneNumberId: "",
    accessToken: "",
    webhookVerifyToken: "",
    businessAccountId: "",
  });

  const [googleConfig, setGoogleConfig] = useState({
    clientId: "",
    clientSecret: "",
    redirectUri: "",
    rootFolder: "/WhatsApp Uploads",
  });

  const [generalConfig, setGeneralConfig] = useState({
    autoCreateFolders: true,
    organizeByDate: true,
    organizeByType: true,
    organizeByContact: false,
    maxFileSize: 25,
    enableNotifications: true,
  });

  const handleSaveWhatsApp = async () => {
    setIsSaving(true);
    // Simulated save - will be replaced with Supabase
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Configurações do WhatsApp salvas!");
    }, 1000);
  };

  const handleSaveGoogle = async () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Configurações do Google Drive salvas!");
    }, 1000);
  };

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Configurações gerais salvas!");
    }, 1000);
  };

  const handleTestWhatsApp = () => {
    toast.info("Testando conexão com WhatsApp...");
    setTimeout(() => {
      toast.success("Conexão com WhatsApp validada!");
    }, 2000);
  };

  const handleTestGoogle = () => {
    toast.info("Iniciando autenticação OAuth...");
  };

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
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                        <MessageSquare className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <CardTitle>WhatsApp Business API</CardTitle>
                        <CardDescription>
                          Configure as credenciais da API oficial do Meta
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <XCircle className="h-3 w-3 text-destructive" />
                      Não conectado
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
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
                      <Label htmlFor="businessAccountId">Business Account ID</Label>
                      <Input
                        id="businessAccountId"
                        placeholder="Ex: 987654321098765"
                        value={whatsappConfig.businessAccountId}
                        onChange={(e) =>
                          setWhatsappConfig({ ...whatsappConfig, businessAccountId: e.target.value })
                        }
                      />
                    </div>
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

                  <div className="space-y-2">
                    <Label htmlFor="webhookVerifyToken">Webhook Verify Token</Label>
                    <Input
                      id="webhookVerifyToken"
                      placeholder="Token personalizado para validação do webhook"
                      value={whatsappConfig.webhookVerifyToken}
                      onChange={(e) =>
                        setWhatsappConfig({ ...whatsappConfig, webhookVerifyToken: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Este token será usado para verificar os webhooks recebidos do Meta
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleSaveWhatsApp} disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" />
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
                      https://seu-projeto.supabase.co/functions/v1/whatsapp-webhook
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                        <HardDrive className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle>Google Drive API</CardTitle>
                        <CardDescription>
                          Configure as credenciais OAuth 2.0 do Google Cloud
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <XCircle className="h-3 w-3 text-destructive" />
                      Não conectado
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
                      placeholder="https://seu-app.com/auth/callback"
                      value={googleConfig.redirectUri}
                      onChange={(e) =>
                        setGoogleConfig({ ...googleConfig, redirectUri: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rootFolder">Pasta Raiz no Drive</Label>
                    <Input
                      id="rootFolder"
                      placeholder="/WhatsApp Uploads"
                      value={googleConfig.rootFolder}
                      onChange={(e) =>
                        setGoogleConfig({ ...googleConfig, rootFolder: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Pasta onde os arquivos serão salvos
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleSaveGoogle} disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Configurações
                    </Button>
                    <Button variant="outline" onClick={handleTestGoogle}>
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
                  <CardTitle>Organização de Arquivos</CardTitle>
                  <CardDescription>
                    Configure como os arquivos serão organizados no Google Drive
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Criar pastas automaticamente</Label>
                      <p className="text-xs text-muted-foreground">
                        Cria pastas que não existem ao salvar arquivos
                      </p>
                    </div>
                    <Switch
                      checked={generalConfig.autoCreateFolders}
                      onCheckedChange={(checked) =>
                        setGeneralConfig({ ...generalConfig, autoCreateFolders: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Organizar por data</Label>
                      <p className="text-xs text-muted-foreground">
                        Cria subpastas por ano/mês (ex: 2026-01)
                      </p>
                    </div>
                    <Switch
                      checked={generalConfig.organizeByDate}
                      onCheckedChange={(checked) =>
                        setGeneralConfig({ ...generalConfig, organizeByDate: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Organizar por tipo</Label>
                      <p className="text-xs text-muted-foreground">
                        Separa arquivos em Imagens, Vídeos, Áudios e Documentos
                      </p>
                    </div>
                    <Switch
                      checked={generalConfig.organizeByType}
                      onCheckedChange={(checked) =>
                        setGeneralConfig({ ...generalConfig, organizeByType: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Organizar por contato</Label>
                      <p className="text-xs text-muted-foreground">
                        Cria subpastas por número do remetente
                      </p>
                    </div>
                    <Switch
                      checked={generalConfig.organizeByContact}
                      onCheckedChange={(checked) =>
                        setGeneralConfig({ ...generalConfig, organizeByContact: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-fade-in" style={{ animationDelay: '600ms' }}>
                <CardHeader>
                  <CardTitle>Limites e Notificações</CardTitle>
                  <CardDescription>
                    Configure limites de arquivos e notificações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="maxFileSize">Tamanho máximo de arquivo (MB)</Label>
                    <Input
                      id="maxFileSize"
                      type="number"
                      min={1}
                      max={100}
                      value={generalConfig.maxFileSize}
                      onChange={(e) =>
                        setGeneralConfig({
                          ...generalConfig,
                          maxFileSize: parseInt(e.target.value) || 25,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Arquivos maiores que este limite serão ignorados
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notificações de erro</Label>
                      <p className="text-xs text-muted-foreground">
                        Receba alertas quando uploads falharem
                      </p>
                    </div>
                    <Switch
                      checked={generalConfig.enableNotifications}
                      onCheckedChange={(checked) =>
                        setGeneralConfig({ ...generalConfig, enableNotifications: checked })
                      }
                    />
                  </div>

                  <div className="pt-4">
                    <Button onClick={handleSaveGeneral} disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Configurações
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
    </AppLayout>
  );
}

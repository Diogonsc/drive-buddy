import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight, 
  MessageSquare, 
  HardDrive,
  Settings,
  RefreshCw,
  Loader2
} from "lucide-react";

interface ConnectionData {
  whatsapp_status: string;
  whatsapp_phone_number_id: string | null;
  whatsapp_connected_at: string | null;
  google_status: string;
  google_connected_at: string | null;
}

export default function Connections() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connection, setConnection] = useState<ConnectionData | null>(null);

  const loadConnections = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('connections')
        .select('whatsapp_status, whatsapp_phone_number_id, whatsapp_connected_at, google_status, google_connected_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setConnection(data);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, [user]);

  const handleRefreshGoogle = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-oauth', {
        body: { action: 'refresh' },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Token do Google atualizado!");
        await loadConnections();
      } else {
        toast.error(data?.error || "Erro ao atualizar token");
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      toast.error("Erro ao atualizar token");
    } finally {
      setIsRefreshing(false);
    }
  };

  const whatsappStatus = connection?.whatsapp_status || 'disconnected';
  const googleStatus = connection?.google_status || 'disconnected';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <XCircle className="h-3 w-3 mr-1" />
            Não conectado
          </Badge>
        );
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
          Conexões
        </h1>
        <p className="text-muted-foreground">
          Gerencie suas integrações com WhatsApp e Google Drive
        </p>
      </div>

      {/* Connection Cards */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* WhatsApp Card */}
        <Card className="animate-fade-in" style={{ animationDelay: "100ms" }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">WhatsApp Business</CardTitle>
                  <CardDescription>API Oficial do Meta</CardDescription>
                </div>
              </div>
              {getStatusBadge(whatsappStatus)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {connection?.whatsapp_phone_number_id && (
              <div className="text-sm text-muted-foreground">
                Phone ID: <code className="text-foreground">{connection.whatsapp_phone_number_id}</code>
              </div>
            )}
            {connection?.whatsapp_connected_at && (
              <div className="text-xs text-muted-foreground">
                Conectado em: {new Date(connection.whatsapp_connected_at).toLocaleDateString('pt-BR')}
              </div>
            )}
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-4 w-4 mr-2" />
              {whatsappStatus === 'connected' ? 'Gerenciar' : 'Configurar'}
            </Button>
          </CardContent>
        </Card>

        {/* Google Drive Card */}
        <Card className="animate-fade-in" style={{ animationDelay: "200ms" }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <HardDrive className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Google Drive</CardTitle>
                  <CardDescription>Armazenamento em nuvem</CardDescription>
                </div>
              </div>
              {getStatusBadge(googleStatus)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {connection?.google_connected_at && (
              <div className="text-xs text-muted-foreground">
                Conectado em: {new Date(connection.google_connected_at).toLocaleDateString('pt-BR')}
              </div>
            )}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate('/settings')}
              >
                <Settings className="h-4 w-4 mr-2" />
                {googleStatus === 'connected' ? 'Gerenciar' : 'Configurar'}
              </Button>
              {googleStatus === 'connected' && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleRefreshGoogle}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection Flow */}
      <Card className="animate-fade-in" style={{ animationDelay: "300ms" }}>
        <CardHeader>
          <CardTitle>Como funciona a integração</CardTitle>
          <CardDescription>
            Entenda o fluxo de automação do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                whatsappStatus === "connected" ? "bg-primary/10" : "bg-muted"
              }`}>
                {whatsappStatus === "connected" ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <XCircle className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">1. WhatsApp recebe mídia</p>
                <p className="text-sm text-muted-foreground">Webhook processa a mensagem</p>
              </div>
            </div>

            <ArrowRight className="hidden h-5 w-5 text-muted-foreground sm:block" />

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">2. Sistema processa</p>
                <p className="text-sm text-muted-foreground">Download e validação</p>
              </div>
            </div>

            <ArrowRight className="hidden h-5 w-5 text-muted-foreground sm:block" />

            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                googleStatus === "connected" ? "bg-primary/10" : "bg-muted"
              }`}>
                {googleStatus === "connected" ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <XCircle className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">3. Salva no Drive</p>
                <p className="text-sm text-muted-foreground">Organizado automaticamente</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

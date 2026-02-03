import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConnectionsOverview } from "@/components/dashboard/ConnectionsOverview";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { FlowVisualization } from "@/components/dashboard/FlowVisualization";
import { WhatsAppStatusDetails } from "@/components/dashboard/WhatsAppStatusDetails";
import { LogEntry } from "@/components/ui/ActivityLog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface Metrics {
  totalFiles: number;
  images: number;
  videos: number;
  audios: number;
  documents: number;
  successRate: number;
  pendingFiles: number;
  storageUsed: string;
}

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [whatsappStatus, setWhatsappStatus] = useState<"connected" | "disconnected" | "pending" | "error">("disconnected");
  const [googleDriveStatus, setGoogleDriveStatus] = useState<"connected" | "disconnected" | "pending" | "error">("disconnected");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics>({
    totalFiles: 0,
    images: 0,
    videos: 0,
    audios: 0,
    documents: 0,
    successRate: 0,
    pendingFiles: 0,
    storageUsed: "0 B",
  });
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [connection, setConnection] = useState<{
    whatsapp_phone_number_id?: string;
    whatsapp_webhook_verify_token?: string;
    whatsapp_connected_at?: string;
    google_status?: string;
    whatsapp_status?: string;
  } | null>(null);
  const [lastMediaReceivedAt, setLastMediaReceivedAt] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  // Carregar conexões e status
  useEffect(() => {
    if (!user) return;

    const loadConnections = async () => {
      try {
        const { data, error } = await supabase
          .from('connections')
          .select('whatsapp_status, whatsapp_phone_number_id, whatsapp_webhook_verify_token, whatsapp_connected_at, google_status, google_connected_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setWhatsappStatus((data.whatsapp_status as any) || 'disconnected');
          setGoogleDriveStatus((data.google_status as any) || 'disconnected');
          setConnection(data);
        }

        // Buscar última mensagem de mídia recebida
        const { data: lastMedia } = await supabase
          .from('media_files')
          .select('received_at')
          .eq('user_id', user.id)
          .order('received_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastMedia) {
          setLastMediaReceivedAt(lastMedia.received_at);
        }
      } catch (error) {
        console.error('Error loading connections:', error);
      }
    };

    loadConnections();
  }, [user]);

  // Carregar métricas
  useEffect(() => {
    if (!user) return;

    const loadMetrics = async () => {
      try {
        // Buscar estatísticas dos arquivos
        const { data: filesData, error: filesError } = await supabase
          .from('media_files')
          .select('file_type, status, file_size_bytes')
          .eq('user_id', user.id);

        if (filesError) throw filesError;

        const totalFiles = filesData?.length || 0;
        const images = filesData?.filter(f => f.file_type === 'image').length || 0;
        const videos = filesData?.filter(f => f.file_type === 'video').length || 0;
        const audios = filesData?.filter(f => f.file_type === 'audio').length || 0;
        const documents = filesData?.filter(f => f.file_type === 'document').length || 0;
        const completed = filesData?.filter(f => f.status === 'completed').length || 0;
        const pending = filesData?.filter(f => f.status === 'pending' || f.status === 'processing').length || 0;
        
        const successRate = totalFiles > 0 ? (completed / totalFiles) * 100 : 0;
        
        // Calcular armazenamento total
        const totalBytes = filesData?.reduce((sum, f) => sum + (f.file_size_bytes || 0), 0) || 0;
        const storageUsed = formatBytes(totalBytes);

        setMetrics({
          totalFiles,
          images,
          videos,
          audios,
          documents,
          successRate: Math.round(successRate * 10) / 10,
          pendingFiles: pending,
          storageUsed,
        });
      } catch (error) {
        console.error('Error loading metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();
  }, [user]);

  // Carregar atividades recentes
  useEffect(() => {
    if (!user) return;

    const loadRecentActivity = async () => {
      try {
        const { data, error } = await supabase
          .from('media_files')
          .select('id, file_name, file_type, sender_phone, sender_name, status, error_message, received_at')
          .eq('user_id', user.id)
          .order('received_at', { ascending: false })
          .limit(8);

        if (error) throw error;

        const entries: LogEntry[] = (data || []).map(file => ({
          id: file.id,
          mediaType: file.file_type as any,
          fileName: file.file_name,
          sender: file.sender_phone || file.sender_name || 'Desconhecido',
          timestamp: new Date(file.received_at),
          status: mapStatus(file.status),
          errorMessage: file.error_message || undefined,
        }));

        setLogEntries(entries);
      } catch (error) {
        console.error('Error loading recent activity:', error);
      }
    };

    loadRecentActivity();
  }, [user]);

  const handleConnectWhatsApp = () => {
    // Se está pending, verificar/atualizar o status (pode ter mudado após receber primeira mensagem)
    if (whatsappStatus === 'pending') {
      handleRefreshWhatsAppStatus();
      return;
    }
    if (whatsappStatus === 'connected') {
      // Se já está conectado, ir para gerenciar
      navigate('/settings?tab=whatsapp');
      return;
    }
    // Se desconectado ou erro, ir para configurar
    navigate('/settings?tab=whatsapp');
  };

  const handleRefreshWhatsAppStatus = async () => {
    if (!user) return;
    setIsRefreshing(true);

    try {
      // Chama a API para validar credenciais na Meta e atualizar status no banco
      const { data: verifyData } = await supabase.functions.invoke('whatsapp-verify-status');

      // Refetch da connection para obter o status atualizado
      const { data, error } = await supabase
        .from('connections')
        .select('whatsapp_status, whatsapp_phone_number_id, whatsapp_webhook_verify_token, whatsapp_connected_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setWhatsappStatus((data.whatsapp_status as any) || 'disconnected');
        setConnection(prev => ({ ...prev, ...data }));
      }

      // Buscar última mensagem
      const { data: lastMedia } = await supabase
        .from('media_files')
        .select('received_at')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastMedia) {
        setLastMediaReceivedAt(lastMedia.received_at);
      }

      if (verifyData?.success) {
        toast.success(verifyData.verified_name || verifyData.display_phone_number ? `Conectado: ${verifyData.verified_name || verifyData.display_phone_number}` : "WhatsApp conectado com sucesso!");
      } else if (verifyData?.error) {
        toast.error(verifyData.error);
      } else {
        toast.success("Status atualizado!");
      }
    } catch (error) {
      console.error('Error refreshing WhatsApp status:', error);
      toast.error("Erro ao atualizar status");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    if (!user) return;

    try {
      // Verificar se já tem credenciais configuradas
      const { data: connData } = await supabase
        .from('connections')
        .select('google_client_id, google_client_secret')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!connData?.google_client_id || !connData?.google_client_secret) {
        toast.error("Configure as credenciais do Google primeiro nas Configurações");
        navigate('/settings?tab=google');
        return;
      }

      // Iniciar OAuth
      const { data, error } = await supabase.functions.invoke('google-oauth', {
        body: {
          action: 'authorize',
          redirectUri: `${window.location.origin}/oauth/callback`,
        },
      });

      if (error) throw error;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error connecting Google Drive:', error);
      toast.error("Erro ao conectar Google Drive");
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Recarregar métricas e atividades
      const { data: filesData } = await supabase
        .from('media_files')
        .select('file_type, status, file_size_bytes')
        .eq('user_id', user!.id);

      const { data: recentData } = await supabase
        .from('media_files')
        .select('id, file_name, file_type, sender_phone, sender_name, status, error_message, received_at')
        .eq('user_id', user!.id)
        .order('received_at', { ascending: false })
        .limit(8);

      // Atualizar métricas
      if (filesData) {
        const totalFiles = filesData.length;
        const completed = filesData.filter(f => f.status === 'completed').length;
        const pending = filesData.filter(f => f.status === 'pending' || f.status === 'processing').length;
        const successRate = totalFiles > 0 ? (completed / totalFiles) * 100 : 0;
        const totalBytes = filesData.reduce((sum, f) => sum + (f.file_size_bytes || 0), 0);

        setMetrics(prev => ({
          ...prev,
          totalFiles,
          images: filesData.filter(f => f.file_type === 'image').length,
          videos: filesData.filter(f => f.file_type === 'video').length,
          audios: filesData.filter(f => f.file_type === 'audio').length,
          documents: filesData.filter(f => f.file_type === 'document').length,
          successRate: Math.round(successRate * 10) / 10,
          pendingFiles: pending,
          storageUsed: formatBytes(totalBytes),
        }));
      }

      // Atualizar atividades
      if (recentData) {
        const entries: LogEntry[] = recentData.map(file => ({
          id: file.id,
          mediaType: file.file_type as any,
          fileName: file.file_name,
          sender: file.sender_phone || file.sender_name || 'Desconhecido',
          timestamp: new Date(file.received_at),
          status: mapStatus(file.status),
          errorMessage: file.error_message || undefined,
        }));
        setLogEntries(entries);
      }

      toast.success("Atividades atualizadas!");
    } catch (error) {
      console.error('Error refreshing:', error);
      toast.error("Erro ao atualizar atividades");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleViewAll = () => {
    navigate('/logs');
  };

  const handleReprocess = async (mediaFileId: string) => {
    setReprocessingId(mediaFileId);
    try {
      const { data: reprocessData, error: reprocessError } = await supabase.functions.invoke('reprocess-media', {
        body: { mediaFileId },
      });
      if (reprocessError) {
        toast.error(reprocessError.message || "Erro ao reprocessar");
        return;
      }
      if (!reprocessData?.success) {
        toast.error(reprocessData?.message || "Erro ao reprocessar.");
        return;
      }
      const msg = reprocessData?.message || "Arquivo reprocessado com sucesso.";
      if (msg.includes("já em processamento")) {
        toast.info("Arquivo já está em processamento.");
      } else {
        toast.success("Arquivo reprocessado e enviado ao Drive com sucesso.");
      }
      handleRefresh();
    } catch (err) {
      console.error("Reprocess error:", err);
      toast.error("Erro ao reprocessar");
    } finally {
      setReprocessingId(null);
    }
  };

  // Função auxiliar para formatar bytes
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Função auxiliar para mapear status do banco para o tipo LogStatus
  function mapStatus(status: string): "success" | "error" | "pending" {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'error';
    return 'pending';
  }

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
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Monitore suas automações e gerencie conexões
        </p>
      </div>

      {/* Flow Visualization */}
      <div className="mb-8 animate-fade-in">
        <FlowVisualization
          whatsappConnected={whatsappStatus === "connected"}
          googleDriveConnected={googleDriveStatus === "connected"}
          isProcessing={whatsappStatus === "connected" && googleDriveStatus === "connected"}
        />
      </div>

      {/* Connections */}
      <div className="mb-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Conexões</h2>
        <ConnectionsOverview
          whatsappStatus={whatsappStatus}
          googleDriveStatus={googleDriveStatus}
          whatsappNumber={connection?.whatsapp_phone_number_id || undefined}
          googleDriveEmail={googleDriveStatus === "connected" ? user?.email : undefined}
          onConnectWhatsApp={handleConnectWhatsApp}
          onConnectGoogleDrive={handleConnectGoogleDrive}
        />
      </div>

      {/* WhatsApp Status Details - Mostrar quando pending ou connected */}
      {(whatsappStatus === "pending" || whatsappStatus === "connected") && (
        <div className="mb-8 animate-fade-in" style={{ animationDelay: "150ms" }}>
          <WhatsAppStatusDetails
            status={whatsappStatus}
            phoneNumberId={connection?.whatsapp_phone_number_id}
            webhookVerifyToken={connection?.whatsapp_webhook_verify_token}
            connectedAt={connection?.whatsapp_connected_at || undefined}
            lastMessageAt={lastMediaReceivedAt || undefined}
            onRefresh={handleRefreshWhatsAppStatus}
            isRefreshing={isRefreshing}
          />
        </div>
      )}

      {/* Metrics */}
      <div className="mb-8 animate-fade-in" style={{ animationDelay: "200ms" }}>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Métricas</h2>
        <MetricsGrid metrics={metrics} />
      </div>

      {/* Recent Activity */}
      <div className="animate-fade-in" style={{ animationDelay: "300ms" }}>
        <RecentActivity
          entries={logEntries}
          onRefresh={handleRefresh}
          onViewAll={handleViewAll}
          onReprocess={handleReprocess}
          reprocessingId={reprocessingId}
          isLoading={isRefreshing}
        />
      </div>
    </AppLayout>
  );
};

export default Index;

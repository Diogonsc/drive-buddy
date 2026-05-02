import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConnectionsOverview } from "@/components/dashboard/ConnectionsOverview";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { FlowVisualization } from "@/components/dashboard/FlowVisualization";
import { WhatsAppStatusDetails } from "@/components/dashboard/WhatsAppStatusDetails";
import { HealthMonitor } from "@/components/dashboard/HealthMonitor";
import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";
import { SetupProgress } from "@/components/dashboard/SetupProgress";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { LogEntry } from "@/components/ui/ActivityLog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "@/lib/icons";
import { getOverallConnectionStatus, useConnections } from "@/hooks/useConnections";

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
  const [lastMediaReceivedAt, setLastMediaReceivedAt] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const isAutoRefreshingRef = useRef(false);
  const {
    isLoading: isLoadingConnections,
    whatsappConnections,
    googleAccounts,
    refetch: refetchConnections,
  } = useConnections(user?.id);

  const whatsappPrimaryConnection = whatsappConnections[0];
  const whatsappStatus = getOverallConnectionStatus(whatsappConnections);
  const googleDriveStatus = getOverallConnectionStatus(googleAccounts);

  // Carregar somente última mídia recebida; status vem do hook centralizado de conexões
  useEffect(() => {
    if (!user) return;

    const loadLastMedia = async () => {
      try {
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
        console.error('Error loading last media:', error);
      }
    };

    loadLastMedia();
  }, [user]);

  // Carregar métricas
  const loadMetrics = useCallback(async () => {
    if (!user) return;
    try {
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
      const totalBytes = filesData?.reduce((sum, f) => sum + (f.file_size_bytes || 0), 0) || 0;

      setMetrics({
        totalFiles,
        images,
        videos,
        audios,
        documents,
        successRate: Math.round(successRate * 10) / 10,
        pendingFiles: pending,
        storageUsed: formatBytes(totalBytes),
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Carregar atividades recentes
  const loadRecentActivity = useCallback(async () => {
    if (!user) return;
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
        mediaType: mapMediaType(file.file_type),
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
  }, [user]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadRecentActivity();
  }, [loadRecentActivity]);

  // Check first login for onboarding
  useEffect(() => {
    if (!user) return;
    const onboardingKey = `onboarding_shown_${user.id}`;
    const alreadyShown = localStorage.getItem(onboardingKey);
    if (!alreadyShown) {
      setShowOnboarding(true);
      localStorage.setItem(onboardingKey, 'true');
    }
  }, [user]);

  // Realtime: atualiza dashboard automaticamente quando chega nova mídia
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`media_files_dashboard_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media_files',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadMetrics();
          loadRecentActivity();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadMetrics, loadRecentActivity]);

  // Fallback de atualização contínua para refletir status sem precisar recarregar a página
  useEffect(() => {
    if (!user) return;

    const interval = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      if (isAutoRefreshingRef.current) return;

      isAutoRefreshingRef.current = true;
      try {
        await Promise.all([loadMetrics(), loadRecentActivity()]);
      } catch (error) {
        console.error("Error auto refreshing dashboard activity:", error);
      } finally {
        isAutoRefreshingRef.current = false;
      }
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [user, loadMetrics, loadRecentActivity]);

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

      // Refetch do hook centralizado para obter status atualizado
      await refetchConnections();

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
      // Iniciar OAuth diretamente (credenciais centralizadas no backend)
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
      await Promise.all([loadMetrics(), loadRecentActivity()]);
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

  function mapMediaType(fileType: string): "image" | "video" | "audio" | "document" {
    if (fileType === "image" || fileType === "video" || fileType === "audio" || fileType === "document") {
      return fileType;
    }
    return "document";
  }

  if (isLoading || isLoadingConnections) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const handleWhatsAppConnected = async (_data?: unknown) => {
    await refetchConnections();
  };

  const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  return (
    <AppLayout>
      {/* Onboarding Wizard */}
      <OnboardingWizard
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        whatsappConfigured={whatsappStatus === "connected" || whatsappStatus === "pending"}
        googleDriveConnected={googleDriveStatus === "connected"}
        onConnectGoogleDrive={handleConnectGoogleDrive}
      />

      <div className="min-w-0 overflow-x-hidden">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitore suas automações e gerencie conexões
          </p>
        </div>

        {/* Setup Progress */}
        <div className="mb-8 animate-fade-in min-w-0">
          <SetupProgress
            accountCreated={true}
            whatsappConfigured={whatsappStatus === "connected" || whatsappStatus === "pending"}
            googleDriveConnected={googleDriveStatus === "connected"}
            firstMediaSent={metrics.totalFiles > 0}
            onConnectGoogleDrive={handleConnectGoogleDrive}
            onWhatsAppConnected={handleWhatsAppConnected}
          />
        </div>

        {/* Flow Visualization */}
        <div className="mb-8 animate-fade-in min-w-0">
          <FlowVisualization
            whatsappConnected={whatsappStatus === "connected"}
            googleDriveConnected={googleDriveStatus === "connected"}
            isProcessing={whatsappStatus === "connected" && googleDriveStatus === "connected"}
          />
        </div>

        {/* Connections */}
        <div className="mb-8 animate-fade-in min-w-0" style={{ animationDelay: "100ms" }}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Conexões</h2>
          <ConnectionsOverview
            whatsappStatus={whatsappStatus}
            googleDriveStatus={googleDriveStatus}
            whatsappNumber={whatsappPrimaryConnection?.phone_number_id || undefined}
            googleDriveEmail={googleDriveStatus === "connected" ? user?.email : undefined}
            onConnectWhatsApp={handleConnectWhatsApp}
            onConnectGoogleDrive={handleConnectGoogleDrive}
          />
        </div>

        {/* WhatsApp Status Details - Mostrar quando pending ou connected */}
        {(whatsappStatus === "pending" || whatsappStatus === "connected") && (
          <div className="mb-8 animate-fade-in min-w-0" style={{ animationDelay: "150ms" }}>
            <WhatsAppStatusDetails
              status={whatsappStatus}
              twilioNumber={whatsappPrimaryConnection?.twilio_whatsapp_number || whatsappPrimaryConnection?.phone_number_id}
              accountSid={whatsappPrimaryConnection?.twilio_account_sid || undefined}
              connectedAt={whatsappPrimaryConnection?.connected_at || undefined}
              lastMessageAt={lastMediaReceivedAt || undefined}
              onRefresh={handleRefreshWhatsAppStatus}
              onWhatsAppConnected={handleWhatsAppConnected}
              isRefreshing={isRefreshing}
            />
          </div>
        )}

        {/* Health Monitoring */}
        <div className="mb-8 animate-fade-in min-w-0" style={{ animationDelay: "200ms" }}>
          <HealthMonitor />
        </div>

        {/* Analytics Dashboard */}
        <div className="mb-8 animate-fade-in min-w-0" style={{ animationDelay: "250ms" }}>
          <AnalyticsDashboard />
        </div>

        {/* Metrics */}
        <div className="mb-8 animate-fade-in min-w-0" style={{ animationDelay: "300ms" }}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Métricas</h2>
          <MetricsGrid metrics={metrics} />
        </div>

        {/* Recent Activity */}
        <div className="animate-fade-in min-w-0" style={{ animationDelay: "300ms" }}>
         <RecentActivity
            entries={logEntries}
            onRefresh={handleRefresh}
            onViewAll={handleViewAll}
            onReprocess={handleReprocess}
            reprocessingId={reprocessingId}
            isLoading={isRefreshing}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;

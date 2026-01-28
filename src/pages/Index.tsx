import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { ConnectionsOverview } from "@/components/dashboard/ConnectionsOverview";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { FlowVisualization } from "@/components/dashboard/FlowVisualization";
import { LogEntry } from "@/components/ui/ActivityLog";
import { toast } from "sonner";

// Mock data - será substituído por dados reais do Supabase
const mockMetrics = {
  totalFiles: 1247,
  images: 856,
  videos: 234,
  audios: 89,
  documents: 68,
  successRate: 98.5,
  pendingFiles: 3,
  storageUsed: "2.4 GB",
};

const mockLogEntries: LogEntry[] = [
  {
    id: "1",
    mediaType: "image",
    fileName: "foto_produto_123.jpg",
    sender: "+55 11 99999-8888",
    timestamp: new Date(Date.now() - 2 * 60000),
    status: "success",
  },
  {
    id: "2",
    mediaType: "video",
    fileName: "video_apresentacao.mp4",
    sender: "+55 21 98888-7777",
    timestamp: new Date(Date.now() - 15 * 60000),
    status: "success",
  },
  {
    id: "3",
    mediaType: "document",
    fileName: "contrato_v2.pdf",
    sender: "+55 11 97777-6666",
    timestamp: new Date(Date.now() - 45 * 60000),
    status: "pending",
  },
  {
    id: "4",
    mediaType: "audio",
    fileName: "audio_mensagem.ogg",
    sender: "+55 31 96666-5555",
    timestamp: new Date(Date.now() - 2 * 3600000),
    status: "success",
  },
  {
    id: "5",
    mediaType: "image",
    fileName: "comprovante.png",
    sender: "+55 11 95555-4444",
    timestamp: new Date(Date.now() - 3 * 3600000),
    status: "error",
    errorMessage: "Falha no upload para o Drive",
  },
  {
    id: "6",
    mediaType: "video",
    fileName: "tutorial.mp4",
    sender: "+55 21 94444-3333",
    timestamp: new Date(Date.now() - 5 * 3600000),
    status: "success",
  },
];

const Index = () => {
  const [whatsappStatus, setWhatsappStatus] = useState<"connected" | "disconnected">("disconnected");
  const [googleDriveStatus, setGoogleDriveStatus] = useState<"connected" | "disconnected">("disconnected");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleConnectWhatsApp = () => {
    toast.info("Conectando ao WhatsApp...", {
      description: "Configure suas credenciais da API Meta para continuar.",
    });
    // Demo: toggle connection
    setWhatsappStatus((prev) => (prev === "connected" ? "disconnected" : "connected"));
  };

  const handleConnectGoogleDrive = () => {
    toast.info("Conectando ao Google Drive...", {
      description: "Você será redirecionado para autorizar o acesso.",
    });
    // Demo: toggle connection
    setGoogleDriveStatus((prev) => (prev === "connected" ? "disconnected" : "connected"));
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Atividades atualizadas!");
    }, 1000);
  };

  const handleViewAll = () => {
    toast.info("Navegando para logs completos...");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar currentPath="/" />

      <main className="pl-64 pt-16 transition-all duration-300">
        <div className="container py-8">
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
              whatsappNumber={whatsappStatus === "connected" ? "+55 11 99999-0000" : undefined}
              googleDriveEmail={googleDriveStatus === "connected" ? "usuario@gmail.com" : undefined}
              onConnectWhatsApp={handleConnectWhatsApp}
              onConnectGoogleDrive={handleConnectGoogleDrive}
            />
          </div>

          {/* Metrics */}
          <div className="mb-8 animate-fade-in" style={{ animationDelay: "200ms" }}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Métricas</h2>
            <MetricsGrid metrics={mockMetrics} />
          </div>

          {/* Recent Activity */}
          <div className="animate-fade-in" style={{ animationDelay: "300ms" }}>
            <RecentActivity
              entries={mockLogEntries}
              onRefresh={handleRefresh}
              onViewAll={handleViewAll}
              isLoading={isRefreshing}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

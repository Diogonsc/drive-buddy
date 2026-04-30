import { Image, Video, FileAudio, FileText, CheckCircle2, XCircle, Clock, HardDrive } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";

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

interface MetricsGridProps {
  metrics: Metrics;
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <MetricCard
        title="Total de Arquivos"
        value={metrics.totalFiles}
        subtitle="Salvos no Drive"
        icon={CheckCircle2}
        trend={{ value: 12, isPositive: true }}
      />
      <MetricCard
        title="Imagens"
        value={metrics.images}
        icon={Image}
      />
      <MetricCard
        title="Vídeos"
        value={metrics.videos}
        icon={Video}
      />
      <MetricCard
        title="Áudios"
        value={metrics.audios}
        icon={FileAudio}
      />
      <MetricCard
        title="Documentos"
        value={metrics.documents}
        icon={FileText}
      />
      <MetricCard
        title="Armazenamento"
        value={metrics.storageUsed}
        subtitle="Utilizado no Drive"
        icon={HardDrive}
      />
    </div>
  );
}

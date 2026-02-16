import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Timer,
  TrendingUp,
  AlertCircle,
  Clock,
  Image,
  Video,
  FileAudio,
  FileText,
  CheckCircle2,
  XCircle,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  totalProcessed: number;
  avgProcessingTime: string;
  failedLast24h: number;
  successRate: number;
  lastMediaAt: string | null;
  storageByType: { type: string; bytes: number; count: number }[];
  recentErrors: { file_name: string; error_message: string; received_at: string }[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

const typeConfig = {
  image: { icon: Image, label: "Imagens", color: "text-blue-500" },
  video: { icon: Video, label: "Vídeos", color: "text-purple-500" },
  audio: { icon: FileAudio, label: "Áudios", color: "text-amber-500" },
  document: { icon: FileText, label: "Documentos", color: "text-emerald-500" },
};

function StatItem({ icon: Icon, label, value, subValue, iconColor }: {
  icon: typeof Timer;
  label: string;
  value: string | number;
  subValue?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
        <Icon className={cn("h-4 w-4", iconColor || "text-muted-foreground")} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {subValue && <p className="text-[10px] text-muted-foreground/70">{subValue}</p>}
      </div>
    </div>
  );
}

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadAnalytics = async () => {
      try {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Fetch all media files for user
        const { data: allFiles } = await supabase
          .from("media_files")
          .select("file_type, status, file_size_bytes, file_name, error_message, received_at, processed_at")
          .eq("user_id", user.id);

        if (!allFiles) {
          setIsLoading(false);
          return;
        }

        const totalProcessed = allFiles.filter(f => f.status === "completed").length;

        // Avg processing time (completed files with both timestamps)
        const withTimes = allFiles.filter(f => f.status === "completed" && f.received_at && f.processed_at);
        let avgMs = 0;
        if (withTimes.length > 0) {
          const totalMs = withTimes.reduce((sum, f) => {
            return sum + (new Date(f.processed_at!).getTime() - new Date(f.received_at).getTime());
          }, 0);
          avgMs = totalMs / withTimes.length;
        }

        const avgProcessingTime = avgMs < 1000
          ? `${Math.round(avgMs)}ms`
          : avgMs < 60000
            ? `${(avgMs / 1000).toFixed(1)}s`
            : `${(avgMs / 60000).toFixed(1)}min`;

        // Failed in last 24h
        const failedLast24h = allFiles.filter(
          f => f.status === "failed" && f.received_at && f.received_at >= since24h
        ).length;

        // Success rate
        const total = allFiles.length;
        const successRate = total > 0 ? Math.round((totalProcessed / total) * 100) : 0;

        // Last media
        const sorted = [...allFiles].sort((a, b) =>
          new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
        );
        const lastMediaAt = sorted[0]?.received_at || null;

        // Storage by type
        const typeMap: Record<string, { bytes: number; count: number }> = {};
        for (const f of allFiles) {
          const t = f.file_type || "document";
          if (!typeMap[t]) typeMap[t] = { bytes: 0, count: 0 };
          typeMap[t].bytes += f.file_size_bytes || 0;
          typeMap[t].count += 1;
        }
        const storageByType = Object.entries(typeMap).map(([type, v]) => ({
          type,
          ...v,
        }));

        // Recent errors (last 5)
        const recentErrors = allFiles
          .filter(f => f.status === "failed" && f.error_message)
          .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
          .slice(0, 5)
          .map(f => ({
            file_name: f.file_name || "Sem nome",
            error_message: f.error_message || "",
            received_at: f.received_at,
          }));

        setData({
          totalProcessed,
          avgProcessingTime,
          failedLast24h,
          successRate,
          lastMediaAt,
          storageByType,
          recentErrors,
        });
      } catch (err) {
        console.error("Error loading analytics:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [user]);

  if (isLoading || !data) return null;

  return (
    <div className="space-y-4">
      {/* Key Stats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Analytics Operacional</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatItem
              icon={CheckCircle2}
              label="Processados com sucesso"
              value={data.totalProcessed}
              subValue={`${data.successRate}% taxa de sucesso`}
              iconColor="text-emerald-500"
            />
            <StatItem
              icon={Timer}
              label="Tempo médio de processamento"
              value={data.avgProcessingTime}
              iconColor="text-blue-500"
            />
            <StatItem
              icon={XCircle}
              label="Falhas nas últimas 24h"
              value={data.failedLast24h}
              iconColor={data.failedLast24h > 0 ? "text-destructive" : "text-muted-foreground"}
            />
            <StatItem
              icon={Clock}
              label="Última mídia recebida"
              value={data.lastMediaAt ? formatRelativeTime(data.lastMediaAt) : "Nenhuma"}
              iconColor="text-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Storage Breakdown + Recent Errors side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Storage by Type */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Armazenamento por Tipo</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.storageByType.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum arquivo ainda</p>
            ) : (
              data.storageByType.map(({ type, bytes, count }) => {
                const cfg = typeConfig[type as keyof typeof typeConfig] || typeConfig.document;
                const TypeIcon = cfg.icon;
                const totalBytes = data.storageByType.reduce((s, t) => s + t.bytes, 0);
                const pct = totalBytes > 0 ? Math.round((bytes / totalBytes) * 100) : 0;

                return (
                  <div key={type} className="flex items-center gap-3">
                    <TypeIcon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-foreground">{cfg.label}</span>
                        <span className="text-muted-foreground">{count} arquivos · {formatBytes(bytes)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Errors */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-sm">Erros Recentes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentErrors.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Nenhum erro recente
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentErrors.map((err, i) => (
                  <div key={i} className="rounded-lg bg-destructive/5 border border-destructive/10 p-2.5">
                    <p className="text-xs font-medium text-foreground truncate">{err.file_name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{err.error_message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{formatRelativeTime(err.received_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

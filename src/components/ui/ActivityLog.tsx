import { cn } from "@/lib/utils";
import { 
  Image, 
  Video, 
  FileAudio, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock,
  RefreshCw,
  LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";

type MediaType = "image" | "video" | "audio" | "document";
type LogStatus = "success" | "error" | "pending";

interface LogEntry {
  id: string;
  mediaType: MediaType;
  fileName: string;
  sender: string;
  timestamp: Date;
  status: LogStatus;
  errorMessage?: string;
}

interface ActivityLogProps {
  entries: LogEntry[];
  className?: string;
  onReprocess?: (entryId: string) => void;
  reprocessingId?: string | null;
}

const mediaIcons: Record<MediaType, LucideIcon> = {
  image: Image,
  video: Video,
  audio: FileAudio,
  document: FileText,
};

const mediaColors: Record<MediaType, string> = {
  image: "bg-blue-500/10 text-blue-500",
  video: "bg-purple-500/10 text-purple-500",
  audio: "bg-orange-500/10 text-orange-500",
  document: "bg-emerald-500/10 text-emerald-500",
};

const statusConfig: Record<LogStatus, { icon: LucideIcon; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: "text-success", label: "Salvo" },
  error: { icon: XCircle, color: "text-destructive", label: "Erro" },
  pending: { icon: Clock, color: "text-warning", label: "Processando" },
};

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes}m atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

export function ActivityLog({ entries, className, onReprocess, reprocessingId }: ActivityLogProps) {
  if (entries.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Clock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade ainda</p>
        <p className="text-xs text-muted-foreground mt-1">
          Os arquivos salvos aparecerão aqui
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {entries.map((entry, index) => {
        const MediaIcon = mediaIcons[entry.mediaType];
        const StatusIcon = statusConfig[entry.status].icon;

        return (
          <div
            key={entry.id}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50",
              index === 0 && "animate-fade-in"
            )}
          >
            {/* Media Type Icon */}
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", mediaColors[entry.mediaType])}>
              <MediaIcon className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {entry.fileName}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                de <span className="font-medium">{entry.sender}</span>
              </p>
            </div>

            {/* Status, Reprocessar & Time */}
            <div className="flex flex-col items-end gap-2 shrink-0 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center gap-1.5">
                <StatusIcon className={cn("h-4 w-4", statusConfig[entry.status].color)} />
                <span className={cn("text-xs font-medium", statusConfig[entry.status].color)}>
                  {statusConfig[entry.status].label}
                </span>
              </div>
              {(entry.status === "pending" || entry.status === "error") && onReprocess && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onReprocess(entry.id)}
                  disabled={reprocessingId === entry.id}
                >
                  {reprocessingId === entry.id ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Reprocessar
                    </>
                  )}
                </Button>
              )}
              <span className="text-xs text-muted-foreground w-14 text-right">
                {formatRelativeTime(entry.timestamp)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type { LogEntry, MediaType, LogStatus };

import { LucideIcon, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusType = "connected" | "active" | "unknown" | "disconnected" | "error";

interface StatusCardProps {
  title: string;
  status: StatusType;
  statusLabel?: string;
  icon?: LucideIcon;
  className?: string;
}

const statusConfig: Record<
  StatusType,
  { icon: LucideIcon; color: string; label: string }
> = {
  connected: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    label: "Conectado",
  },
  active: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    label: "Ativo",
  },
  unknown: {
    icon: HelpCircle,
    color: "text-amber-500",
    label: "Desconhecido",
  },
  disconnected: {
    icon: XCircle,
    color: "text-muted-foreground",
    label: "Desconectado",
  },
  error: {
    icon: XCircle,
    color: "text-destructive",
    label: "Erro",
  },
};

/**
 * Card compacto para exibir status de integrações (Supabase, Storage, etc).
 */
export function StatusCard({
  title,
  status,
  statusLabel,
  icon: CustomIcon,
  className,
}: StatusCardProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const Icon = CustomIcon ?? StatusIcon;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border bg-card p-4",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusIcon className={cn("h-4 w-4", config.color)} />
        <span className={cn("text-sm", config.color)}>
          {statusLabel ?? config.label}
        </span>
      </div>
    </div>
  );
}

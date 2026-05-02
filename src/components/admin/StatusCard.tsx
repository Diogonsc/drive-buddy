import { LucideIcon, CheckCircle2, XCircle, HelpCircle } from "@/lib/icons";
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
        "flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <StatusIcon className={cn("h-4 w-4", config.color)} />
        <span className={cn("truncate text-sm", config.color)}>
          {statusLabel ?? config.label}
        </span>
      </div>
    </div>
  );
}

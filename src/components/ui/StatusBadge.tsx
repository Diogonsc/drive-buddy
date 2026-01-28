import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "connected" | "disconnected" | "pending" | "error";
  label?: string;
  className?: string;
}

const statusConfig = {
  connected: {
    bg: "bg-success/10",
    text: "text-success",
    dot: "bg-success",
    label: "Conectado",
  },
  disconnected: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    label: "Desconectado",
  },
  pending: {
    bg: "bg-warning/10",
    text: "text-warning",
    dot: "bg-warning",
    label: "Pendente",
  },
  error: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    dot: "bg-destructive",
    label: "Erro",
  },
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot, status === "connected" && "animate-pulse")} />
      {label || config.label}
    </span>
  );
}

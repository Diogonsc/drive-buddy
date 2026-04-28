import { cn } from "@/lib/utils";
import { LucideIcon, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "./button";
import { StatusBadge } from "./StatusBadge";

interface ConnectionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  status: "connected" | "disconnected" | "pending" | "error";
  actionLabel?: string;
  onAction?: () => void;
  details?: { label: string; value: string }[];
  className?: string;
}

export function ConnectionCard({
  title,
  description,
  icon: Icon,
  iconColor = "text-primary",
  status,
  actionLabel,
  onAction,
  details,
  className,
}: ConnectionCardProps) {
  const isConnected = status === "connected";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl bg-card border border-border p-6 shadow-soft transition-all duration-300 hover:shadow-medium",
        isConnected && "border-success/30",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
            isConnected ? "bg-success/10" : "bg-muted"
          )}
        >
          <Icon className={cn("h-6 w-6", isConnected ? "text-success" : iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{description}</p>
        </div>
      </div>

      {/* Details */}
      {details && details.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          {details.map((detail, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{detail.label}</span>
              <span className="max-w-[60%] truncate text-right font-medium text-foreground">{detail.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action */}
      {actionLabel && onAction && (
        <div className="mt-4 pt-4 border-t border-border">
          <Button
            onClick={onAction}
            variant={isConnected ? "outline" : "default"}
            className="w-full group/btn"
          >
            {actionLabel}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
          </Button>
        </div>
      )}

      {/* Decorative elements */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

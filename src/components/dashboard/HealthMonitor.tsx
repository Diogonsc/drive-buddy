import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  MessageSquare,
  HardDrive,
  Cpu,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

interface IntegrationHealth {
  whatsapp_health: HealthStatus;
  whatsapp_last_check: string | null;
  whatsapp_message: string | null;
  google_health: HealthStatus;
  google_last_check: string | null;
  google_message: string | null;
  processing_health: HealthStatus;
  processing_last_check: string | null;
  processing_message: string | null;
  overall_status: HealthStatus;
  updated_at: string;
}

const statusConfig: Record<HealthStatus, { icon: typeof CheckCircle2; label: string; color: string; badgeVariant: "default" | "secondary" | "destructive" | "outline" }> = {
  healthy: { icon: CheckCircle2, label: "Saudável", color: "text-emerald-500", badgeVariant: "default" },
  warning: { icon: AlertTriangle, label: "Atenção", color: "text-amber-500", badgeVariant: "secondary" },
  critical: { icon: XCircle, label: "Crítico", color: "text-destructive", badgeVariant: "destructive" },
  unknown: { icon: HelpCircle, label: "Desconhecido", color: "text-muted-foreground", badgeVariant: "outline" },
};

function HealthIndicator({ status, label, message, lastCheck, icon: ServiceIcon }: {
  status: HealthStatus;
  label: string;
  message: string | null;
  lastCheck: string | null;
  icon: typeof MessageSquare;
}) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 transition-colors hover:bg-muted">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
        <ServiceIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <div className="flex items-center gap-1.5">
            <StatusIcon className={cn("h-3.5 w-3.5", config.color)} />
            <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
          </div>
        </div>
        {message && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{message}</p>
        )}
        {lastCheck && (
          <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            Verificado: {new Date(lastCheck).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </p>
        )}
      </div>
    </div>
  );
}

export function HealthMonitor() {
  const { user } = useAuth();
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [prevHealth, setPrevHealth] = useState<IntegrationHealth | null>(null);

  const showHealthNotifications = (newHealth: IntegrationHealth, oldHealth: IntegrationHealth | null) => {
    // Only notify on status changes or first load with issues
    const checks = [
      { key: "whatsapp_health" as const, label: "WhatsApp", msg: "whatsapp_message" as const },
      { key: "google_health" as const, label: "Google Drive", msg: "google_message" as const },
      { key: "processing_health" as const, label: "Processamento", msg: "processing_message" as const },
    ];

    for (const { key, label, msg } of checks) {
      const newStatus = newHealth[key];
      const oldStatus = oldHealth?.[key];

      if (newStatus === oldStatus) continue;

      const message = newHealth[msg] || "";

      if (newStatus === "critical") {
        toast.error(`⚠️ ${label}: ${message}`, {
          duration: 10000,
          description: "Ação necessária para restaurar o funcionamento.",
        });
      } else if (newStatus === "warning") {
        toast.warning(`${label}: ${message}`, {
          duration: 7000,
        });
      } else if (newStatus === "healthy" && oldStatus && oldStatus !== "unknown") {
        toast.success(`${label} restaurado`, { duration: 4000 });
      }
    }
  };

  const loadHealth = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("integration_status")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        const newHealth = data as IntegrationHealth;
        showHealthNotifications(newHealth, prevHealth);
        setPrevHealth(health);
        setHealth(newHealth);
      }
    } catch (err) {
      console.error("Error loading health:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, [user]);

  // Subscribe to real-time changes on integration_status
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("integration-health-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "integration_status",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newHealth = payload.new as IntegrationHealth;
          showHealthNotifications(newHealth, health);
          setPrevHealth(health);
          setHealth(newHealth);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, health]);

  const runHealthCheck = async () => {
    if (!user) return;
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("health-check", {
        body: { userId: user.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Verificação de saúde concluída");
        await loadHealth();
      } else {
        toast.error("Erro na verificação");
      }
    } catch (err) {
      console.error("Health check error:", err);
      toast.error("Erro ao executar verificação de saúde");
    } finally {
      setIsChecking(false);
    }
  };

  const overallConfig = statusConfig[health?.overall_status || "unknown"];
  const OverallIcon = overallConfig.icon;

  const hasCritical = health?.overall_status === "critical";
  const hasWarning = health?.overall_status === "warning";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Saúde das Integrações</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={overallConfig.badgeVariant} className="gap-1">
              <OverallIcon className="h-3 w-3" />
              {overallConfig.label}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={runHealthCheck}
              disabled={isChecking}
            >
              <RefreshCw className={cn("h-4 w-4", isChecking && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {(hasCritical || hasWarning) && (
          <Alert variant={hasCritical ? "destructive" : "default"} className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {hasCritical
                ? "Uma ou mais integrações precisam de atenção imediata."
                : "Existem avisos que podem afetar o funcionamento."
              }
            </AlertDescription>
          </Alert>
        )}

        <HealthIndicator
          status={health?.whatsapp_health || "unknown"}
          label="WhatsApp"
          message={health?.whatsapp_message || null}
          lastCheck={health?.whatsapp_last_check || null}
          icon={MessageSquare}
        />

        <HealthIndicator
          status={health?.google_health || "unknown"}
          label="Google Drive"
          message={health?.google_message || null}
          lastCheck={health?.google_last_check || null}
          icon={HardDrive}
        />

        <HealthIndicator
          status={health?.processing_health || "unknown"}
          label="Processamento"
          message={health?.processing_message || null}
          lastCheck={health?.processing_last_check || null}
          icon={Cpu}
        />

        {!health && !isLoading && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">Nenhuma verificação realizada ainda</p>
            <Button size="sm" variant="outline" onClick={runHealthCheck} disabled={isChecking}>
              <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isChecking && "animate-spin")} />
              Executar primeira verificação
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

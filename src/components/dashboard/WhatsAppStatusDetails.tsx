import { CheckCircle2, Clock, AlertCircle, RefreshCw } from "@/lib/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WhatsAppConnectButton } from "@/components/whatsapp/WhatsAppConnectButton";

interface WhatsAppStatusDetailsProps {
  status: "connected" | "disconnected" | "pending" | "error";
  twilioNumber?: string;
  accountSid?: string;
  connectedAt?: string;
  lastMessageAt?: string;
  onRefresh?: () => void;
  onWhatsAppConnected?: (data: any) => void;
  isRefreshing?: boolean;
}

export function WhatsAppStatusDetails({
  status,
  twilioNumber,
  accountSid,
  connectedAt,
  lastMessageAt,
  onRefresh,
  onWhatsAppConnected,
  isRefreshing,
}: WhatsAppStatusDetailsProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: CheckCircle2,
          color: "text-emerald-500",
          bgColor: "bg-emerald-500/10",
          label: "Conectado",
          badgeVariant: "default" as const,
        };
      case "pending":
        return {
          icon: Clock,
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
          label: "Configurando...",
          badgeVariant: "secondary" as const,
        };
      case "error":
        return {
          icon: AlertCircle,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          label: "Erro",
          badgeVariant: "destructive" as const,
        };
      default:
        return {
          icon: AlertCircle,
          color: "text-muted-foreground",
          bgColor: "bg-muted",
          label: "Desconectado",
          badgeVariant: "outline" as const,
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <div className={`p-1.5 rounded-full ${config.bgColor}`}>
              <StatusIcon className={`h-4 w-4 ${config.color}`} />
            </div>
            Status do WhatsApp
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={config.badgeVariant}>{config.label}</Badge>
            {onRefresh && status !== 'disconnected' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection details */}
        {status === 'connected' && (twilioNumber || accountSid) && (
          <div className="grid gap-2 text-sm">
            {twilioNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Número WhatsApp:</span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded">{twilioNumber}</code>
              </div>
            )}
            {accountSid && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account SID (últimos 4):</span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded">{accountSid.slice(-4)}</code>
              </div>
            )}
          </div>
        )}

        {/* Timestamps */}
        {status !== 'disconnected' && (
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conectado em:</span>
              <span>{formatDate(connectedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última mensagem:</span>
              <span>{formatDate(lastMessageAt)}</span>
            </div>
          </div>
        )}

        {/* Disconnected: show connect button */}
        {status === 'disconnected' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conecte seu WhatsApp Business em 1 clique para começar a receber mídias automaticamente.
            </p>
            <WhatsAppConnectButton
              onSuccess={onWhatsAppConnected}
              currentStatus="disconnected"
            />
          </div>
        )}

        {/* Error: show reconnect */}
        {status === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              Houve um problema com a conexão. Tente reconectar.
            </p>
            <WhatsAppConnectButton
              onSuccess={onWhatsAppConnected}
              currentStatus="error"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { CheckCircle2, Clock, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface WhatsAppStatusDetailsProps {
  status: "connected" | "disconnected" | "pending" | "error";
  phoneNumberId?: string;
  webhookVerifyToken?: string;
  connectedAt?: string;
  lastMessageAt?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function WhatsAppStatusDetails({
  status,
  phoneNumberId,
  webhookVerifyToken,
  connectedAt,
  lastMessageAt,
  onRefresh,
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
          label: "Aguardando Confirmação",
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

  const getNextSteps = () => {
    switch (status) {
      case "pending":
        return [
          "Configure a URL do webhook no Meta Business",
          "Envie uma mensagem de mídia (foto, vídeo, áudio ou documento) para o número configurado",
          "O status mudará automaticamente para 'Conectado' após a primeira mensagem processada",
        ];
      case "disconnected":
        return [
          "Acesse as Configurações para inserir suas credenciais do WhatsApp Business",
          "Configure o Webhook Verify Token e Phone Number ID",
          "Registre a URL do webhook no painel do Meta Business",
        ];
      case "error":
        return [
          "Verifique se as credenciais estão corretas nas Configurações",
          "Confirme que o App Secret está configurado corretamente",
          "Teste o webhook novamente enviando uma mensagem",
        ];
      default:
        return [];
    }
  };

  const nextSteps = getNextSteps();

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
            {onRefresh && (
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
        {/* Detalhes da conexão */}
        {(phoneNumberId || webhookVerifyToken) && (
          <div className="grid gap-2 text-sm">
            {phoneNumberId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone Number ID:</span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded">{phoneNumberId}</code>
              </div>
            )}
            {webhookVerifyToken && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Verify Token:</span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded">
                  {webhookVerifyToken.substring(0, 8)}...
                </code>
              </div>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Configurado em:</span>
            <span>{formatDate(connectedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Última mensagem:</span>
            <span>{formatDate(lastMessageAt)}</span>
          </div>
        </div>

        {/* Próximos passos */}
        {nextSteps.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Próximos Passos
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                {nextSteps.map((step, index) => (
                  <li key={index} className="leading-relaxed">{step}</li>
                ))}
              </ol>
            </div>
          </>
        )}

        {/* Link para documentação */}
        <div className="pt-2">
          <a
            href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver documentação do WhatsApp Cloud API
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

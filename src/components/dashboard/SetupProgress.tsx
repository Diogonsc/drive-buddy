import { CheckCircle2, Circle, Send, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WhatsAppConnectButton } from "@/components/whatsapp/WhatsAppConnectButton";
import { FaWhatsapp, FaGoogleDrive } from "react-icons/fa6";

interface SetupProgressProps {
  accountCreated: boolean;
  whatsappConfigured: boolean;
  googleDriveConnected: boolean;
  firstMediaSent: boolean;
  onConnectGoogleDrive?: () => void;
  onWhatsAppConnected?: (data: any) => void;
}

export function SetupProgress({
  accountCreated,
  whatsappConfigured,
  googleDriveConnected,
  firstMediaSent,
  onConnectGoogleDrive,
  onWhatsAppConnected,
}: SetupProgressProps) {
  const steps = [
    {
      id: "account",
      label: "Conta criada",
      description: "Cadastro concluído",
      icon: UserCheck,
      completed: accountCreated,
      cta: null,
    },
    {
      id: "whatsapp",
      label: "WhatsApp conectado",
      description: whatsappConfigured ? "Integração ativa" : "Conecte em 1 clique",
      icon: FaWhatsapp,
      completed: whatsappConfigured,
      cta: !whatsappConfigured ? 'whatsapp' : null,
    },
    {
      id: "google",
      label: "Google Drive conectado",
      description: googleDriveConnected ? "OAuth autorizado" : "Conecte sua conta",
      icon: FaGoogleDrive,
      completed: googleDriveConnected,
      cta: !googleDriveConnected && onConnectGoogleDrive ? 'google' : null,
    },
    {
      id: "media",
      label: "Primeira mídia enviada",
      description: firstMediaSent ? "Sincronização validada" : "Envie uma mídia pelo WhatsApp",
      icon: Send,
      completed: firstMediaSent,
      cta: null,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = (completedCount / steps.length) * 100;
  const allDone = completedCount === steps.length;

  if (allDone) return null;

  // Find first incomplete step for CTA
  const nextStep = steps.find(s => !s.completed);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-accent/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Progresso do Setup
          </CardTitle>
          <span className="text-sm font-medium text-primary">
            {completedCount}/{steps.length}
          </span>
        </div>
        <Progress value={progressPercent} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-3 transition-colors",
                  step.completed ? "bg-primary/5" : "bg-muted/50"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    step.completed ? "bg-primary/10" : "bg-muted"
                  )}
                >
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium truncate",
                      step.completed ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Inline CTA for next step */}
        {nextStep?.cta === 'whatsapp' && (
          <WhatsAppConnectButton
            variant="compact"
            onSuccess={onWhatsAppConnected}
            currentStatus="disconnected"
          />
        )}
        {nextStep?.cta === 'google' && onConnectGoogleDrive && (
          <Button size="sm" onClick={onConnectGoogleDrive} className="gap-2">
            <FaGoogleDrive className="h-4 w-4" />
            Conectar Google Drive
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

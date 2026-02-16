import { CheckCircle2, Circle, MessageSquare, HardDrive, Send, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface SetupStep {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
}

interface SetupProgressProps {
  accountCreated: boolean;
  whatsappConfigured: boolean;
  googleDriveConnected: boolean;
  firstMediaSent: boolean;
}

export function SetupProgress({
  accountCreated,
  whatsappConfigured,
  googleDriveConnected,
  firstMediaSent,
}: SetupProgressProps) {
  const steps: SetupStep[] = [
    {
      id: "account",
      label: "Conta criada",
      description: "Cadastro concluído",
      icon: UserCheck,
      completed: accountCreated,
    },
    {
      id: "whatsapp",
      label: "WhatsApp configurado",
      description: "Credenciais e webhook ativos",
      icon: MessageSquare,
      completed: whatsappConfigured,
    },
    {
      id: "google",
      label: "Google Drive conectado",
      description: "OAuth autorizado",
      icon: HardDrive,
      completed: googleDriveConnected,
    },
    {
      id: "media",
      label: "Primeira mídia enviada",
      description: "Sincronização validada",
      icon: Send,
      completed: firstMediaSent,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = (completedCount / steps.length) * 100;
  const allDone = completedCount === steps.length;

  if (allDone) return null;

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
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-3 transition-colors",
                  step.completed
                    ? "bg-primary/5"
                    : "bg-muted/50"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    step.completed
                      ? "bg-primary/10"
                      : "bg-muted"
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
                      step.completed
                        ? "text-foreground"
                        : "text-muted-foreground"
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
      </CardContent>
    </Card>
  );
}

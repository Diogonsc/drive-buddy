import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  HardDrive,
  Send,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { WhatsAppConnectButton } from "@/components/whatsapp/WhatsAppConnectButton";

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  whatsappConfigured: boolean;
  googleDriveConnected: boolean;
  onConnectGoogleDrive: () => void;
}

const STEPS = [
  {
    id: "whatsapp",
    title: "Conectar WhatsApp",
    icon: MessageSquare,
  },
  {
    id: "google",
    title: "Conectar Google Drive",
    icon: HardDrive,
  },
  {
    id: "test",
    title: "Enviar primeira mídia",
    icon: Send,
  },
] as const;

export function OnboardingWizard({
  open,
  onClose,
  whatsappConfigured,
  googleDriveConnected,
  onConnectGoogleDrive,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [whatsappJustConnected, setWhatsappJustConnected] = useState(false);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const handleWhatsAppSuccess = () => {
    setWhatsappJustConnected(true);
    // Auto-advance after a short delay
    setTimeout(() => handleNext(), 1500);
  };

  const isWhatsAppDone = whatsappConfigured || whatsappJustConnected;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Configuração Inicial
          </DialogTitle>
          <DialogDescription>
            Conecte suas integrações em poucos cliques
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 py-2">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <div key={step.id} className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => setCurrentStep(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors w-full",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : isDone
                      ? "bg-primary/5 text-primary/70"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <Icon className="h-4 w-4 shrink-0" />
                  )}
                  <span className="hidden sm:inline truncate">{step.title}</span>
                </button>
              </div>
            );
          })}
        </div>
        <Progress value={progress} className="h-1.5" />

        {/* Step Content */}
        <div className="min-h-[200px] py-4">
          {currentStep === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta do WhatsApp Business em 1 clique.
                O sistema configura tudo automaticamente — webhook, número e permissões.
              </p>

              <WhatsAppConnectButton
                onSuccess={handleWhatsAppSuccess}
                currentStatus={isWhatsAppDone ? 'connected' : 'disconnected'}
              />
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta do Google Drive para armazenar as mídias
                recebidas automaticamente. Basta autorizar com um clique.
              </p>

              {googleDriveConnected ? (
                <div className="flex items-center gap-2 text-sm text-primary rounded-lg bg-primary/5 p-4">
                  <CheckCircle2 className="h-5 w-5" />
                  Google Drive conectado com sucesso!
                </div>
              ) : (
                <Button className="w-full" onClick={onConnectGoogleDrive}>
                  <HardDrive className="h-4 w-4 mr-2" />
                  Conectar Google Drive
                </Button>
              )}

              <p className="text-xs text-muted-foreground">
                Suas mídias serão salvas na pasta <code>/WhatsApp Uploads</code>{" "}
                do seu Google Drive, organizadas por data e tipo.
              </p>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Envie uma foto, vídeo, áudio ou documento para o número do
                WhatsApp Business conectado. O sistema processará
                automaticamente e salvará no Google Drive.
              </p>

              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
                <Send className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">
                  Envie uma mídia pelo WhatsApp
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  O status mudará para "Conectado" após o processamento
                </p>
              </div>

              <Button variant="outline" className="w-full" onClick={onClose}>
                Concluir configuração
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Pular
            </Button>
            <Button size="sm" onClick={handleNext}>
              {currentStep === STEPS.length - 1 ? "Concluir" : "Próximo"}
              {currentStep < STEPS.length - 1 && (
                <ArrowRight className="h-4 w-4 ml-1" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

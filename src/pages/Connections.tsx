import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConnectionsOverview } from "@/components/dashboard/ConnectionsOverview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";

export default function Connections() {
  const [whatsappStatus, setWhatsappStatus] = useState<"connected" | "disconnected">("disconnected");
  const [googleDriveStatus, setGoogleDriveStatus] = useState<"connected" | "disconnected">("disconnected");

  const handleConnectWhatsApp = () => {
    toast.info("Conectando ao WhatsApp...", {
      description: "Configure suas credenciais da API Meta para continuar.",
    });
    setWhatsappStatus((prev) => (prev === "connected" ? "disconnected" : "connected"));
  };

  const handleConnectGoogleDrive = () => {
    toast.info("Conectando ao Google Drive...", {
      description: "Você será redirecionado para autorizar o acesso.",
    });
    setGoogleDriveStatus((prev) => (prev === "connected" ? "disconnected" : "connected"));
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Conexões
            </h1>
            <p className="text-muted-foreground">
              Gerencie suas integrações com WhatsApp e Google Drive
            </p>
          </div>

      {/* Connections */}
      <div className="mb-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <ConnectionsOverview
              whatsappStatus={whatsappStatus}
              googleDriveStatus={googleDriveStatus}
              whatsappNumber={whatsappStatus === "connected" ? "+55 11 99999-0000" : undefined}
              googleDriveEmail={googleDriveStatus === "connected" ? "usuario@gmail.com" : undefined}
              onConnectWhatsApp={handleConnectWhatsApp}
              onConnectGoogleDrive={handleConnectGoogleDrive}
            />
          </div>

      {/* Connection Flow */}
      <Card className="animate-fade-in" style={{ animationDelay: "200ms" }}>
            <CardHeader>
              <CardTitle>Como funciona a integração</CardTitle>
              <CardDescription>
                Entenda o fluxo de automação do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    whatsappStatus === "connected" ? "bg-emerald-500/10" : "bg-muted"
                  }`}>
                    {whatsappStatus === "connected" ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    ) : (
                      <XCircle className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">1. WhatsApp recebe mídia</p>
                    <p className="text-sm text-muted-foreground">Webhook processa a mensagem</p>
                  </div>
                </div>

                <ArrowRight className="hidden h-5 w-5 text-muted-foreground sm:block" />

                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">2. Sistema processa</p>
                    <p className="text-sm text-muted-foreground">Download e validação</p>
                  </div>
                </div>

                <ArrowRight className="hidden h-5 w-5 text-muted-foreground sm:block" />

                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    googleDriveStatus === "connected" ? "bg-blue-500/10" : "bg-muted"
                  }`}>
                    {googleDriveStatus === "connected" ? (
                      <CheckCircle2 className="h-6 w-6 text-blue-500" />
                    ) : (
                      <XCircle className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">3. Salva no Drive</p>
                    <p className="text-sm text-muted-foreground">Organizado automaticamente</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
    </AppLayout>
  );
}

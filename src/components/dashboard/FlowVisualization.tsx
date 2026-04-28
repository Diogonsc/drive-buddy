import { Server, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FaWhatsapp, FaGoogleDrive, FaArrowRight } from "react-icons/fa6";

interface FlowVisualizationProps {
  whatsappConnected: boolean;
  googleDriveConnected: boolean;
  isProcessing?: boolean;
}

export function FlowVisualization({ whatsappConnected, googleDriveConnected, isProcessing }: FlowVisualizationProps) {
  const allConnected = whatsappConnected && googleDriveConnected;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">Fluxo de Automação</h3>
        <p className="text-sm text-muted-foreground">Visualize como seus arquivos são processados</p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-center justify-between gap-2 py-4 sm:min-w-0">
          {/* WhatsApp */}
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-xl transition-all duration-300",
                whatsappConnected
                  ? "bg-success/10 shadow-glow"
                  : "bg-muted"
              )}
            >
              <FaWhatsapp
                className={cn(
                  "h-7 w-7",
                  whatsappConnected ? "text-success" : "text-muted-foreground"
                )}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">WhatsApp</span>
          </div>

          {/* Arrow 1 */}
          <div className="flex-1 flex items-center justify-center">
            <div className={cn(
              "h-0.5 flex-1 max-w-16 transition-colors",
              whatsappConnected ? "bg-primary" : "bg-border"
            )} />
            <FaArrowRight className={cn(
              "h-5 w-5 mx-1 transition-colors",
              whatsappConnected ? "text-primary" : "text-muted-foreground",
              isProcessing && "animate-pulse"
            )} />
            <div className={cn(
              "h-0.5 flex-1 max-w-16 transition-colors",
              whatsappConnected ? "bg-primary" : "bg-border"
            )} />
          </div>

          {/* Backend */}
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-xl transition-all duration-300",
                allConnected
                  ? "bg-primary/10 shadow-glow"
                  : "bg-muted"
              )}
            >
              <Server
                className={cn(
                  "h-7 w-7",
                  allConnected ? "text-primary" : "text-muted-foreground",
                  isProcessing && "animate-pulse"
                )}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Swiftwapdrive</span>
          </div>

          {/* Arrow 2 */}
          <div className="flex-1 flex items-center justify-center">
            <div className={cn(
              "h-0.5 flex-1 max-w-16 transition-colors",
              googleDriveConnected ? "bg-primary" : "bg-border"
            )} />
            <FaArrowRight className={cn(
              "h-5 w-5 mx-1 transition-colors",
              googleDriveConnected ? "text-primary" : "text-muted-foreground",
              isProcessing && "animate-pulse"
            )} />
            <div className={cn(
              "h-0.5 flex-1 max-w-16 transition-colors",
              googleDriveConnected ? "bg-primary" : "bg-border"
            )} />
          </div>

          {/* Google Drive */}
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-xl transition-all duration-300",
                googleDriveConnected
                  ? "bg-primary/10 shadow-glow"
                  : "bg-muted"
              )}
            >
              <FaGoogleDrive
                className={cn(
                  "h-7 w-7",
                  googleDriveConnected ? "text-primary" : "text-muted-foreground"
                )}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Google Drive</span>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
        {allConnected ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-success">Automação ativa</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            Conecte os serviços para ativar a automação
          </span>
        )}
      </div>
    </div>
  );
}

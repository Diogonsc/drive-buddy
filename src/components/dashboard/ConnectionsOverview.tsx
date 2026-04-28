
import { FaWhatsapp, FaGoogleDrive } from "react-icons/fa6";
import { ConnectionCard } from "@/components/ui/ConnectionCard";

interface ConnectionsOverviewProps {
  whatsappStatus: "connected" | "disconnected" | "pending" | "error";
  googleDriveStatus: "connected" | "disconnected" | "pending" | "error";
  whatsappNumber?: string;
  googleDriveEmail?: string;
  onConnectWhatsApp: () => void;
  onConnectGoogleDrive: () => void;
}

export function ConnectionsOverview({
  whatsappStatus,
  googleDriveStatus,
  whatsappNumber,
  googleDriveEmail,
  onConnectWhatsApp,
  onConnectGoogleDrive,
}: ConnectionsOverviewProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ConnectionCard
        title="WhatsApp Business"
        description="Receba arquivos automaticamente via API oficial do WhatsApp"
        icon={FaWhatsapp}
        iconColor="text-emerald-500"
        status={whatsappStatus}
        actionLabel={
          whatsappStatus === "connected"
            ? "Gerenciar"
            : whatsappStatus === "pending"
              ? "Verificar Status"
              : "Conectar WhatsApp"
        }
        onAction={onConnectWhatsApp}
        details={
          whatsappStatus === "connected" && whatsappNumber
            ? [
                { label: "Número", value: whatsappNumber },
                { label: "Webhook", value: "Ativo" },
              ]
            : undefined
        }
      />

      <ConnectionCard
        title="Google Drive"
        description="Armazene seus arquivos de forma organizada na nuvem"
        icon={FaGoogleDrive}
        iconColor="text-blue-500"
        status={googleDriveStatus}
        actionLabel={googleDriveStatus === "connected" ? "Gerenciar" : "Conectar Google Drive"}
        onAction={onConnectGoogleDrive}
        details={
          googleDriveStatus === "connected" && googleDriveEmail
            ? [
                { label: "Conta", value: googleDriveEmail },
                { label: "Pasta raiz", value: "/SwiftWapDrive" },
              ]
            : undefined
        }
      />
    </div>
  );
}

import logo from "@/assets/logo.png";
import { HardDrive, MessageCircle, Zap } from "lucide-react";
const features = [
  {
    icon: MessageCircle,
    text: "Receba mídias pelo WhatsApp e armazene automaticamente.",
  },
  {
    icon: HardDrive,
    text: "Tudo organizado no Google Drive, com pastas por tipo e data.",
  },
  {
    icon: Zap,
    text: "Sincronização em tempo real, sem esforço.",
  },
];

export function AuthBranding() {
  return (
    <div className="flex flex-col justify-center p-8 lg:p-12 xl:p-16">
      <div className="mx-auto w-full max-w-md lg:max-w-none">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center rounded-lg bg-white">
            <img
              src={logo}
              alt="Swiftwapdrive"
              className="h-10 w-10 rounded-lg text-primary-foreground"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary-foreground lg:text-3xl">
              Swiftwapdrive
            </h1>
            <p className="text-sm text-primary-foreground/80 lg:text-base">
              WhatsApp → Google Drive
            </p>
          </div>
        </div>
        <p className="text-primary-foreground/90 mb-8 text-base lg:text-lg leading-relaxed">
          Conecte sua conta do WhatsApp Business e seu Google Drive. As fotos,
          vídeos, áudios e documentos que você receber serão salvos e
          organizados automaticamente na nuvem.
        </p>
        <ul className="space-y-4">
          {features.map((item) => (
            <li key={item.text} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/20 text-primary-foreground">
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-sm text-primary-foreground/90 pt-1.5 lg:text-base">
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HiOutlineDevicePhoneMobile, HiXMark } from "react-icons/hi2";
import { FaCloud } from "react-icons/fa";

export function InstallBanner() {
  const { canPrompt, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;

  // iOS instructions
  if (isIOS) {
    return (
      <Card className="mx-4 mt-4 border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
            <FaCloud className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-foreground">Instale o Swiftwapdrive</p>
            <p className="text-xs text-muted-foreground">
              Toque em <span className="font-medium">Compartilhar</span> (ícone ↑) e depois em{" "}
              <span className="font-medium">"Adicionar à Tela de Início"</span>.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 -mt-1 -mr-1"
            onClick={() => setDismissed(true)}
          >
            <HiXMark className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Android / Desktop prompt
  if (!canPrompt) return null;

  return (
    <Card className="mx-4 mt-4 border-primary/30 bg-primary/5">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
          <HiOutlineDevicePhoneMobile className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1 space-y-0.5">
          <p className="text-sm font-semibold text-foreground">Instale o app</p>
          <p className="text-xs text-muted-foreground">
            Acesse mais rápido direto da tela inicial.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
            Depois
          </Button>
          <Button size="sm" onClick={promptInstall}>
            Instalar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

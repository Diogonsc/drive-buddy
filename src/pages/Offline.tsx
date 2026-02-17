import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FaCloud } from "react-icons/fa";
import { HiOutlineWifi, HiOutlineArrowPath } from "react-icons/hi2";

export default function Offline() {
  const [checking, setChecking] = useState(false);

  const handleRetry = () => {
    setChecking(true);
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.reload();
      }
      setChecking(false);
    }, 1500);
  };

  useEffect(() => {
    const onOnline = () => window.location.reload();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-dashed">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <HiOutlineWifi className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <FaCloud className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">Sem conexão</h1>
            <p className="text-sm text-muted-foreground">
              Parece que você está offline. Verifique sua conexão com a internet e tente novamente.
            </p>
          </div>

          <Button onClick={handleRetry} disabled={checking} className="w-full gap-2">
            <HiOutlineArrowPath className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Verificando..." : "Tentar novamente"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

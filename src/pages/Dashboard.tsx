import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import Index from "./Index";

export default function Dashboard() {
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      window.history.replaceState({}, "", "/dashboard");
      toast({
        title: "🎉 Pagamento confirmado!",
        description: "Seu plano foi ativado. Bem-vindo ao SwiftWapDrive!",
      });
    }
  }, []);

  return <Index />;
}

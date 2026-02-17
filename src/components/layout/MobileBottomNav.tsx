import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { HiOutlineArrowRightOnRectangle, HiOutlineChartBar, HiOutlineFolderOpen, HiOutlineHome, HiOutlineUserCircle } from "react-icons/hi2";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SubscriptionSummary {
  plan: string;
  monthly_file_limit: number | null;
  files_used_current_month: number | null;
  whatsapp_numbers_limit: number | null;
  google_accounts_limit: number | null;
}

const navItems = [
  { id: "home", label: "Início", path: "/", icon: HiOutlineHome },
  { id: "connections", label: "Conexões", path: "/connections", icon: Link2 },
  { id: "files", label: "Arquivos", path: "/files", icon: HiOutlineFolderOpen },
  { id: "logs", label: "Logs", path: "/logs", icon: HiOutlineChartBar },
] as const;

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [plan, setPlan] = useState<SubscriptionSummary | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadPlan = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan, monthly_file_limit, files_used_current_month, whatsapp_numbers_limit, google_accounts_limit")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setPlan(data as SubscriptionSummary);
      }
    };

    loadPlan();
  }, [user]);

  const displayName = useMemo(() => {
    const metadataName = user?.user_metadata?.full_name as string | undefined;
    if (metadataName && metadataName.trim()) return metadataName.trim();
    return user?.email?.split("@")[0] || "Usuário";
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
    navigate("/login");
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.id} to={item.path}>
              <Button
                variant="ghost"
                className={cn(
                  "h-14 w-full flex-col gap-1 rounded-xl px-1",
                  active && "bg-primary/10 text-primary",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[11px] leading-none">{item.label}</span>
              </Button>
            </Link>
          );
        })}

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" className="h-14 w-full flex-col gap-1 rounded-xl px-1">
              <HiOutlineUserCircle className="h-4 w-4" />
              <span className="text-[11px] leading-none">Perfil</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Perfil</SheetTitle>
              <SheetDescription>
                Informações da conta e plano atual.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{displayName}</p>
                <p className="mt-2 text-sm text-muted-foreground">Email</p>
                <p className="font-medium break-all">{user?.email || "-"}</p>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <Badge>{plan?.plan || "starter"}</Badge>
                </div>
                <Separator className="my-3" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Arquivos no ciclo</span>
                    <span>
                      {plan?.files_used_current_month ?? 0} / {plan?.monthly_file_limit ?? "ilimitado"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Limite WhatsApp</span>
                    <span>{plan?.whatsapp_numbers_limit ?? 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Limite Google Drive</span>
                    <span>{plan?.google_accounts_limit ?? 1}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" variant="outline" onClick={() => navigate("/settings")}>
                  Configurações
                </Button>
                <Button className="flex-1" variant="destructive" onClick={handleLogout}>
                  <HiOutlineArrowRightOnRectangle className="mr-2 h-4 w-4" />
                  Sair
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

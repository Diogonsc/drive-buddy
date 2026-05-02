import { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Bell, Settings, ShieldCheck } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import logo from "@/assets/logo.png";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAdmin } = useIsAdmin();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 min-w-0 shrink-0 items-center gap-2 overflow-x-clip border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Link to="/" className="flex min-w-0 items-center gap-2">
              <div className="flex items-center justify-center rounded-lg">
                <img
                  src={logo}
                  alt="Swiftwapdrive"
                  className="h-6 w-6 rounded-lg text-primary-foreground"
                />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
                  Swiftwapdrive
                </h1>
                <p className="hidden text-xs text-muted-foreground -mt-0.5 sm:block">
                  WhatsApp → Google Drive
                </p>
              </div>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/admin">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Painel Admin"
                      >
                        <ShieldCheck className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Painel Admin</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
            </Button>
            <Link to="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6">
          <InstallBanner />
          {children}
        </div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}

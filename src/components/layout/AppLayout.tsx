import { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { InstallBanner } from "@/components/pwa/InstallBanner"
import { MobileBottomNav } from "@/components/layout/MobileBottomNav"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { HiOutlineBell, HiOutlineCog6Tooth, HiOutlineShieldCheck } from "react-icons/hi2"
import { FaCloud } from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { useIsAdmin } from "@/hooks/useIsAdmin"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAdmin } = useIsAdmin()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="fixed inset-x-0 top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:sticky md:inset-x-auto">
          <div className="flex items-center gap-2 flex-1">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <FaCloud className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                  Swiftwapdrive
                </h1>
                <p className="hidden text-xs text-muted-foreground -mt-0.5 sm:block">
                  WhatsApp → Google Drive
                </p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/admin">
                      <Button variant="ghost" size="icon" aria-label="Painel Admin">
                        <HiOutlineShieldCheck className="h-5 w-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Painel Admin</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button variant="ghost" size="icon" className="relative">
              <HiOutlineBell className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
            </Button>
            <Link to="/settings">
              <Button variant="ghost" size="icon">
                <HiOutlineCog6Tooth className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pb-24 pt-20 transition-all duration-300 md:pb-4 md:pt-4">
          <InstallBanner />
          {children}
        </div>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}

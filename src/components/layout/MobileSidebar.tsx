import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Link2, 
  FolderOpen, 
  Activity, 
  Settings,
  HelpCircle
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { SheetClose } from "@/components/ui/sheet";
import { FaCloud } from "react-icons/fa";
import logo from "@/assets/logo.png"

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Link2, label: "Conexões", href: "/connections" },
  { icon: FolderOpen, label: "Arquivos", href: "/files" },
  { icon: Activity, label: "Logs", href: "/logs", badge: "12" },
  { icon: Settings, label: "Configurações", href: "/settings" },
];

export function MobileSidebar() {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex items-center justify-center rounded-lg">
          <img src={logo} alt="Swiftwapdrive" className="h-10 w-10 rounded-lg text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Swiftwapdrive
          </h1>
          <p className="text-xs text-muted-foreground -mt-0.5">
            WhatsApp → Google Drive
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <SheetClose asChild key={item.href}>
              <Link
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary")} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {item.badge}
                  </span>
                )}
              </Link>
            </SheetClose>
          );
        })}
      </nav>

      {/* Help */}
      <div className="p-3">
        <div className="rounded-lg bg-sidebar-accent/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/10">
              <HelpCircle className="h-4 w-4 text-sidebar-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-sidebar-foreground">Precisa de ajuda?</p>
              <p className="text-xs text-muted-foreground">Ver documentação</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

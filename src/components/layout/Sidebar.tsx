import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Link2,
  FolderOpen,
  Activity,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from "@/lib/icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";

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

interface SidebarProps {
  currentPath?: string;
}

export function Sidebar({ currentPath }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const activePath = currentPath || location.pathname;
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] border-r border-border bg-sidebar transition-all duration-300 hidden lg:block",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = activePath === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary")} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
          {!adminLoading && isAdmin && (
            <div className="mt-3 border-t border-sidebar-border pt-3 space-y-1">
              {!collapsed && (
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin
                </p>
              )}
              <Link
                to="/admin/financial"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  activePath === "/admin/financial"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Wallet className={cn("h-5 w-5 shrink-0", activePath === "/admin/financial" && "text-sidebar-primary")} />
                {!collapsed && <span className="flex-1">Financeiro</span>}
              </Link>
            </div>
          )}
        </nav>

        {/* Help */}
        {!collapsed && (
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
        )}

        {/* Collapse Toggle */}
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-center"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Recolher</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}

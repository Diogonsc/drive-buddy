import * as React from "react"
import {
  Activity,
  Cloud,
  FolderOpen,
  LayoutDashboard,
  Link2,
  Settings2,
  Shield,
} from "@/lib/icons"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useIsAdmin } from "@/hooks/useIsAdmin"
import logo from "@/assets/logo.png"

// Dados do usuário e equipe
const data = {
  user: {
    name: "Usuário",
    email: "usuario@example.com",
    avatar: "",
  },
  teams: [
    {
      name: "Swiftwapdrive",
      logo: logo,
      plan: " WhatsApp → Google Drive",
    },
  ],
}

const baseNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Conexões", url: "/connections", icon: Link2 },
  { title: "Arquivos", url: "/files", icon: FolderOpen },
  { title: "Logs", url: "/logs", icon: Activity },
  { title: "Configurações", url: "/settings", icon: Settings2 },
]

const adminNavItem = {
  title: "Admin",
  url: "/admin",
  icon: Shield,
  items: [
    { title: "Dashboard", url: "/admin" },
    { title: "Financeiro", url: "/admin/financial" },
    { title: "Usuários", url: "/admin/users" },
    { title: "Arquivos", url: "/admin/media" },
    { title: "Logs", url: "/admin/logs" },
    { title: "Configurações", url: "/admin/settings" },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isAdmin } = useIsAdmin()
  const navItems = React.useMemo(
    () => (isAdmin ? [...baseNavItems, adminNavItem] : baseNavItems),
    [isAdmin]
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

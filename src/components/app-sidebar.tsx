import * as React from "react"
import {
  Activity,
  Cloud,
  FolderOpen,
  LayoutDashboard,
  Link2,
  Settings2,
  Shield,
} from "lucide-react"

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
      logo: Cloud,
      plan: " WhatsApp → Google Drive",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Conexões",
      url: "/connections",
      icon: Link2,
    },
    {
      title: "Arquivos",
      url: "/files",
      icon: FolderOpen,
    },
    {
      title: "Logs",
      url: "/logs",
      icon: Activity,
    },
    {
      title: "Configurações",
      url: "/settings",
      icon: Settings2,
    },
    {
      title: "Admin",
      url: "/admin",
      icon: Shield,
      items: [
        {
          title: "Dashboard",
          url: "/admin",
        },
        {
          title: "Usuários",
          url: "/admin/users",
        },
        {
          title: "Arquivos",
          url: "/admin/media",
        },
        {
          title: "Logs",
          url: "/admin/logs",
        },
        {
          title: "Configurações",
          url: "/admin/settings",
        }
      ],
    }
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

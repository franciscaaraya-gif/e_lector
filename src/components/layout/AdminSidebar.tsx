"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, ListChecks, LogOut, Settings, Users, UserCircle } from "lucide-react";
import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ElectorIcon } from "@/components/icons";

export function AdminSidebar() {
  const pathname = usePathname();
  const auth = useAuth();
  const router = useRouter();
  const { user } = useUser();

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.replace('/');
    }
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
            <Link href="/admin/dashboard" className="flex items-center gap-2 font-semibold text-lg">
                <ElectorIcon className="w-8 h-8 text-primary" />
                <span className="group-data-[collapsible=icon]:hidden font-headline">E-lector</span>
            </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith("/admin/dashboard") || pathname.startsWith("/admin/polls")}
              tooltip="Encuestas"
            >
              <Link href="/admin/dashboard">
                <BarChart2 />
                <span>Encuestas</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith("/admin/groups")}
              tooltip="Grupos"
            >
              <Link href="/admin/groups">
                <Users />
                <span>Grupos</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="App de Listas"
            >
              <Link href="https://studio-2564557381-68586.web.app/" target="_blank" rel="noopener noreferrer">
                <ListChecks />
                <span>App de Listas</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/admin/settings"}
              tooltip="Configuración"
              // @ts-ignore
              disabled
            >
              <Link href="#">
                <Settings />
                <span>Configuración</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        {user && (
            <div className="flex flex-col gap-2 p-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
                <SidebarSeparator />
                <div className="flex items-center gap-2 p-2">
                    <UserCircle className="h-5 w-5 shrink-0" />
                    <span className="truncate" title={user.email || ''}>{user.email}</span>
                </div>
            </div>
        )}
         <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} tooltip="Cerrar Sesión">
                  <LogOut />
                  <span>Cerrar Sesión</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
         </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

"use client";

import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from 'next/link';
import { useUser } from '@/firebase/provider';
import { SidebarProvider, SidebarInset, SidebarTrigger, Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { ElectorIcon } from "@/components/icons";
import { SidebarMenuSkeleton } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";


const FullScreenSkeleton = ({ children }: { children: ReactNode }) => (
    <SidebarProvider>
        <Sidebar>
            <SidebarHeader>
                <div className="flex items-center gap-2">
                    <Link href="/admin/dashboard" className="flex items-center gap-2 font-semibold text-lg pointer-events-none">
                        <ElectorIcon className="w-8 h-8 text-primary" />
                        <span className="font-headline group-data-[collapsible=icon]:hidden">
                            <Skeleton className="h-6 w-24" />
                        </span>
                    </Link>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    <SidebarMenuSkeleton showIcon />
                    <SidebarMenuSkeleton showIcon />
                    <SidebarMenuSkeleton showIcon />
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuSkeleton showIcon />
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
        <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:h-16 sm:px-6 md:hidden">
                <Skeleton className="h-7 w-7" />
                <Skeleton className="h-6 w-24" />
                <div className="w-7" />
            </header>
            <main className="flex-1 p-4 sm:p-6">
                {children}
            </main>
        </SidebarInset>
    </SidebarProvider>
);

const GenericContentSkeleton = () => (
    <div className="space-y-6">
       <CardHeader className="p-0">
           <Skeleton className="h-9 w-64" />
           <Skeleton className="h-5 w-80 mt-2" />
       </CardHeader>
       <Card>
           <CardHeader>
             <Skeleton className="h-10 w-full" />
           </CardHeader>
           <CardContent>
             <Skeleton className="h-40 w-full" />
           </CardContent>
       </Card>
     </div>
);


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading: loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/admin/login";
  // Un administrador auténtico es aquel que está logueado Y NO es anónimo
  const isAuthenticatedAdmin = user && !user.isAnonymous;

  useEffect(() => {
    if (loading) {
      return; 
    }

    // Si no es un administrador autenticado y no está en la página de login, redirigir a login
    if (!isAuthenticatedAdmin && !isLoginPage) {
      router.replace("/admin/login");
    }
    // Si ya es un administrador autenticado y está en la página de login, ir al dashboard
    if (isAuthenticatedAdmin && isLoginPage) {
      router.replace("/admin/dashboard");
    }
  }, [isAuthenticatedAdmin, loading, isLoginPage, router]);

  useEffect(() => {
    // Solución para el bug de Radix UI donde los overlays se quedan "pegados"
    const cleanup = () => {
      document
        .querySelectorAll('[data-radix-portal]')
        .forEach(el => el.remove());
    };

    cleanup();

    return cleanup;
  }, [pathname]);

  // 1. Si estamos en la página de login, renderizarla siempre.
  // El useEffect se encargará de sacarnos de aquí si ya somos administradores.
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 2. Si estamos en una página protegida, debemos esperar a que el usuario sea un administrador real.
  // Mientras carga, o si el usuario es anónimo/inexistente, mostrar skeleton.
  if (loading || !isAuthenticatedAdmin) {
    return <FullScreenSkeleton><GenericContentSkeleton /></FullScreenSkeleton>;
  }

  // 3. Renderizar el layout completo solo para administradores autenticados (no anónimos)
  return (
    <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:h-16 sm:px-6 md:hidden">
                <SidebarTrigger />
                <Link href="/admin/dashboard" className="flex items-center gap-2 font-semibold">
                    <ElectorIcon className="h-6 w-6 text-primary" />
                    <span className="font-headline">E-lector</span>
                </Link>
                <div className="w-7" />
            </header>
            <main className="flex-1 p-4 sm:p-6">
                {children}
            </main>
        </SidebarInset>
    </SidebarProvider>
  );
}

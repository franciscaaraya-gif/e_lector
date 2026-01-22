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


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading: loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return; // Do nothing while loading
    }
    
    // If the user is logged in and on the login page, redirect to the dashboard
    if (user && pathname === "/admin/login") {
      router.replace("/admin/dashboard");
    }
    
    // If the user is not logged in and not on the login page, redirect to login
    if (!user && pathname !== "/admin/login") {
      router.replace("/admin/login");
    }
  }, [user, loading, pathname, router]);

  const skeletonLayout = (content: ReactNode) => (
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
                {content}
            </main>
        </SidebarInset>
    </SidebarProvider>
  );

  if (loading) {
    // Show a skeleton layout while authenticating.
    // Next.js will pass the route's loading.tsx as children here.
    return skeletonLayout(children);
  }

  // This logic prevents a flash of content before redirection.
  if ((!user && pathname !== "/admin/login") || (user && pathname === "/admin/login")) {
    // Show the layout skeleton with a generic content skeleton inside.
    return skeletonLayout(
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
  }

  // If on login page, don't show the sidebar layout
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }
  
  // For all other admin pages, show the sidebar layout
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
                <div className="w-7" /> {/* Spacer to balance the trigger button */}
            </header>
            <main className="flex-1 p-4 sm:p-6">
                {children}
            </main>
        </SidebarInset>
    </SidebarProvider>
  );
}

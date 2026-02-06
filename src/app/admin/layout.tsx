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

  useEffect(() => {
    if (loading) {
      return; // Still loading, do nothing.
    }

    // Auth state is resolved. Now, check for redirects.
    if (!user && !isLoginPage) {
      router.replace("/admin/login");
    }
    if (user && isLoginPage) {
      router.replace("/admin/dashboard");
    }
  }, [user, loading, pathname, router]);

  useEffect(() => {
    // This is the forceful workaround for the Radix UI bug where overlays
    // get "stuck" and block pointer events. This effect ensures that any
    // orphaned Radix portal elements are removed from the DOM on every
    // route change within the admin panel, preventing a UI freeze.
    const cleanup = () => {
      document
        .querySelectorAll('[data-radix-portal]')
        .forEach(el => el.remove());
    };

    cleanup();

    return cleanup;
  }, [pathname]); // Re-run this effect on every navigation to clean up potential zombie overlays.

  // 1. If we are on the login page, render it.
  // The useEffect will handle redirecting away if the user is already logged in.
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 2. If we are on a protected page, we MUST wait for the user to be loaded and present.
  // While loading, or if there's no user (and a redirect is pending), show a full-screen skeleton.
  if (loading || !user) {
    // We pass a generic skeleton as children, NOT the actual page content.
    return <FullScreenSkeleton><GenericContentSkeleton /></FullScreenSkeleton>;
  }

  // 3. If we reach here, user is loaded and we are on a protected page. Render the full layout.
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

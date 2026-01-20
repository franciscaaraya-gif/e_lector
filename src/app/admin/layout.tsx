"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import useUserHook from "@/firebase/auth/useUserHook";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUserHook();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/admin/login") {
      router.replace("/admin/login");
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return <p>Cargando...</p>;
  }

  return <>{children}</>;
}

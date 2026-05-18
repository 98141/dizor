"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RoleRoute({ children, allowedRoles = [] }) {
  const router = useRouter();
  const { user, loadingAuth } = useAuth();

  useEffect(() => {
    if (!loadingAuth && !user) {
      router.push("/login");
      return;
    }

    if (!loadingAuth && user && !allowedRoles.includes(user.role)) {
      router.push("/cuenta");
    }
  }, [loadingAuth, user, allowedRoles, router]);

  if (loadingAuth) return <p>Cargando...</p>;

  if (!user) return null;

  if (!allowedRoles.includes(user.role)) return null;

  return children;
}
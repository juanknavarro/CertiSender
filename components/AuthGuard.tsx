"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // 1. Si no hay usuario y no está en /login, redirigir a /login
    if (!user && pathname !== "/login") {
      router.replace("/login");
      return;
    }

    // 2. Si hay usuario autenticado:
    if (user) {
      // Si el perfil aún no ha cargado completamente, esperar
      if (profile === null) return;

      // Si debe cambiar la contraseña provisional obligatoriamente y no está en /update-password
      if (profile.must_change_password && pathname !== "/update-password") {
        router.replace("/update-password");
        return;
      }

      // Si NO debe cambiar contraseña pero intenta ingresar a /update-password
      if (!profile.must_change_password && pathname === "/update-password") {
        router.replace("/");
        return;
      }

      // Si ya está autenticado e intenta volver a /login
      if (pathname === "/login") {
        router.replace(profile.must_change_password ? "/update-password" : "/");
        return;
      }
    }
  }, [user, profile, isLoading, pathname, router]);

  // En las rutas de acceso /login y /update-password se renderiza directamente su formulario
  if (pathname === "/login" || pathname === "/update-password") {
    return <>{children}</>;
  }

  // Mientras verifica sesión en rutas protegidas
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="h-10 w-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">
            Verificando credenciales de acceso institucional...
          </p>
        </div>
      </div>
    );
  }

  // Si no hay usuario mientras se ejecuta la redirección, no renderizar vistas protegidas
  if (!user) {
    return null;
  }

  return <>{children}</>;
}

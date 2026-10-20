"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Send,
  Menu,
  X,
  ShieldCheck,
  Award,
  Settings,
  Info,
  LogOut,
  Building2,
  PlayCircle,
  Users,
  GraduationCap,
  Sliders,
} from "lucide-react";
import packageInfo from "@/package.json";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  {
    name: "Emisión de Certificados",
    href: "/",
    icon: Send,
    badge: "Principal",
  },
  {
    name: "Reportes de Envío",
    href: "/reportes",
    icon: BarChart3,
    badge: "Bitácora",
  },
  {
    name: "Tutoriales",
    href: "/tutoriales",
    icon: PlayCircle,
    badge: "Guías",
  },
  {
    name: "Configuraciones",
    href: "/configuraciones",
    icon: Settings,
    badge: "Ajustes",
  },
  {
    name: "Acerca de",
    href: "/acerca-de",
    icon: Info,
    badge: "Info",
  },
];

const ADMIN_NAV_ITEMS = [
  {
    name: "Gestión de Usuarios",
    href: "/admin/usuarios",
    icon: Users,
    badge: "Admin",
  },
  {
    name: "Programas Académicos",
    href: "/admin/programas",
    icon: GraduationCap,
    badge: "Admin",
  },
  {
    name: "Ajustes del Sistema",
    href: "/admin/ajustes",
    icon: Sliders,
    badge: "Admin",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, role, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // No mostrar el Sidebar en las páginas de acceso y actualización de credenciales
  if (pathname === "/login" || pathname === "/update-password") {
    return null;
  }

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    router.replace("/login");
  };

  const isSuperadmin = role === "superadmin";

  const visibleNavItems = isSuperadmin
    ? [
        ...NAV_ITEMS.slice(0, 3),
        ...ADMIN_NAV_ITEMS,
        ...NAV_ITEMS.slice(3),
      ]
    : NAV_ITEMS;

  return (
    <>
      {/* Header Superior Móvil */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Award className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-lg text-slate-900 tracking-tight">
              CertiSender
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200/50">
              v{packageInfo.version}
            </span>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          aria-label="Abrir menú"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Menú Desplegable Móvil */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3 z-40 shadow-lg">
          {user && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {profile?.full_name || user.email}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    isSuperadmin
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                  }`}
                >
                  {isSuperadmin ? "Superadmin" : "Emisor"}
                </span>
              </div>
              {profile?.academic_programs?.name && (
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {profile.academic_programs.name}
                </p>
              )}
            </div>
          )}

          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/60 shadow-2xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? "text-indigo-600" : "text-slate-400"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-600">
                  {item.badge}
                </span>
              </Link>
            );
          })}

          {user && (
            <button
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 mt-2 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar Sesión</span>
            </button>
          )}
        </div>
      )}

      {/* Sidebar Persistente de Escritorio */}
      <aside className="hidden md:flex flex-col w-68 shrink-0 bg-white border-r border-slate-200/90 min-h-screen p-5 justify-between sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-6">
          {/* Logo / Encabezado */}
          <Link href="/" className="flex items-center gap-3 px-1 py-1 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Award className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-slate-900 tracking-tight">
                  CertiSender
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                  v{packageInfo.version}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                Emisión & Despacho
              </p>
            </div>
          </Link>

          {/* Tarjeta del Usuario Actual Autenticado */}
          {user && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {profile?.full_name ? profile.full_name[0].toUpperCase() : "U"}
                  </div>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      isSuperadmin
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                    }`}
                  >
                    {isSuperadmin ? "Superadmin" : "Emisor"}
                  </span>
                </div>

                <button
                  onClick={() => setShowLogoutModal(true)}
                  title="Cerrar Sesión"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 truncate">
                  {profile?.full_name || user.email}
                </h4>
                {profile?.cedula && (
                  <p className="text-[11px] text-slate-500 font-mono">
                    C.C. {profile.cedula}
                  </p>
                )}
                {profile?.academic_programs?.name && (
                  <div className="flex items-center gap-1 text-[10px] text-indigo-900 font-medium mt-1 truncate">
                    <Building2 className="h-3 w-3 shrink-0 text-indigo-600" />
                    <span className="truncate">{profile.academic_programs.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enlaces de Navegación */}
          <nav className="space-y-1.5 pt-1">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Módulos del Sistema
            </div>
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/80 shadow-2xs"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-0.5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? "text-indigo-600" : "text-slate-400"
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                      isActive
                        ? "bg-indigo-100/70 text-indigo-800"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.badge}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Pie del Sidebar */}
        <div className="pt-6 border-t border-slate-100 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <div className="text-[11px]">
              <span className="font-semibold text-slate-700 block">
                Sesión Institucional
              </span>
              <span>Supabase RLS / Cifrado TLS</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>CertiSender v{packageInfo.version}</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" title="En línea" />
          </div>
        </div>
      </aside>

      {/* Modal de Confirmación de Cierre de Sesión */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm border border-slate-200 shadow-2xl p-6 space-y-5 text-center animate-in zoom-in-95 duration-150">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                ¿Estás seguro de que deseas cerrar sesión?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tendrás que volver a ingresar tus credenciales institucionales para emitir certificados o consultar reportes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmLogout}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

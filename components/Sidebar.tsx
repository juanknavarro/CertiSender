"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Send,
  Menu,
  X,
  ShieldCheck,
  Award,
} from "lucide-react";

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
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Award className="h-5 w-5 stroke-[2.2]" />
          </div>
          <span className="font-bold text-lg text-slate-900 tracking-tight">
            CertiSender
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          aria-label="Abrir menú"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Slide-down Overlay */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-2 z-40 shadow-lg">
          {NAV_ITEMS.map((item) => {
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
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white border-r border-slate-200/90 min-h-screen p-5 justify-between sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-6">
          {/* Logo / Brand Header */}
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
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                Emisión & Despacho
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-2">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Módulos del Sistema
            </div>
            {NAV_ITEMS.map((item) => {
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

        {/* Sidebar Footer Info */}
        <div className="pt-6 border-t border-slate-100 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <div className="text-[11px]">
              <span className="font-semibold text-slate-700 block">
                Sesión Segura
              </span>
              <span>TLS / SMTP Encriptado</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>CertiSender Platform</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" title="En línea" />
          </div>
        </div>
      </aside>
    </>
  );
}

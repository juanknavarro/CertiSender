"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  Award,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import packageInfo from "@/package.json";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Textos dinámicos del CMS con valores por defecto para evitar parpadeos
  const [settings, setSettings] = useState({
    login_title: "CertiSender",
    login_subtitle:
      "Portal institucional de emisión de certificados y auditoría académica.",
    login_notice_title: "Portal de Registro Cerrado",
    login_notice_body:
      "La creación de cuentas y la asignación a programas académicos son administradas exclusivamente por el Superadmin de la facultad. Si aún no posees acceso, solicita la habilitación a tu director de programa.",
    footer_security_text: "Acceso Seguro con Supabase RLS & TLS",
    footer_credits:
      "CertiSender © 2026 • Desarrollado por el Ing. Juan Carlos Navarro Ramos",
  });

  useEffect(() => {
    let ignore = false;
    async function loadDynamicSettings() {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle();

        if (!ignore && data) {
          setSettings((prev) => ({
            login_title: data.login_title || prev.login_title,
            login_subtitle: data.login_subtitle || prev.login_subtitle,
            login_notice_title:
              data.login_notice_title || prev.login_notice_title,
            login_notice_body: data.login_notice_body || prev.login_notice_body,
            footer_security_text:
              data.footer_security_text || prev.footer_security_text,
            footer_credits: data.footer_credits || prev.footer_credits,
          }));
        }
      } catch (err) {
        console.warn("Error al consultar app_settings en login:", err);
      }
    }
    loadDynamicSettings();
    return () => {
      ignore = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage("Por favor ingresa tu correo y contraseña institucional.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(cleanEmail, password);
      if (result.error) {
        if (
          result.error.toLowerCase().includes("invalid login credentials") ||
          result.error.toLowerCase().includes("invalid_grant")
        ) {
          setErrorMessage(
            "Credenciales incorrectas. Verifica tu correo institucional y contraseña."
          );
        } else {
          setErrorMessage(result.error);
        }
        setIsSubmitting(false);
      } else {
        router.replace("/");
      }
    } catch {
      setErrorMessage("Error de conexión al servidor de autenticación.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-br from-slate-100 via-indigo-50/40 to-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Fondo con detalles sutiles de diseño */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Tarjeta Principal de Login */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/80 shadow-xl space-y-6">
          {/* Encabezado e Isotipo */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 mb-1">
              <Award className="h-7 w-7 stroke-[2.2]" />
            </div>

            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {settings.login_title}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                v{packageInfo.version}
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
              {settings.login_subtitle}
            </p>
          </div>

          {/* Alerta de Error */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 flex items-start gap-2.5 text-xs animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-500 hover:text-rose-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Correo */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-bold text-slate-700 uppercase tracking-wider block"
              >
                Correo Institucional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="usuario@unisinu.edu.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all font-medium"
                />
              </div>
            </div>

            {/* Input Contraseña */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs font-bold text-slate-700 uppercase tracking-wider block"
              >
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  aria-label={showPassword ? "Ocultar clave" : "Mostrar clave"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Botón de Envío */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Validando acceso...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Aviso de Registro Cerrado */}
          <div className="pt-2 border-t border-slate-100">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>{settings.login_notice_title}</span>
              </div>
              <p className="whitespace-pre-line">{settings.login_notice_body}</p>
            </div>
          </div>
        </div>

        {/* Footer de Seguridad */}
        <div className="mt-6 text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white/70 backdrop-blur-xs px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>{settings.footer_security_text}</span>
          </div>

          <p className="text-[11px] text-slate-400">
            {settings.footer_credits}
          </p>
        </div>
      </div>
    </div>
  );
}

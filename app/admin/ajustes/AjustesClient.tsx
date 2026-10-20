"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  Sliders,
  Save,
  RotateCcw,
  ShieldCheck,
  Award,
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileText,
} from "lucide-react";
import packageInfo from "@/package.json";

interface AppSettings {
  id: number;
  login_title: string;
  login_subtitle: string;
  login_notice_title: string;
  login_notice_body: string;
  footer_security_text: string;
  footer_credits: string;
  updated_at?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  login_title: "CertiSender",
  login_subtitle:
    "Portal institucional de emisión de certificados y auditoría académica.",
  login_notice_title: "Portal de Registro Cerrado",
  login_notice_body:
    "La creación de cuentas y la asignación a programas académicos son administradas exclusivamente por el Superadmin de la facultad. Si aún no posees acceso, solicita la habilitación a tu director de programa.",
  footer_security_text: "Acceso Seguro con Supabase RLS & TLS",
  footer_credits:
    "CertiSender © 2026 • Desarrollado por el Ing. Juan Carlos Navarro Ramos",
};

export default function AjustesClient() {
  const { role, user, isLoading: isAuthLoading } = useAuth();
  const isSuperadmin = role === "superadmin";

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Cargar configuraciones de Supabase
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        console.warn("Error al cargar app_settings:", error.message);
      } else if (data) {
        setSettings({
          id: 1,
          login_title: data.login_title || DEFAULT_SETTINGS.login_title,
          login_subtitle:
            data.login_subtitle || DEFAULT_SETTINGS.login_subtitle,
          login_notice_title:
            data.login_notice_title || DEFAULT_SETTINGS.login_notice_title,
          login_notice_body:
            data.login_notice_body || DEFAULT_SETTINGS.login_notice_body,
          footer_security_text:
            data.footer_security_text || DEFAULT_SETTINGS.footer_security_text,
          footer_credits:
            data.footer_credits || DEFAULT_SETTINGS.footer_credits,
          updated_at: data.updated_at,
        });
      }
    } catch (err) {
      console.error("Excepción al consultar ajustes:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Guardar cambios en Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const payload = {
        login_title: settings.login_title.trim() || DEFAULT_SETTINGS.login_title,
        login_subtitle:
          settings.login_subtitle.trim() || DEFAULT_SETTINGS.login_subtitle,
        login_notice_title:
          settings.login_notice_title.trim() ||
          DEFAULT_SETTINGS.login_notice_title,
        login_notice_body:
          settings.login_notice_body.trim() ||
          DEFAULT_SETTINGS.login_notice_body,
        footer_security_text:
          settings.footer_security_text.trim() ||
          DEFAULT_SETTINGS.footer_security_text,
        footer_credits:
          settings.footer_credits.trim() || DEFAULT_SETTINGS.footer_credits,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      };

      const { error } = await supabase
        .from("app_settings")
        .update(payload)
        .eq("id", 1);

      if (error) {
        throw new Error(error.message);
      }

      showToast("Configuraciones del sistema guardadas exitosamente.");
    } catch (err: unknown) {
      console.error("Error al guardar ajustes:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Error inesperado al guardar ajustes.";
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Restaurar valores por defecto
  const handleResetDefaults = () => {
    if (
      !confirm(
        "¿Deseas restaurar todos los textos corporativos a los valores institucionales por defecto?"
      )
    ) {
      return;
    }
    setSettings(DEFAULT_SETTINGS);
    showToast("Valores por defecto cargados en el formulario. Recuerda hacer clic en Guardar.");
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">
            Cargando ajustes del sistema...
          </p>
        </div>
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="h-14 w-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Acceso Denegado</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          Este módulo está restringido exclusivamente para el rol de Superadmin de
          la facultad.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white text-xs font-semibold rounded-2xl shadow-xl shadow-emerald-600/20 animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cabecera */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Ajustes del Sistema
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200/60">
              CMS Global
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Administra los textos institucionales dinámicos del portal de ingreso (Login) y créditos corporativos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restablecer</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Layout de 2 Columnas: Formulario CMS + Vista Previa en Vivo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Formulario (7 columnas) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Textos del Portal de Acceso y Pie de Página
              </h2>
              <p className="text-[11px] text-slate-500">
                Los cambios se reflejarán de inmediato para todos los docentes de la facultad.
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            {/* Título de la Aplicación */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Nombre de la Aplicación
              </label>
              <input
                type="text"
                value={settings.login_title}
                onChange={(e) =>
                  setSettings({ ...settings, login_title: e.target.value })
                }
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                required
              />
            </div>

            {/* Subtítulo de Bienvenida */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Subtítulo de Bienvenida (Login)
              </label>
              <textarea
                rows={2}
                value={settings.login_subtitle}
                onChange={(e) =>
                  setSettings({ ...settings, login_subtitle: e.target.value })
                }
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium resize-none"
                required
              />
            </div>

            {/* Título del Aviso de Registro Cerrado */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Título de la Tarjeta Informativa
              </label>
              <input
                type="text"
                value={settings.login_notice_title}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    login_notice_title: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                required
              />
            </div>

            {/* Cuerpo del Aviso de Registro Cerrado */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Cuerpo de la Tarjeta Informativa
              </label>
              <textarea
                rows={3}
                value={settings.login_notice_body}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    login_notice_body: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium resize-none leading-relaxed"
                required
              />
            </div>

            {/* Texto de Seguridad */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Insignia de Seguridad (Footer)
              </label>
              <input
                type="text"
                value={settings.footer_security_text}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    footer_security_text: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                required
              />
            </div>

            {/* Créditos de Autoría */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Créditos Institucionales y Derechos de Autor
              </label>
              <input
                type="text"
                value={settings.footer_credits}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    footer_credits: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                required
              />
            </div>

            {/* Botón Guardar */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando ajustes...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Guardar Cambios en app_settings</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Columna Derecha: Vista Previa en Vivo (5 columnas) */}
        <div className="lg:col-span-5 space-y-3 sticky top-6">
          <div className="flex items-center gap-2 px-1 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <Eye className="h-3.5 w-3.5" />
            <span>Previsualización en Vivo de la Pantalla de Login</span>
          </div>

          {/* Miniatura simulada del Login */}
          <div className="bg-gradient-to-br from-slate-100 via-indigo-50/30 to-slate-100 p-5 rounded-3xl border border-slate-200/80 shadow-md">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
              {/* Header simulado */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md mb-0.5">
                  <Award className="h-5 w-5 stroke-[2.2]" />
                </div>

                <div className="flex items-center justify-center gap-1.5">
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                    {settings.login_title || "CertiSender"}
                  </h3>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                    v{packageInfo.version}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
                  {settings.login_subtitle ||
                    "Portal institucional de emisión de certificados y auditoría académica."}
                </p>
              </div>

              {/* Mock inputs */}
              <div className="space-y-2 opacity-60 pointer-events-none">
                <div className="h-8 bg-slate-50 rounded-lg border border-slate-200" />
                <div className="h-8 bg-slate-50 rounded-lg border border-slate-200" />
                <div className="h-8 bg-indigo-600 rounded-lg" />
              </div>

              {/* Aviso dinámico simulado */}
              <div className="pt-2 border-t border-slate-100">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 text-[10px] text-slate-600 space-y-1 leading-relaxed">
                  <div className="flex items-center gap-1 font-bold text-slate-800">
                    <Sparkles className="h-3 w-3 text-indigo-600" />
                    <span>{settings.login_notice_title}</span>
                  </div>
                  <p>{settings.login_notice_body}</p>
                </div>
              </div>
            </div>

            {/* Footer simulado */}
            <div className="mt-4 text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 bg-white/80 px-2.5 py-1 rounded-full border border-slate-200/80 shadow-2xs">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                <span>{settings.footer_security_text}</span>
              </div>

              <p className="text-[10px] text-slate-400 font-medium">
                {settings.footer_credits}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

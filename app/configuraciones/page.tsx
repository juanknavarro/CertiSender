"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Settings,
  User,
  CreditCard,
  Eye,
  RotateCcw,
  CheckCircle2,
  Sliders,
  Palette,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react";
import { useSettings, DEFAULT_SETTINGS } from "@/context/SettingsContext";

export default function ConfiguracionesPage() {
  const { settings, updateSettings, resetSettings, isLoaded } = useSettings();
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Notificación temporal al restablecer
  const handleReset = () => {
    resetSettings();
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2500);
  };

  // Normalizador seguro para el input type="color"
  const safeColor = (hex: string, fallback: string): string => {
    return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : fallback;
  };

  // Manejo de cambios en el input de texto HEX
  const handleHexInput = (
    key: "nameColorHex" | "docColorHex",
    rawVal: string
  ) => {
    let clean = rawVal.trim();
    if (clean && !clean.startsWith("#")) {
      clean = `#${clean}`;
    }
    updateSettings({ [key]: clean });
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const isDefault =
    settings.nameFontSize === DEFAULT_SETTINGS.nameFontSize &&
    settings.docFontSize === DEFAULT_SETTINGS.docFontSize &&
    settings.nameColorHex.toLowerCase() ===
      DEFAULT_SETTINGS.nameColorHex.toLowerCase() &&
    settings.docColorHex.toLowerCase() ===
      DEFAULT_SETTINGS.docColorHex.toLowerCase();

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Encabezado Principal */}
      <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-3">
            <Sliders className="h-3.5 w-3.5" />
            <span>Parametrización Visual v2.1</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Settings className="h-7 w-7 text-indigo-600" />
            Configuraciones del Certificado
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Ajusta los tamaños de tipografía y paleta de colores para los textos
            del certificado. Los cambios se guardan automáticamente en tu
            navegador y se reflejan de inmediato al emitir PDFs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleReset}
            disabled={isDefault}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-xs cursor-pointer ${
              isDefault
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400"
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            <span>Restablecer por Defecto</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs"
          >
            <span>Ir a Emisión</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Alerta de notificación al restablecer */}
      {showSavedToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2 text-sm shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Configuración restablecida a los valores de fábrica con éxito.</span>
        </div>
      )}

      {/* Layout de Controles y Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Tarjetas de Configuración (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tarjeta 1: Nombre del Participante */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Nombre del Participante
                  </h2>
                  <p className="text-xs text-slate-500">
                    Texto principal centrado sobre la línea divisoria
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200/50">
                {settings.nameFontSize} pt • {settings.nameColorHex}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Tamaño de Fuente */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <span>Tamaño de Fuente</span>
                  <span className="text-indigo-600 font-mono">
                    {settings.nameFontSize} px
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={50}
                    step={1}
                    value={settings.nameFontSize}
                    onChange={(e) =>
                      updateSettings({
                        nameFontSize: Number(e.target.value) || 28,
                      })
                    }
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <input
                    type="number"
                    min={10}
                    max={50}
                    value={settings.nameFontSize}
                    onChange={(e) =>
                      updateSettings({
                        nameFontSize: Number(e.target.value) || 28,
                      })
                    }
                    className="w-20 px-2.5 py-1.5 text-center text-sm font-semibold rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Rango recomendado: 20 a 36 pt (Por defecto: 28)
                </p>
              </div>

              {/* Selector de Color */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <Palette className="h-3.5 w-3.5 text-slate-500" />
                  <span>Color del Texto</span>
                </label>
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <input
                      type="color"
                      value={safeColor(settings.nameColorHex, "#1a264d")}
                      onChange={(e) =>
                        updateSettings({ nameColorHex: e.target.value })
                      }
                      className="h-10 w-12 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white shadow-2xs"
                    />
                  </div>
                  <input
                    type="text"
                    maxLength={7}
                    value={settings.nameColorHex}
                    onChange={(e) =>
                      handleHexInput("nameColorHex", e.target.value)
                    }
                    placeholder="#1a264d"
                    className="flex-1 font-mono uppercase text-sm font-semibold px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Formato HEX (#RRGGBB). Por defecto: #1a264d
                </p>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Documento de Identidad */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Tipo y Número de Documento
                  </h2>
                  <p className="text-xs text-slate-500">
                    Texto secundario ubicado justo por debajo de la línea
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                {settings.docFontSize} pt • {settings.docColorHex}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Tamaño de Fuente */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <span>Tamaño de Fuente</span>
                  <span className="text-indigo-600 font-mono">
                    {settings.docFontSize} px
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={8}
                    max={30}
                    step={1}
                    value={settings.docFontSize}
                    onChange={(e) =>
                      updateSettings({
                        docFontSize: Number(e.target.value) || 14,
                      })
                    }
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <input
                    type="number"
                    min={8}
                    max={30}
                    value={settings.docFontSize}
                    onChange={(e) =>
                      updateSettings({
                        docFontSize: Number(e.target.value) || 14,
                      })
                    }
                    className="w-20 px-2.5 py-1.5 text-center text-sm font-semibold rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Rango recomendado: 12 a 18 pt (Por defecto: 14)
                </p>
              </div>

              {/* Selector de Color */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <Palette className="h-3.5 w-3.5 text-slate-500" />
                  <span>Color del Texto</span>
                </label>
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <input
                      type="color"
                      value={safeColor(settings.docColorHex, "#4d4d4d")}
                      onChange={(e) =>
                        updateSettings({ docColorHex: e.target.value })
                      }
                      className="h-10 w-12 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white shadow-2xs"
                    />
                  </div>
                  <input
                    type="text"
                    maxLength={7}
                    value={settings.docColorHex}
                    onChange={(e) =>
                      handleHexInput("docColorHex", e.target.value)
                    }
                    placeholder="#4d4d4d"
                    className="flex-1 font-mono uppercase text-sm font-semibold px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Formato HEX (#RRGGBB). Por defecto: #4d4d4d
                </p>
              </div>
            </div>
          </div>

          {/* Información y Consejos de Diseño */}
          <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 flex items-start gap-3.5 text-xs text-indigo-900 leading-relaxed">
            <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-indigo-950 block">
                ¿Cómo impactan estos valores en el PDF final?
              </span>
              <p className="text-indigo-800/90">
                La biblioteca <code>pdf-lib</code> convierte los valores HEX en
                coordenadas cromáticas normalizadas (0 a 1) y centra el texto
                horizontalmente basándose en el ancho tipográfico exacto
                calculado por la fuente estándar Helvetica-Bold.
              </p>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Tarjeta de Vista Previa Dinámica (5 cols) */}
        <div className="lg:col-span-5 sticky top-6 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Eye className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Vista Previa en Vivo
                </h2>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                <Sparkles className="h-3 w-3 text-emerald-600" />
                Tiempo Real
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Previsualización aproximada de la disposición y jerarquía visual del
              certificado en pantalla:
            </p>

            {/* Canvas / Simulador del Certificado */}
            <div className="relative rounded-xl border-2 border-dashed border-amber-200/80 bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 p-8 text-center shadow-inner overflow-hidden min-h-[260px] flex flex-col justify-center items-center">
              {/* Esquinas decorativas del certificado */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-400/60" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-400/60" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-400/60" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-400/60" />

              <div className="text-[11px] font-serif tracking-widest text-slate-400 uppercase mb-3 select-none">
                — Otorga la presente constancia a —
              </div>

              {/* Texto Nombre Dinámico */}
              <div
                className="font-bold tracking-tight select-none transition-all duration-150 leading-tight break-words max-w-full px-2"
                style={{
                  fontSize: `${settings.nameFontSize}px`,
                  color: settings.nameColorHex,
                  fontFamily: "Helvetica, Arial, sans-serif",
                }}
              >
                CARLOS ANDRÉS MARTÍNEZ
              </div>

              {/* Línea divisoria dorada ornamental */}
              <div className="w-48 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent my-3.5 opacity-90" />

              {/* Texto Documento Dinámico */}
              <div
                className="font-semibold tracking-normal select-none transition-all duration-150 leading-none"
                style={{
                  fontSize: `${settings.docFontSize}px`,
                  color: settings.docColorHex,
                  fontFamily: "Helvetica, Arial, sans-serif",
                }}
              >
                CC. 1098765432
              </div>

              <div className="text-[10px] text-slate-400 italic mt-4 select-none">
                Por su destacada participación en el programa formativo.
              </div>
            </div>

            {/* Parámetros activos resumen */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/60 space-y-2 text-xs">
              <div className="font-semibold text-slate-700 flex items-center justify-between">
                <span>Resumen de Parámetros:</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Persistencia Local
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col gap-0.5">
                  <span className="text-slate-400">Nombre:</span>
                  <span className="font-semibold text-slate-800">
                    {settings.nameFontSize} px
                  </span>
                  <span
                    className="font-mono text-[10px] inline-flex items-center gap-1"
                    style={{ color: settings.nameColorHex }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block border border-slate-200"
                      style={{ backgroundColor: settings.nameColorHex }}
                    />
                    {settings.nameColorHex}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col gap-0.5">
                  <span className="text-slate-400">Documento:</span>
                  <span className="font-semibold text-slate-800">
                    {settings.docFontSize} px
                  </span>
                  <span
                    className="font-mono text-[10px] inline-flex items-center gap-1"
                    style={{ color: settings.docColorHex }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block border border-slate-200"
                      style={{ backgroundColor: settings.docColorHex }}
                    />
                    {settings.docColorHex}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

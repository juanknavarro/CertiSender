"use client";

import React from "react";
import Link from "next/link";
import {
  Award,
  ShieldCheck,
  Send,
  Sliders,
  FileSpreadsheet,
  FileDown,
  Mail,
  Database,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import packageInfo from "@/package.json";

export default function AcercaDePage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-14 font-sans">
      {/* Header Principal Hero */}
      <div className="relative overflow-hidden bg-white rounded-3xl p-8 md:p-10 border border-slate-200/90 shadow-xs">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-50/70 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-blue-50/70 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>Plataforma Académica Oficial • v{packageInfo.version}</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Award className="h-6 w-6 stroke-[2.2]" />
              </div>
              Acerca de CertiSender
            </h1>

            <p className="text-slate-600 text-sm md:text-base leading-relaxed">
              CertiSender es una plataforma automatizada para la generación masiva
              de certificados en formato PDF vectorial y despacho dinámico
              mediante SMTP, optimizada para entornos académicos, eventos
              científicos y organizaciones que requieren una emisión confiable,
              auditable y de alta fidelidad estética.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <Send className="h-4 w-4" />
              <span>Emisión de Certificados</span>
            </Link>
            <Link
              href="/reportes"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition-colors"
            >
              <span>Ver Bitácora de Envíos</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
            </Link>
          </div>
        </div>
      </div>

      {/* Sección de Créditos de Autoría Destacada */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-md border border-indigo-900/60">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-amber-300 shadow-inner">
              <UserCheck className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Créditos de Autoría
                </span>
                <span className="text-xs text-indigo-200">
                  Ingeniería de Software
                </span>
              </div>
              <h2 className="text-lg md:text-xl font-bold tracking-tight text-white mt-1">
                Desarrollado por el Ing. Juan Carlos Navarro Ramos
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Diseño de arquitectura, motor de despacho SMTP y renderizado vectorial de documentos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl self-start sm:self-auto">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Versión 2.1.0 • Producción Lista</span>
          </div>
        </div>
      </div>

      {/* Pilares Funcionales del Sistema (Grid de Cards) */}
      <div>
        <div className="mb-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            Capacidades Principales de la Plataforma
          </h3>
          <p className="text-xs text-slate-500">
            Módulos integrados que componen la solución integral de CertiSender.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Tarjeta 1: Motor PDF Dinámico */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3 hover:border-indigo-200 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Award className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              Plantillas PDF Dinámicas
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Carga directa de plantillas base en PDF por Drag & Drop. Manipulación
              vectorial de texto con <code>pdf-lib</code> y cálculo de centrado
              óptico horizontal y calibración vertical.
            </p>
          </div>

          {/* Tarjeta 2: Despacho SMTP Seguro */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3 hover:border-indigo-200 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Mail className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              Despacho SMTP Dinámico
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Envío secuencial o en lote con credenciales configurables desde la
              interfaz de usuario, soporte TLS cifrado y adjunto del certificado
              generado en memoria sin almacenamiento en disco.
            </p>
          </div>

          {/* Tarjeta 3: Bitácora & Supabase */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3 hover:border-indigo-200 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Database className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              Auditoría en Supabase
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Persistencia en tiempo real de cada certificado enviado exitosamente
              en la tabla <code>sent_certificates</code>, con filtros por rango de fechas
              y métricas de entrega.
            </p>
          </div>

          {/* Tarjeta 4: Reportes en PDF */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3 hover:border-indigo-200 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <FileDown className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              Exportación Vectorial a PDF
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Generación de informes de auditoría paginados con <code>jsPDF</code> y{" "}
              <code>jspdf-autotable</code>, listos para imprimir o archivar sin
              dependencias de captura de pantalla.
            </p>
          </div>

          {/* Tarjeta 5: Parametrización Visual */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3 hover:border-indigo-200 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Sliders className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              Configuraciones y Estilos
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Personalización de tamaños de fuente y paleta cromática con
              selectores de color y previsualización en vivo, persistidos en el
              navegador con React Context y localStorage.
            </p>
          </div>

          {/* Tarjeta 6: Ingesta Excel Masiva */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-3 hover:border-indigo-200 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              Lectura XLSX y Normalización
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Extracción automática y mapeo inteligente de columnas desde hojas de
              cálculo Excel (.xlsx / .xls) con enumeración correlativa y validación
              de correos.
            </p>
          </div>
        </div>
      </div>

      {/* Stack Tecnológico */}
      <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Stack Tecnológico & Arquitectura
          </h3>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {[
            "Next.js 16 (App Router)",
            "Turbopack",
            "React 19",
            "TypeScript",
            "Tailwind CSS v4",
            "Supabase (PostgreSQL)",
            "pdf-lib",
            "jsPDF & AutoTable",
            "Nodemailer (SMTP/TLS)",
            "xlsx (SheetJS)",
            "Lucide React",
          ].map((tech) => (
            <span
              key={tech}
              className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Pie de Página Institucional */}
      <div className="pt-6 border-t border-slate-200/80 text-center space-y-1">
        <p className="text-xs font-semibold text-slate-700">
          CertiSender © 2026 • Plataforma Integral de Emisión y Auditoría
        </p>
        <p className="text-[11px] text-slate-400 font-medium">
          Desarrollado por el Ing. Juan Carlos Navarro Ramos
        </p>
      </div>
    </div>
  );
}

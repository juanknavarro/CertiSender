"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Calendar,
  Send,
  Filter,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Mail,
  User,
  Clock,
  ShieldCheck,
  Search,
  FileDown,
} from "lucide-react";
import { exportReportsToPDF } from "@/utils/reportPdfExporter";

export interface SentCertificateRecord {
  id: string;
  recipient_name: string;
  recipient_email: string;
  doc_type: string;
  doc_number: string;
  sender_email: string;
  sent_at: string;
}

// Formatea la fecha ISO a formato dd/mm/yyyy HH:MM
function formatDateTime(dateString: string): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
}

export default function ReportesPage() {
  const [records, setRecords] = useState<SentCertificateRecord[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Consulta de reportes a la API
  const fetchReports = useCallback(
    async (start: string, end: string) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const params = new URLSearchParams();
        if (start.trim()) params.append("startDate", start.trim());
        if (end.trim()) params.append("endDate", end.trim());

        const res = await fetch(`/api/reports?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Error ${res.status}`);
        }

        if (data.warning) {
          setWarningMessage(data.warning);
        } else {
          setWarningMessage(null);
        }

        setRecords(data.data || []);
      } catch (err: unknown) {
        console.error("Error al obtener reportes:", err);
        const msg =
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los reportes de envío.";
        setErrorMessage(msg);
        setRecords([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Carga inicial en el montaje
  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      try {
        const res = await fetch("/api/reports");
        const data = await res.json();
        if (!ignore) {
          if (data.warning) setWarningMessage(data.warning);
          setRecords(data.data || []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg =
            err instanceof Error ? err.message : "Error al cargar reportes.";
          setErrorMessage(msg);
          setRecords([]);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      ignore = true;
    };
  }, []);

  // Manejador para aplicar filtros
  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReports(startDate, endDate);
  };

  // Manejador para limpiar filtros
  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    fetchReports("", "");
  };

  // Exportar registros visibles a PDF vectorial
  const handleExportPDF = () => {
    if (records.length === 0) {
      alert("No hay registros disponibles para exportar en este momento.");
      return;
    }
    try {
      exportReportsToPDF(records, startDate, endDate);
    } catch (err: unknown) {
      console.error("Error al exportar a PDF:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al generar el PDF de reportes."
      );
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Header Principal */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Historial de Emisiones
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Supabase Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Bitácora de auditoría histórica de certificados enviados con filtros de fecha y métricas en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isLoading || records.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-900 text-slate-700 font-semibold text-xs transition-colors shadow-2xs w-fit cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              records.length === 0
                ? "No hay registros para exportar"
                : "Exportar reporte oficial en PDF vectorial"
            }
          >
            <FileDown className="h-3.5 w-3.5 text-indigo-600" />
            <span>Exportar a PDF</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-2xs w-fit cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Nueva Emisión</span>
          </Link>
        </div>
      </div>

      {/* Alerta de advertencia o configuración de Supabase */}
      {warningMessage && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs font-medium leading-relaxed">
            <strong className="block font-bold mb-0.5">Aviso de Configuración:</strong>
            {warningMessage}
          </div>
        </div>
      )}

      {/* Alerta de error */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs font-medium flex-1">
            {errorMessage}
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* SECCIÓN SUPERIOR: FILTROS + MÉTRICAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-stretch">
        {/* Tarjeta de Filtros de Fecha (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Filtro por Rango de Fechas
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Filtra por día exacto o periodo
              </span>
            </div>

            <form
              onSubmit={handleFilter}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {/* Fecha Inicio */}
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Fecha Inicio
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Fecha Fin */}
              <div>
                <label
                  htmlFor="endDate"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Fecha Fin
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Botones de Acción de Filtro */}
              <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Limpiar Filtros</span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Filtrar</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Tarjeta de Métricas (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
                Métricas de Consulta
              </span>
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
            </div>

            <p className="text-xs text-indigo-200">Total certificados enviados</p>
            <div className="text-4xl font-extrabold tracking-tight mt-1">
              {isLoading ? (
                <span className="inline-block h-8 w-16 bg-white/20 animate-pulse rounded" />
              ) : (
                records.length
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-indigo-200">
            <span>
              {startDate || endDate
                ? "Filtro activo aplicado"
                : "Histórico completo"}
            </span>
            <div className="flex items-center gap-1 text-emerald-400 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Auditado</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN INFERIOR: TABLA DE RESULTADOS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-600" />
            <h3 className="font-semibold text-sm text-slate-900">
              Registros de Envíos Realizados
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              {records.length} registro(s) encontrados
            </span>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isLoading || records.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar registros filtrados a PDF"
            >
              <FileDown className="h-3.5 w-3.5 text-indigo-600" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>

        {/* Contenedor de la Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th scope="col" className="w-12 px-3.5 py-3.5 text-center">
                  #
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Participante
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Documento
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Correo Destino
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Fecha de Envío
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Remitente
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                /* Estado de Carga (Skeletons) */
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <div className="h-6 w-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                      <span className="text-xs font-semibold">
                        Consultando bitácora de Supabase...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : records.length > 0 ? (
                records.map((record, idx) => (
                  <tr
                    key={record.id || idx}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* # Índice Numérico */}
                    <td className="w-12 px-3.5 py-3.5 text-center font-mono text-xs font-semibold text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Participante */}
                    <td className="px-6 py-3.5 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <span>{record.recipient_name}</span>
                      </div>
                    </td>

                    {/* Documento */}
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-700">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 mr-1.5">
                        {record.doc_type || "CC"}
                      </span>
                      {record.doc_number || "N/A"}
                    </td>

                    {/* Correo Destino */}
                    <td className="px-6 py-3.5 font-mono text-xs text-blue-600">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{record.recipient_email}</span>
                      </div>
                    </td>

                    {/* Fecha de Envío */}
                    <td className="px-6 py-3.5 text-xs text-slate-700 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{formatDateTime(record.sent_at)}</span>
                      </div>
                    </td>

                    {/* Remitente */}
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-500">
                      {record.sender_email}
                    </td>
                  </tr>
                ))
              ) : (
                /* Estado Vacío (Sin registros) */
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                        <FileSpreadsheet className="h-6 w-6 stroke-1.5" />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-sm mb-1">
                        No se encontraron registros
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {startDate || endDate
                          ? "No hay certificados enviados que coincidan con el rango de fechas seleccionado. Prueba con otro rango o limpia los filtros."
                          : "Aún no se han registrado envíos en la base de datos de Supabase. Realiza tu primer despacho en la vista de Emisión."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

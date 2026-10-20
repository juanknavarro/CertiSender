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
  Clock,
  ShieldCheck,
  Search,
  FileDown,
  Users,
  GraduationCap,
} from "lucide-react";
import { exportReportsToPDF, SentCertificateRecord } from "@/utils/reportPdfExporter";
import { useAuth } from "@/context/AuthContext";

export interface IssuerProfileItem {
  id: string;
  full_name: string;
  email: string;
  cedula: string;
  academic_programs?: { name: string } | null;
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
  const { user, profile, role } = useAuth();
  const isSuperadmin = role === "superadmin";

  const [records, setRecords] = useState<SentCertificateRecord[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedIssuerId, setSelectedIssuerId] = useState<string>("all");
  const [issuersList, setIssuersList] = useState<IssuerProfileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Consulta de reportes a la API aplicando aislamiento por RLS y filtros
  const fetchReports = useCallback(
    async (start: string, end: string, issuerId: string = "all") => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const params = new URLSearchParams();
        if (user?.id) params.append("userId", user.id);
        if (start.trim()) params.append("startDate", start.trim());
        if (end.trim()) params.append("endDate", end.trim());
        if (issuerId && issuerId !== "all") {
          params.append("filterIssuerId", issuerId);
        }

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
        if (data.issuers) {
          setIssuersList(data.issuers);
        }
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
    [user]
  );

  // Carga inicial en el montaje una vez que el usuario esté disponible
  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      try {
        const params = new URLSearchParams();
        if (user?.id) params.append("userId", user.id);

        const res = await fetch(`/api/reports?${params.toString()}`);
        const data = await res.json();
        if (!ignore) {
          if (data.warning) setWarningMessage(data.warning);
          setRecords(data.data || []);
          if (data.issuers) {
            setIssuersList(data.issuers);
          }
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

    if (user?.id) {
      loadInitial();
    }

    return () => {
      ignore = true;
    };
  }, [user]);

  // Manejador para aplicar filtros
  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReports(startDate, endDate, selectedIssuerId);
  };

  // Manejador para limpiar filtros
  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setSelectedIssuerId("all");
    fetchReports("", "", "all");
  };

  // Determinar texto de alcance para el PDF
  const getIssuerScopeText = (): string => {
    if (isSuperadmin) {
      if (selectedIssuerId === "all") {
        return "Facultad de Ciencias e Ingeniería (Consolidado Global)";
      }
      const matched = issuersList.find((i) => i.id === selectedIssuerId);
      return matched
        ? `${matched.full_name} (${matched.academic_programs?.name || "Docente"}) - C.C. ${matched.cedula}`
        : "Emisor Seleccionado";
    }
    return `${profile?.full_name || user?.email || "Docente"} (${profile?.academic_programs?.name || "Facultad"}) - C.C. ${profile?.cedula || "N/A"}`;
  };

  // Exportar registros visibles a PDF vectorial
  const handleExportPDF = () => {
    if (records.length === 0) {
      alert("No hay registros disponibles para exportar en este momento.");
      return;
    }
    try {
      exportReportsToPDF(records, startDate, endDate, getIssuerScopeText());
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
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isSuperadmin
                ? "Historial de Emisiones — Auditoría Global"
                : "Mis Emisiones de Certificados"}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isSuperadmin
                  ? "bg-amber-50 text-amber-800 border-amber-300"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200"
              }`}
            >
              {isSuperadmin ? "Superadmin Auditor" : "Privacidad RLS Activa"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isSuperadmin
              ? "Supervisión consolidada de todos los certificados expedidos por docentes y programas en la facultad."
              : `Registro de auditoría personal de certificados emitidos por ${profile?.full_name || "tu cuenta"} (${profile?.academic_programs?.name || "Docente"}).`}
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
          <div className="text-xs font-medium flex-1">{errorMessage}</div>
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
        {/* Tarjeta de Filtros de Fecha y Emisor (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Filtros de Búsqueda y Auditoría
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                {isSuperadmin
                  ? "Filtrar por emisor o rango de fechas"
                  : "Filtrar por rango de fechas"}
              </span>
            </div>

            <form
              onSubmit={handleFilter}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {/* Selector de Emisor (Exclusivo para Superadmin) */}
              {isSuperadmin && (
                <div className="sm:col-span-2">
                  <label
                    htmlFor="issuerFilter"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
                  >
                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Emisor / Docente Responsable</span>
                  </label>
                  <select
                    id="issuerFilter"
                    value={selectedIssuerId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedIssuerId(newId);
                      fetchReports(startDate, endDate, newId);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                  >
                    <option value="all">
                      🌐 Toda la Facultad (Consolidado de Todos los Emisores)
                    </option>
                    {issuersList.map((iss) => (
                      <option key={iss.id} value={iss.id}>
                        {iss.full_name} — {iss.academic_programs?.name || "Docente"} (C.C. {iss.cedula})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
        <div className="lg:col-span-4 bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
                {isSuperadmin ? "Auditoría de Facultad" : "Mis Métricas"}
              </span>
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
            </div>

            <p className="text-xs text-indigo-200">
              {isSuperadmin
                ? selectedIssuerId === "all"
                  ? "Total emitidos en la Facultad"
                  : "Total del emisor filtrado"
                : "Total de tus certificados enviados"}
            </p>
            <div className="text-4xl font-extrabold tracking-tight mt-1">
              {isLoading ? (
                <span className="inline-block h-8 w-16 bg-white/20 animate-pulse rounded" />
              ) : (
                records.length
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-indigo-200">
            <span className="truncate pr-2">
              {startDate || endDate
                ? "Filtro de fecha activo"
                : isSuperadmin && selectedIssuerId !== "all"
                ? "Filtrado por emisor"
                : "Histórico completo"}
            </span>
            <div className="flex items-center gap-1 text-emerald-400 font-semibold shrink-0">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{isSuperadmin ? "Global RLS" : "Privado RLS"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN INFERIOR: TABLA DE RESULTADOS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-600" />
            <h3 className="font-semibold text-sm text-slate-900">
              {isSuperadmin
                ? "Registros Consolidados de Certificados"
                : "Tus Registros de Certificados Enviados"}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-500 font-medium">
                        Consultando registros de auditoría...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                /* Estado Vacío */
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <GraduationCap className="h-10 w-10 stroke-[1.5]" />
                      <p className="text-sm font-semibold text-slate-600">
                        No se encontraron registros de certificados
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {isSuperadmin
                          ? "No hay certificados registrados para el emisor o rango de fechas seleccionado."
                          : "Aún no has emitido certificados con tu cuenta o no coinciden con las fechas filtradas."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                /* Filas de la Tabla */
                records.map((item, index) => (
                  <tr
                    key={item.id || index}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-3.5 py-4 text-center text-xs font-mono font-semibold text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {item.recipient_name || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-600">
                      {item.doc_type && item.doc_number
                        ? `${item.doc_type}. ${item.doc_number}`
                        : item.doc_number || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                      {item.recipient_email}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {formatDateTime(item.sent_at)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-mono truncate max-w-[200px]">
                      {item.sender_email || "N/A"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

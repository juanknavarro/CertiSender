"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Check,
  Power,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export interface AcademicProgramRecord {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
}

// Formateo de fecha
function formatDate(dateString?: string): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
}

export default function ProgramasClient() {
  const { role, isLoading: authLoading } = useAuth();
  const isSuperadmin = role === "superadmin";

  const [programs, setPrograms] = useState<AcademicProgramRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados del Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<AcademicProgramRecord | null>(null);
  const [programName, setProgramName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Consulta de programas académicos a Supabase
  const fetchPrograms = useCallback(async () => {
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from("academic_programs")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      setPrograms((data as AcademicProgramRecord[]) || []);
    } catch (err: unknown) {
      console.error("Error al cargar programas académicos:", err);
      const msg =
        err instanceof Error ? err.message : "Error al obtener programas.";
      setErrorMessage(msg);
      setPrograms([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      try {
        const { data, error } = await supabase
          .from("academic_programs")
          .select("*")
          .order("name", { ascending: true });

        if (!ignore) {
          if (error) throw new Error(error.message);
          setPrograms((data as AcademicProgramRecord[]) || []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg =
            err instanceof Error ? err.message : "Error al obtener programas.";
          setErrorMessage(msg);
          setPrograms([]);
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Abrir modal de creación
  const handleOpenCreateModal = () => {
    setEditingProgram(null);
    setProgramName("");
    setIsActive(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEditModal = (prog: AcademicProgramRecord) => {
    setEditingProgram(prog);
    setProgramName(prog.name);
    setIsActive(prog.is_active);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Guardar (Crear o Actualizar) directamente en Supabase con RLS de Superadmin
  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanName = programName.trim();
    if (!cleanName) {
      setModalError("El nombre del programa académico es obligatorio.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProgram) {
        // Actualizar programa existente
        const { error } = await supabase
          .from("academic_programs")
          .update({
            name: cleanName,
            is_active: isActive,
          })
          .eq("id", editingProgram.id);

        if (error) throw new Error(error.message);

        showToast(`Programa "${cleanName}" actualizado con éxito.`);
      } else {
        // Crear nuevo programa
        const { error } = await supabase
          .from("academic_programs")
          .insert([
            {
              name: cleanName,
              is_active: isActive,
            },
          ]);

        if (error) throw new Error(error.message);

        showToast(`Programa "${cleanName}" creado con éxito.`);
      }

      setIsModalOpen(false);
      fetchPrograms();
    } catch (err: unknown) {
      console.error("Error al guardar programa:", err);
      const msg =
        err instanceof Error ? err.message : "Error al procesar la solicitud.";
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alternar estado activo / inactivo rápidamente
  const handleToggleActive = async (prog: AcademicProgramRecord) => {
    try {
      const nextState = !prog.is_active;
      const { error } = await supabase
        .from("academic_programs")
        .update({ is_active: nextState })
        .eq("id", prog.id);

      if (error) throw new Error(error.message);

      showToast(
        nextState
          ? `Programa "${prog.name}" activado.`
          : `Programa "${prog.name}" desactivado.`
      );
      fetchPrograms();
    } catch (err: unknown) {
      console.error("Error al alternar estado:", err);
      alert(
        err instanceof Error ? err.message : "Error al cambiar estado del programa."
      );
    }
  };

  // Filtrado reactivo por nombre
  const filteredPrograms = useMemo(() => {
    const clean = searchTerm.toLowerCase().trim();
    if (!clean) return programs;
    return programs.filter((p) => p.name.toLowerCase().includes(clean));
  }, [programs, searchTerm]);

  // Si está verificando sesión
  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Protección de ruta: Solo Superadmin
  if (!isSuperadmin) {
    return (
      <div className="flex-1 max-w-xl mx-auto px-4 py-16 text-center font-sans">
        <div className="bg-white rounded-3xl p-8 border border-rose-200/80 shadow-lg space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Acceso Restringido — Nivel Superadmin
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Este módulo es de gestión exclusiva para la administración de la
            facultad. Tu cuenta actual no posee privilegios para administrar
            programas académicos.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Regresar al Panel Principal</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans pb-16">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-700">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Principal */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold mb-3">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
            <span>Gestión Académica de Facultad</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <GraduationCap className="h-7 w-7 text-indigo-600" />
            Programas Académicos
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Administra los programas de pregrado, posgrado y extensiones
            disponibles en la facultad para asociar a los docentes emisores de
            certificados.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchPrograms}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            title="Refrescar lista"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Programa</span>
          </button>
        </div>
      </div>

      {/* Alerta de Error */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3 text-xs shadow-2xs">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Buscador y Resumen */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre del programa académico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium shadow-2xs"
          />
        </div>

        <span className="text-xs text-slate-500 font-semibold">
          {filteredPrograms.length} programa(s) registrado(s)
        </span>
      </div>

      {/* Data Table de Programas */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th scope="col" className="w-14 px-4 py-3.5 text-center">
                  #
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Nombre del Programa
                </th>
                <th scope="col" className="px-6 py-3.5 text-center">
                  Estado
                </th>
                <th scope="col" className="px-6 py-3.5 text-center">
                  Fecha de Creación
                </th>
                <th scope="col" className="px-6 py-3.5 text-center">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-500 font-medium">
                        Consultando programas académicos...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredPrograms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <GraduationCap className="h-10 w-10 stroke-[1.5]" />
                      <p className="text-sm font-semibold text-slate-600">
                        No se encontraron programas académicos
                      </p>
                      <p className="text-xs text-slate-400">
                        {searchTerm
                          ? "No hay coincidencias con el término buscado."
                          : "Haz clic en 'Nuevo Programa' para registrar el primero."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPrograms.map((item, index) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-4 text-center text-xs font-mono font-semibold text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {item.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-xs text-slate-500 font-mono">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Editar programa"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            item.is_active
                              ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                              : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={
                            item.is_active
                              ? "Desactivar programa"
                              : "Activar programa"
                          }
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CREAR / EDITAR PROGRAMA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingProgram
                      ? "Editar Programa Académico"
                      : "Nuevo Programa Académico"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingProgram
                      ? "Actualiza el nombre y disponibilidad del programa"
                      : "Registra un nuevo programa para la facultad"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error del Modal */}
            {modalError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1 font-medium">{modalError}</span>
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSaveProgram} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Nombre del Programa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ingeniería de Sistemas"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                />
              </div>

              <div className="pt-1 flex items-center gap-2.5">
                <input
                  id="is_active_check"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                />
                <label
                  htmlFor="is_active_check"
                  className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
                >
                  Programa activo (disponible para asignación a docentes)
                </label>
              </div>

              {/* Botones del Modal */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    "Guardando..."
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>
                        {editingProgram
                          ? "Actualizar Programa"
                          : "Guardar Programa"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

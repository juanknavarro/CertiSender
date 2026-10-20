"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export interface AcademicProgramItem {
  id: string;
  name: string;
  is_active?: boolean;
}

export interface UserProfileItem {
  id: string;
  cedula: string;
  full_name: string;
  email: string;
  program_id: string;
  phone?: string | null;
  role: "superadmin" | "issuer";
  academic_programs?: { name: string } | null;
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

export default function UsuariosClient() {
  const { user, role, isLoading: authLoading } = useAuth();
  const isSuperadmin = role === "superadmin";

  const [users, setUsers] = useState<UserProfileItem[]>([]);
  const [programs, setPrograms] = useState<AcademicProgramItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados del Modal de Creación / Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfileItem | null>(null);
  const [cedula, setCedula] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [programId, setProgramId] = useState("");
  const [userRole, setUserRole] = useState<"issuer" | "superadmin">("issuer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Consulta de usuarios y programas a la API de administración
  const fetchUsersAndPrograms = useCallback(async () => {
    if (!user?.id) return;
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/users?requesterUserId=${user.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      setUsers(data.users || []);
      setPrograms(data.programs || []);
      if (data.programs && data.programs.length > 0 && !programId) {
        setProgramId(data.programs[0].id);
      }
    } catch (err: unknown) {
      console.error("Error al cargar usuarios:", err);
      const msg =
        err instanceof Error ? err.message : "Error al obtener usuarios.";
      setErrorMessage(msg);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, programId]);

  // Carga inicial
  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/admin/users?requesterUserId=${user.id}`);
        const data = await res.json();
        if (!ignore) {
          if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
          setUsers(data.users || []);
          setPrograms(data.programs || []);
          if (data.programs && data.programs.length > 0) {
            setProgramId(data.programs[0].id);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg =
            err instanceof Error ? err.message : "Error al obtener usuarios.";
          setErrorMessage(msg);
          setUsers([]);
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Generador de contraseña temporal segura de 10 caracteres
  const handleGeneratePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
    let generated = "";
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setShowPassword(true);
  };

  // Abrir modal de creación limpio
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setCedula("");
    setFullName("");
    setEmail("");
    setPassword("UniSinu2026*");
    setShowPassword(true);
    setPhone("");
    setUserRole("issuer");
    setModalError(null);
    if (programs.length > 0) {
      setProgramId(programs[0].id);
    }
    setIsModalOpen(true);
  };

  // Abrir modal de edición pre-cargado
  const handleOpenEditModal = (item: UserProfileItem) => {
    setEditingUser(item);
    setCedula(item.cedula);
    setFullName(item.full_name);
    setEmail(item.email);
    setPassword("");
    setShowPassword(false);
    setPhone(item.phone || "");
    setProgramId(item.program_id);
    setUserRole(item.role);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Crear o Actualizar Usuario
  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const isEditing = Boolean(editingUser);

    if (!fullName.trim() || !programId) {
      setModalError("Por favor completa los campos obligatorios (*).");
      return;
    }

    if (!isEditing && (!cedula.trim() || !email.trim() || !password.trim())) {
      setModalError("Cédula, correo y contraseña son obligatorios para crear un nuevo usuario.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && editingUser) {
        // Enviar actualización PATCH a la API segura
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingUser.id,
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            program_id: programId,
            role: userRole,
            requesterUserId: user?.id,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Error ${res.status}`);
        }

        showToast(`Usuario ${fullName.trim()} actualizado con éxito.`);
      } else {
        // Enviar creación POST a la API segura
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cedula: cedula.trim(),
            full_name: fullName.trim(),
            email: email.trim(),
            password: password.trim(),
            phone: phone.trim() || null,
            program_id: programId,
            role: userRole,
            requesterUserId: user?.id,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Error ${res.status}`);
        }

        showToast(`Usuario ${fullName.trim()} creado con éxito.`);
      }

      setIsModalOpen(false);
      fetchUsersAndPrograms();
    } catch (err: unknown) {
      console.error("Error al procesar usuario:", err);
      const msg =
        err instanceof Error ? err.message : "Error al procesar la solicitud.";
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar Usuario
  const handleDeleteUser = async (id: string, name: string) => {
    if (id === user?.id) {
      alert("No puedes eliminar tu propia cuenta de Superadmin.");
      return;
    }

    if (
      !confirm(
        `¿Estás seguro de eliminar al usuario ${name}? Esta acción revocará de inmediato sus credenciales de acceso.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/admin/users?id=${id}&requesterUserId=${user?.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      showToast("Usuario eliminado correctamente.");
      fetchUsersAndPrograms();
    } catch (err: unknown) {
      console.error("Error al eliminar usuario:", err);
      alert(
        err instanceof Error ? err.message : "Error al eliminar el usuario."
      );
    }
  };

  // Filtrado reactivo de usuarios en la tabla
  const filteredUsers = useMemo(() => {
    const cleanSearch = searchTerm.toLowerCase().trim();
    if (!cleanSearch) return users;

    return users.filter((u) => {
      const matchName = u.full_name?.toLowerCase().includes(cleanSearch);
      const matchEmail = u.email?.toLowerCase().includes(cleanSearch);
      const matchCedula = u.cedula?.toLowerCase().includes(cleanSearch);
      const matchProg = u.academic_programs?.name
        ?.toLowerCase()
        .includes(cleanSearch);
      return matchName || matchEmail || matchCedula || matchProg;
    });
  }, [users, searchTerm]);

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
            cuentas de usuario.
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
            <span>Módulo de Control de Acceso Cerrado</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="h-7 w-7 text-indigo-600" />
            Gestión de Emisores y Usuarios
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Administra los accesos institucionales para docentes y personal de la
            facultad. Las cuentas creadas aquí tienen confirmación inmediata y
            asignación directa a su programa académico.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchUsersAndPrograms}
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
            <UserPlus className="h-4 w-4" />
            <span>Nuevo Usuario</span>
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
            placeholder="Buscar por nombre, cédula, correo o programa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium shadow-2xs"
          />
        </div>

        <span className="text-xs text-slate-500 font-semibold">
          {filteredUsers.length} usuario(s) registrado(s)
        </span>
      </div>

      {/* Data Table de Usuarios */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th scope="col" className="w-12 px-4 py-3.5 text-center">
                  #
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Cédula
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Nombres y Apellidos
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Correo Institucional
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Programa Académico
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Teléfono
                </th>
                <th scope="col" className="px-4 py-3.5 text-center">
                  Rol
                </th>
                <th scope="col" className="px-4 py-3.5 text-center">
                  Fecha Alta
                </th>
                <th scope="col" className="px-4 py-3.5 text-center">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-500 font-medium">
                        Consultando usuarios del sistema...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Users className="h-10 w-10 stroke-[1.5]" />
                      <p className="text-sm font-semibold text-slate-600">
                        No se encontraron usuarios
                      </p>
                      <p className="text-xs text-slate-400">
                        {searchTerm
                          ? "No hay coincidencias con el término buscado."
                          : "Haz clic en 'Nuevo Usuario' para registrar el primer docente."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item, index) => {
                  const isCurrentUser = item.id === user?.id;
                  const isItemSuper = item.role === "superadmin";

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-4 text-center text-xs font-mono font-semibold text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-5 py-4 text-xs font-mono font-bold text-slate-700">
                        {item.cedula}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{item.full_name}</span>
                          {isCurrentUser && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                              Tú
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-600">
                        {item.email}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span>
                            {item.academic_programs?.name || "Sin programa"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-slate-500">
                        {item.phone || "—"}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isItemSuper
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                          }`}
                        >
                          {isItemSuper ? "Superadmin" : "Emisor"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-xs text-slate-500 font-mono">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Editar usuario"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          {!isCurrentUser ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteUser(item.id, item.full_name)
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <span
                              className="p-1.5 text-slate-300 select-none"
                              title="Cuenta activa actual protegida"
                            >
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CREACIÓN / EDICIÓN DE USUARIO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Header del Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  {editingUser ? (
                    <Edit2 className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingUser ? "Editar Usuario" : "Registrar Nuevo Usuario"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingUser
                      ? "Modifica los datos del perfil y rol asignado"
                      : "Creación directa en auth.users con asignación de perfil"}
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

            {/* Error del Formulario */}
            {modalError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1 font-medium">{modalError}</span>
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSubmitUser} className="p-6 space-y-4 overflow-y-auto">
              {/* Cédula y Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Cédula de Ciudadanía {editingUser ? "(Fija)" : "*"}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUser)}
                    placeholder="Ej. 1098765432"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Teléfono (Opcional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="tel"
                      placeholder="Ej. 3001234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Nombres y Apellidos */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Nombres y Apellidos *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ing. Carlos Alberto Mendoza"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                />
              </div>

              {/* Correo Institucional */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Correo Electrónico Institucional {editingUser ? "(Fijo)" : "*"}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingUser)}
                    placeholder="docente@unisinu.edu.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Contraseña (Solo en Modo Creación) */}
              {!editingUser ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Contraseña Provisional (UniSinu2026*) *
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="h-3 w-3" />
                      <span>Generar aleatoria</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    El usuario deberá cambiarla obligatoriamente en su primer ingreso a la plataforma.
                  </p>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="UniSinu2026*"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-[11px] text-slate-500 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>
                    Las credenciales de acceso (cédula y contraseña) no se
                    modifican en esta vista por motivos de seguridad institucional.
                  </span>
                </div>
              )}

              {/* Programa Académico y Rol */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Programa Académico *
                  </label>
                  <select
                    required
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                  >
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Rol en la Plataforma
                  </label>
                  <select
                    value={userRole}
                    onChange={(e) =>
                      setUserRole(e.target.value as "issuer" | "superadmin")
                    }
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                  >
                    <option value="issuer">Emisor (Docente)</option>
                    <option value="superadmin">Superadmin (Auditor)</option>
                  </select>
                </div>
              </div>

              {!editingUser && (
                <div className="bg-indigo-50/60 rounded-xl p-3 border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    El usuario podrá ingresar de inmediato con su correo y la
                    contraseña asignada. No se enviará correo de confirmación
                    externo.
                  </span>
                </div>
              )}

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
                  {isSubmitting
                    ? "Guardando..."
                    : editingUser
                    ? "Actualizar Usuario"
                    : "Registrar Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

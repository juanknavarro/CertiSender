"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  Lock,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  ArrowRight,
  LogOut,
  Sparkles,
} from "lucide-react";

export default function UpdatePasswordClient() {
  const router = useRouter();
  const { user, profile, session, refreshProfile, logout } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reglas de validación en tiempo real
  const validationRules = useMemo(() => {
    const hasMinLength = newPassword.length >= 8;
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecialChar = /[@$!%*?&#^()_\-+=~`]/.test(newPassword);
    const isNotProvisional =
      newPassword.trim().length > 0 && newPassword.trim() !== "UniSinu2026*";
    const passwordsMatch =
      newPassword.length > 0 &&
      confirmPassword.length > 0 &&
      newPassword === confirmPassword;

    const allValid =
      hasMinLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumber &&
      hasSpecialChar &&
      isNotProvisional &&
      passwordsMatch;

    return {
      hasMinLength,
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar,
      isNotProvisional,
      passwordsMatch,
      allValid,
    };
  }, [newPassword, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!validationRules.allValid) {
      setErrorMessage(
        "Por favor asegúrate de cumplir con todas las directivas de seguridad requeridas."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      let token = session?.access_token;
      if (!token) {
        const { data: sessionData } = await supabase.auth.getSession();
        token = sessionData?.session?.access_token;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // 1. Invocar el endpoint de servidor seguro
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers,
        body: JSON.stringify({
          newPassword,
          confirmPassword,
          userId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      // 2. Sincronizar la sesión en el cliente de Supabase
      try {
        await supabase.auth.updateUser({ password: newPassword });
      } catch (err) {
        console.warn("Actualización client-side de Supabase omitida:", err);
      }

      // 3. Refrescar el perfil para que must_change_password pase a false en el AuthContext
      await refreshProfile();

      setSuccessMessage(
        "¡Contraseña actualizada con éxito! Redirigiendo a tu espacio de trabajo..."
      );

      setTimeout(() => {
        router.replace("/");
      }, 1500);
    } catch (err: unknown) {
      console.error("Error al actualizar la contraseña:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la contraseña.";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-br from-slate-100 via-indigo-50/40 to-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Fondo con detalles sutiles de diseño */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Tarjeta Principal */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/80 shadow-xl space-y-6">
          {/* Encabezado */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 mb-1">
              <KeyRound className="h-7 w-7 stroke-[2.2]" />
            </div>

            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Actualización Obligatoria
              </h1>
            </div>

            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
              Hola,{" "}
              <strong className="text-slate-800">
                {profile?.full_name || user?.email || "docente"}
              </strong>
              . Por políticas de seguridad institucional, debes cambiar tu clave
              provisional antes de continuar al sistema.
            </p>
          </div>

          {/* Banner Informativo */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-start gap-2.5 text-xs">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Estás ingresando con una clave provisional asignada por el
              administrador. Define tu nueva contraseña personal e intransferible.
            </div>
          </div>

          {/* Mensajes de Alerta */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 flex items-start gap-2.5 text-xs animate-in fade-in duration-150">
              <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-start gap-2.5 text-xs animate-in fade-in duration-150">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold">{successMessage}</div>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Nueva Contraseña */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Nueva Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ingresa tu nueva clave personal"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all bg-slate-50/50 focus:bg-white placeholder:text-slate-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Campo Confirmar Contraseña */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Confirmar Nueva Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all bg-slate-50/50 focus:bg-white placeholder:text-slate-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Lista de Comprobación de Requisitos en Vivo */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>Requisitos de Seguridad de la Contraseña</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div
                  className={`flex items-center gap-1.5 ${
                    validationRules.hasMinLength
                      ? "text-emerald-700 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {validationRules.hasMinLength ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-300 inline-block shrink-0" />
                  )}
                  <span>Mínimo 8 caracteres</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 ${
                    validationRules.hasUpperCase
                      ? "text-emerald-700 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {validationRules.hasUpperCase ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-300 inline-block shrink-0" />
                  )}
                  <span>Al menos 1 mayúscula (A-Z)</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 ${
                    validationRules.hasLowerCase
                      ? "text-emerald-700 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {validationRules.hasLowerCase ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-300 inline-block shrink-0" />
                  )}
                  <span>Al menos 1 minúscula (a-z)</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 ${
                    validationRules.hasNumber
                      ? "text-emerald-700 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {validationRules.hasNumber ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-300 inline-block shrink-0" />
                  )}
                  <span>Al menos 1 número (0-9)</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 ${
                    validationRules.hasSpecialChar
                      ? "text-emerald-700 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {validationRules.hasSpecialChar ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-300 inline-block shrink-0" />
                  )}
                  <span>Símbolo especial (@, $, !, %, *, etc.)</span>
                </div>

                <div
                  className={`flex items-center gap-1.5 ${
                    validationRules.isNotProvisional
                      ? "text-emerald-700 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {validationRules.isNotProvisional ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-300 inline-block shrink-0" />
                  )}
                  <span>Diferente a la provisional</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <div
                  className={`flex items-center gap-1.5 text-[11px] ${
                    validationRules.passwordsMatch
                      ? "text-emerald-700 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {validationRules.passwordsMatch ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-300 inline-block shrink-0" />
                  )}
                  <span>Las contraseñas coinciden exactamente</span>
                </div>
              </div>
            </div>

            {/* Botón de Envío */}
            <button
              type="submit"
              disabled={isSubmitting || !validationRules.allValid}
              className="w-full mt-3 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Actualizando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Guardar Contraseña y Continuar</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Opción de Cerrar Sesión */}
          <div className="pt-2 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cerrar sesión e ingresar con otra cuenta</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-slate-400 text-center mt-6">
          CertiSender © 2026 • Plataforma Institucional Segura
        </p>
      </div>
    </div>
  );
}

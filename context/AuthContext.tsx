"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export interface AcademicProgram {
  id: string;
  name: string;
  is_active?: boolean;
}

export interface UserProfile {
  id: string;
  cedula: string;
  full_name: string;
  email: string;
  program_id: string;
  phone?: string | null;
  role: "superadmin" | "issuer";
  must_change_password?: boolean;
  academic_programs?: AcademicProgram | null;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  role: "superadmin" | "issuer" | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Obtener perfil detallado del usuario desde public.profiles
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, academic_programs(id, name, is_active)")
        .eq("id", userId)
        .single();

      if (error) {
        console.warn("No se pudo cargar el perfil del usuario:", error.message);
        setProfile(null);
        return;
      }

      setProfile(data as UserProfile);
    } catch (err) {
      console.error("Error al consultar perfil en Supabase:", err);
      setProfile(null);
    }
  }, []);

  // Inicialización y escucha de eventos de autenticación
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        const currentSession = data?.session ?? null;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Error al verificar sesión de Supabase:", err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    // Suscripción a cambios de sesión (login, logout, refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Iniciar sesión con email y contraseña
  const login = async (
    email: string,
    password: string
  ): Promise<{ error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        await fetchProfile(data.user.id);
      }

      return {};
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error inesperado al iniciar sesión.";
      return { error: msg };
    }
  };

  // Cerrar sesión
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        role: profile?.role ?? null,
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de un <AuthProvider>");
  }
  return context;
}

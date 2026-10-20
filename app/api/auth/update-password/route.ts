import { NextRequest, NextResponse } from "next/server";
import { createClient, User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

// Extraer usuario autenticado de header Authorization o cookies
async function getAuthenticatedUser(
  req: NextRequest,
  fallbackUserId?: string | null
): Promise<User | null> {
  if (!supabaseAdmin) return null;

  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  let token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : null;

  if (!token) {
    const allCookies = req.cookies.getAll();
    for (const cookie of allCookies) {
      if (
        cookie.name.includes("auth-token") ||
        cookie.name.includes("access-token")
      ) {
        try {
          const parsed = JSON.parse(decodeURIComponent(cookie.value));
          token = Array.isArray(parsed)
            ? parsed[0]
            : parsed.access_token || parsed;
          if (token) break;
        } catch {
          token = cookie.value;
          if (token) break;
        }
      }
    }
  }

  if (token) {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (!error && user) {
      return user;
    }
  }

  if (fallbackUserId) {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.admin.getUserById(fallbackUserId);
    if (!error && user) {
      return user;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "El servidor no tiene configurada SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { newPassword, confirmPassword, userId } = body;

    const user = await getAuthenticatedUser(req, userId);
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Sesión no válida o expirada." },
        { status: 401 }
      );
    }

    // 1. Validaciones de contraseñas recibidas
    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Las contraseñas no coinciden." },
        { status: 400 }
      );
    }

    // 2. Reglas de complejidad estricta
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(newPassword)) {
      return NextResponse.json(
        { error: "La contraseña debe contener al menos una letra mayúscula." },
        { status: 400 }
      );
    }

    if (!/[a-z]/.test(newPassword)) {
      return NextResponse.json(
        { error: "La contraseña debe contener al menos una letra minúscula." },
        { status: 400 }
      );
    }

    if (!/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: "La contraseña debe contener al menos un número." },
        { status: 400 }
      );
    }

    if (!/[@$!%*?&#^()_\-+=~`]/.test(newPassword)) {
      return NextResponse.json(
        {
          error:
            "La contraseña debe contener al menos un caracter especial (@, $, !, %, *, ?, &, #, etc.).",
        },
        { status: 400 }
      );
    }

    // 3. Regla de no reutilización de la contraseña provisional
    if (newPassword.trim() === "UniSinu2026*") {
      return NextResponse.json(
        {
          error:
            "Por seguridad, la nueva contraseña no puede ser igual a la contraseña provisional asignada por el sistema.",
        },
        { status: 400 }
      );
    }

    // 4. Actualizar credencial en auth.users
    const { error: updateAuthError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

    if (updateAuthError) {
      console.error(
        "Error al actualizar contraseña en auth.users:",
        updateAuthError
      );
      return NextResponse.json(
        { error: updateAuthError.message || "Error al actualizar la contraseña." },
        { status: 400 }
      );
    }

    // 5. Marcar must_change_password = false en public.profiles
    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateProfileError) {
      console.error(
        "Error al actualizar must_change_password en profiles:",
        updateProfileError
      );
      return NextResponse.json(
        {
          error:
            "Contraseña actualizada en autenticación, pero ocurrió un error al actualizar el estado de tu perfil.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada exitosamente.",
    });
  } catch (err: unknown) {
    console.error("Excepción al actualizar contraseña:", err);
    const msg =
      err instanceof Error
        ? err.message
        : "Error interno al actualizar contraseña.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

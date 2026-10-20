import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Cliente con privilegios administrativos (service_role)
const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

// Valida si un userId tiene rol de Superadmin
async function checkIsSuperadmin(userId?: string | null): Promise<boolean> {
  if (!supabaseAdmin || !userId) return false;
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    return profile?.role === "superadmin";
  } catch (err) {
    console.error("Error al verificar rol de superadmin:", err);
    return false;
  }
}

// GET: Obtener lista de usuarios (con nombres de programas) y catálogo de programas
export async function GET(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            "El servidor no tiene configurada la variable SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const { searchParams } = req.nextUrl;
    const requesterUserId = searchParams.get("requesterUserId");

    const isSuperadmin = await checkIsSuperadmin(requesterUserId);
    if (!isSuperadmin) {
      return NextResponse.json(
        {
          error:
            "Acceso denegado. Se requieren permisos de Superadmin para gestionar usuarios.",
        },
        { status: 403 }
      );
    }

    // 1. Consultar usuarios con su respectivo programa académico
    const { data: users, error: usersError } = await supabaseAdmin
      .from("profiles")
      .select("*, academic_programs(id, name, is_active)")
      .order("created_at", { ascending: false });

    if (usersError) {
      console.error("Error al consultar usuarios:", usersError);
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    // 2. Consultar programas académicos activos para el selector
    const { data: programs, error: progError } = await supabaseAdmin
      .from("academic_programs")
      .select("id, name, is_active")
      .order("name", { ascending: true });

    if (progError) {
      console.error("Error al consultar programas académicos:", progError);
    }

    return NextResponse.json({
      users: users || [],
      programs: programs || [],
    });
  } catch (err: unknown) {
    if ((err as { digest?: string })?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw err;
    }

    const msg =
      err instanceof Error ? err.message : "Error inesperado al listar usuarios.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: Crear usuario en auth.users (sin confirmación por correo) y registrar en public.profiles
export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            "El servidor no tiene configurada la variable SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      cedula,
      full_name,
      email,
      password,
      phone,
      program_id,
      role,
      requesterUserId,
    } = body;

    // 1. Validar autorización del Superadmin solicitante
    const isSuperadmin = await checkIsSuperadmin(requesterUserId);
    if (!isSuperadmin) {
      return NextResponse.json(
        {
          error:
            "Acceso denegado. Se requieren permisos de Superadmin para crear cuentas.",
        },
        { status: 403 }
      );
    }

    // 2. Validaciones de campos obligatorios
    if (
      !cedula?.trim() ||
      !full_name?.trim() ||
      !email?.trim() ||
      !program_id
    ) {
      return NextResponse.json(
        {
          error:
            "Faltan campos obligatorios: Cédula, Nombres y Apellidos, Correo y Programa Académico.",
        },
        { status: 400 }
      );
    }

    const assignedPassword = password?.trim() || "UniSinu2026*";
    const cleanEmail = email.trim().toLowerCase();
    const cleanCedula = cedula.trim();

    // 3. Verificar si la cédula ya existe en profiles
    const { data: existingCedula } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("cedula", cleanCedula)
      .maybeSingle();

    if (existingCedula) {
      return NextResponse.json(
        { error: `Ya existe un usuario registrado con la cédula ${cleanCedula}.` },
        { status: 400 }
      );
    }

    // 4. Crear la cuenta en auth.users con auto-confirmación
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: assignedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          cedula: cleanCedula,
        },
      });

    if (authError || !authData.user) {
      console.error("Error al crear usuario en auth.users:", authError);
      return NextResponse.json(
        { error: authError?.message || "No se pudo crear el usuario en el sistema de autenticación." },
        { status: 400 }
      );
    }

    const newUserId = authData.user.id;

    // 5. Insertar datos complementarios en public.profiles
    const { data: newProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          id: newUserId,
          cedula: cleanCedula,
          full_name: full_name.trim(),
          email: cleanEmail,
          program_id,
          phone: phone?.trim() || null,
          role: role === "superadmin" ? "superadmin" : "issuer",
          must_change_password: true,
        },
      ])
      .select("*, academic_programs(id, name)")
      .single();

    // 6. Rollback en caso de fallo en la inserción del perfil
    if (profileError) {
      console.error(
        "Error al insertar en public.profiles. Realizando rollback en auth.users:",
        profileError
      );
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: `Error al crear el perfil: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Usuario creado exitosamente.",
        user: newProfile,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("Excepción al crear usuario:", err);
    const msg =
      err instanceof Error ? err.message : "Error inesperado al crear usuario.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: Eliminar cuenta de usuario (Solo Superadmin)
export async function DELETE(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no está configurada." },
        { status: 500 }
      );
    }

    const { searchParams } = req.nextUrl;
    const targetUserId = searchParams.get("id");
    const requesterUserId = searchParams.get("requesterUserId");

    const isSuperadmin = await checkIsSuperadmin(requesterUserId);
    if (!isSuperadmin) {
      return NextResponse.json(
        {
          error:
            "Acceso denegado. Se requieren permisos de Superadmin para eliminar usuarios.",
        },
        { status: 403 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "El ID del usuario es obligatorio." },
        { status: 400 }
      );
    }

    if (targetUserId === requesterUserId) {
      return NextResponse.json(
        { error: "Operación no permitida: no puedes eliminar tu propia cuenta de Superadmin." },
        { status: 400 }
      );
    }

    // Eliminar de auth.users (cascada automática a public.profiles)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (error) {
      console.error("Error al eliminar usuario en auth.users:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Usuario eliminado exitosamente del sistema.",
      id: targetUserId,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error al eliminar usuario.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH: Actualizar datos del usuario (Nombres, Teléfono, Programa Académico y Rol)
export async function PATCH(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            "El servidor no tiene configurada la variable SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      id,
      full_name,
      phone,
      program_id,
      role,
      requesterUserId,
    } = body;

    const isSuperadmin = await checkIsSuperadmin(requesterUserId);
    if (!isSuperadmin) {
      return NextResponse.json(
        {
          error:
            "Acceso denegado. Se requieren permisos de Superadmin para actualizar usuarios.",
        },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "El ID del usuario es obligatorio." },
        { status: 400 }
      );
    }

    // Construir objeto de actualización para public.profiles
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (full_name !== undefined) {
      if (!full_name.trim()) {
        return NextResponse.json(
          { error: "Los nombres y apellidos no pueden estar vacíos." },
          { status: 400 }
        );
      }
      updatePayload.full_name = full_name.trim();
    }

    if (phone !== undefined) {
      updatePayload.phone = phone?.trim() || null;
    }

    if (program_id !== undefined) {
      if (!program_id) {
        return NextResponse.json(
          { error: "El programa académico es obligatorio." },
          { status: 400 }
        );
      }
      updatePayload.program_id = program_id;
    }

    if (role !== undefined) {
      // Evitar que el superadmin se degrade a sí mismo
      if (id === requesterUserId && role !== "superadmin") {
        return NextResponse.json(
          { error: "Operación no permitida: no puedes remover tu propio rol de Superadmin." },
          { status: 400 }
        );
      }
      updatePayload.role = role === "superadmin" ? "superadmin" : "issuer";
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", id)
      .select("*, academic_programs(id, name)")
      .single();

    if (updateError) {
      console.error("Error al actualizar perfil en public.profiles:", updateError);
      return NextResponse.json(
        { error: `Error al actualizar perfil: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Sincronizar metadata en auth.users si cambió el nombre
    if (full_name) {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: { full_name: full_name.trim() },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Usuario actualizado exitosamente.",
      user: updatedProfile,
    });
  } catch (err: unknown) {
    console.error("Excepción al actualizar usuario:", err);
    const msg =
      err instanceof Error ? err.message : "Error inesperado al actualizar usuario.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

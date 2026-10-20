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

// Obtener usuario autenticado desde Header Authorization o fallbackUserId
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

  if (token) {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (!error && user) return user;
  }

  if (fallbackUserId) {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.admin.getUserById(fallbackUserId);
    if (!error && user) return user;
  }

  return null;
}

// Verifica si la solicitud proviene de un Superadmin
async function verifySuperadmin(
  req: NextRequest,
  fallbackUserId?: string | null
): Promise<{ isSuperadmin: boolean; user: User | null }> {
  if (!supabaseAdmin) return { isSuperadmin: false, user: null };

  const user = await getAuthenticatedUser(req, fallbackUserId);
  if (!user) return { isSuperadmin: false, user: null };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    isSuperadmin: profile?.role === "superadmin",
    user,
  };
}

// GET: Obtener todas las categorías
export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no está configurada." },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("tutorial_categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories: data || [] });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error al obtener categorías.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: Crear nueva categoría (Solo Superadmin)
export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no configurada." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { name, userId } = body;

    const { isSuperadmin } = await verifySuperadmin(req, userId);
    if (!isSuperadmin) {
      return NextResponse.json(
        { error: "Acceso denegado. Se requieren permisos de Superadmin." },
        { status: 403 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "El nombre de la categoría es obligatorio." },
        { status: 400 }
      );
    }

    const cleanName = name.trim();

    // Validar duplicados
    const { data: existing } = await supabaseAdmin
      .from("tutorial_categories")
      .select("id")
      .ilike("name", cleanName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Ya existe una categoría con el nombre '${cleanName}'.` },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("tutorial_categories")
      .insert([{ name: cleanName }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data }, { status: 201 });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error al registrar categoría.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT: Actualizar categoría (Solo Superadmin)
export async function PUT(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no configurada." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { id, name, userId } = body;

    const { isSuperadmin } = await verifySuperadmin(req, userId);
    if (!isSuperadmin) {
      return NextResponse.json(
        { error: "Acceso denegado. Se requieren permisos de Superadmin." },
        { status: 403 }
      );
    }

    if (!id || !name || !name.trim()) {
      return NextResponse.json(
        { error: "El ID y el nuevo nombre son requeridos." },
        { status: 400 }
      );
    }

    const cleanName = name.trim();

    const { data, error } = await supabaseAdmin
      .from("tutorial_categories")
      .update({ name: cleanName })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Actualizar también el campo legacy category en tutorials para sincronía
    await supabaseAdmin
      .from("tutorials")
      .update({ category: cleanName })
      .eq("category_id", id);

    return NextResponse.json({ success: true, category: data });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error al actualizar categoría.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: Eliminar categoría (Solo Superadmin)
export async function DELETE(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no configurada." },
        { status: 500 }
      );
    }

    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");

    const { isSuperadmin } = await verifySuperadmin(req, userId);
    if (!isSuperadmin) {
      return NextResponse.json(
        { error: "Acceso denegado. Se requieren permisos de Superadmin." },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "El ID de la categoría es requerido." },
        { status: 400 }
      );
    }

    // Verificar si hay tutoriales asociados
    const { count, error: countErr } = await supabaseAdmin
      .from("tutorials")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `No es posible eliminar la categoría porque tiene ${count} manual(es) asociado(s). Reasigna los manuales a otra categoría antes de eliminarla.`,
        },
        { status: 400 }
      );
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("tutorial_categories")
      .delete()
      .eq("id", id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error al eliminar categoría.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

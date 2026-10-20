import { NextRequest, NextResponse } from "next/server";
import { createClient, User } from "@supabase/supabase-js";

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

// Obtener usuario autenticado desde Header Authorization, Cookies o fallbackUserId
async function getAuthenticatedUser(
  req: NextRequest,
  fallbackUserId?: string | null
): Promise<User | null> {
  if (!supabaseAdmin) return null;

  // 1. Extraer token del header Authorization
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  let token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : null;

  // 2. Si no hay header, buscar en las cookies de sesión de Supabase
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

  // 3. Validar token con Supabase Auth si existe
  if (token) {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (!error && user) {
      return user;
    }
  }

  // 4. Si se proporcionó fallbackUserId, validar que el usuario exista en auth.users
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

// Verifica si la solicitud proviene de un Superadmin
async function verifySuperadmin(
  req: NextRequest,
  fallbackUserId?: string | null
): Promise<{ isSuperadmin: boolean; user: User | null }> {
  if (!supabaseAdmin) return { isSuperadmin: false, user: null };

  const user = await getAuthenticatedUser(req, fallbackUserId);
  if (!user) return { isSuperadmin: false, user: null };

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    console.warn("No se pudo obtener el perfil para el usuario:", user.id);
    return { isSuperadmin: false, user };
  }

  return {
    isSuperadmin: profile.role === "superadmin",
    user,
  };
}

// GET: Obtener tutoriales (Superadmin ve todos; Emisores solo ven publicados)
export async function GET(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: "SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.",
          data: [],
        },
        { status: 500 }
      );
    }

    const { searchParams } = req.nextUrl;
    const userId = searchParams.get("userId");
    const { isSuperadmin } = await verifySuperadmin(req, userId);

    let query = supabaseAdmin
      .from("tutorials")
      .select("*, tutorial_categories(id, name)")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false });

    // Si no es superadmin, filtrar únicamente los tutoriales publicados
    if (!isSuperadmin) {
      query = query.eq("is_published", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error al consultar tutoriales en Supabase:", error);
      return NextResponse.json(
        { error: error.message, data: [] },
        { status: 500 }
      );
    }

    // Obtener catálogo completo de categorías dinámicas
    const { data: categories } = await supabaseAdmin
      .from("tutorial_categories")
      .select("*")
      .order("name", { ascending: true });

    return NextResponse.json({
      data: data || [],
      categories: categories || [],
      isSuperadmin,
    });
  } catch (err: unknown) {
    if ((err as { digest?: string })?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw err;
    }

    const msg =
      err instanceof Error ? err.message : "Error al obtener tutoriales.";
    return NextResponse.json({ error: msg, data: [] }, { status: 500 });
  }
}

// POST: Crear nuevo tutorial (Solo Superadmin)
export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      video_url,
      category,
      category_id,
      order_index,
      is_published,
      userId,
    } = body;

    const { isSuperadmin, user: authUser } = await verifySuperadmin(
      req,
      userId
    );

    if (!isSuperadmin) {
      return NextResponse.json(
        {
          error:
            "Acceso denegado. Se requieren permisos de Superadmin para crear tutoriales.",
        },
        { status: 403 }
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "El título del tutorial es obligatorio." },
        { status: 400 }
      );
    }

    // Resolver category_id y category nombre dinámicamente
    let finalCategoryId = category_id;
    let finalCategoryName = category?.trim() || "";

    if (finalCategoryId) {
      const { data: catData } = await supabaseAdmin
        .from("tutorial_categories")
        .select("name")
        .eq("id", finalCategoryId)
        .maybeSingle();
      if (catData) finalCategoryName = catData.name;
    } else if (finalCategoryName) {
      const { data: catData } = await supabaseAdmin
        .from("tutorial_categories")
        .select("id")
        .eq("name", finalCategoryName)
        .maybeSingle();
      if (catData) finalCategoryId = catData.id;
    }

    // Fallback a categoría 'General' si no se especificó o no se encontró
    if (!finalCategoryId) {
      const { data: genCat } = await supabaseAdmin
        .from("tutorial_categories")
        .select("id, name")
        .eq("name", "General")
        .maybeSingle();
      finalCategoryId = genCat?.id;
      finalCategoryName = genCat?.name || "General";
    }

    const creatorId = authUser?.id || userId || null;

    const { data, error } = await supabaseAdmin
      .from("tutorials")
      .insert([
        {
          title: title.trim(),
          description: description?.trim() || null,
          video_url: video_url?.trim() || null,
          category: finalCategoryName,
          category_id: finalCategoryId,
          order_index: typeof order_index === "number" ? order_index : 0,
          is_published: is_published !== false,
          created_by: creatorId,
        },
      ])
      .select("*, tutorial_categories(id, name)")
      .single();

    if (error) {
      console.error("Error al insertar tutorial en Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: unknown) {
    console.error("Excepción al crear tutorial:", err);
    const msg =
      err instanceof Error ? err.message : "Error al registrar tutorial.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT: Actualizar tutorial existente (Solo Superadmin)
export async function PUT(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no está configurada." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      id,
      title,
      description,
      video_url,
      category,
      category_id,
      order_index,
      is_published,
      userId,
    } = body;

    const { isSuperadmin } = await verifySuperadmin(req, userId);
    if (!isSuperadmin) {
      return NextResponse.json(
        {
          error:
            "Acceso denegado. Se requieren permisos de Superadmin para editar tutoriales.",
        },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "El ID del tutorial es requerido." },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) updatePayload.title = title.trim();
    if (description !== undefined)
      updatePayload.description = description.trim();
    if (video_url !== undefined) updatePayload.video_url = video_url.trim();
    if (order_index !== undefined)
      updatePayload.order_index = Number(order_index) || 0;
    if (is_published !== undefined)
      updatePayload.is_published = Boolean(is_published);

    if (category_id !== undefined) {
      updatePayload.category_id = category_id;
      const { data: catData } = await supabaseAdmin
        .from("tutorial_categories")
        .select("name")
        .eq("id", category_id)
        .maybeSingle();
      if (catData) updatePayload.category = catData.name;
    } else if (category !== undefined) {
      updatePayload.category = category.trim();
      const { data: catData } = await supabaseAdmin
        .from("tutorial_categories")
        .select("id")
        .eq("name", category.trim())
        .maybeSingle();
      if (catData) updatePayload.category_id = catData.id;
    }

    const { data, error } = await supabaseAdmin
      .from("tutorials")
      .update(updatePayload)
      .eq("id", id)
      .select("*, tutorial_categories(id, name)")
      .single();

    if (error) {
      console.error("Error al actualizar tutorial:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error al actualizar tutorial.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: Eliminar tutorial (Solo Superadmin)
export async function DELETE(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no está configurada." },
        { status: 500 }
      );
    }

    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");

    const { isSuperadmin } = await verifySuperadmin(req, userId);
    if (!isSuperadmin) {
      return NextResponse.json(
        {
          error:
            "Acceso denegado. Se requieren permisos de Superadmin para eliminar tutoriales.",
        },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "El ID del tutorial es requerido." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("tutorials")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error al eliminar tutorial:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Error al eliminar tutorial.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

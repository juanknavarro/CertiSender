import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inicializar cliente Supabase para consultas de auditoría
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        {
          data: [],
          total: 0,
          warning:
            "Supabase no está configurado. Asegúrate de configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.",
        },
        { status: 200 }
      );
    }

    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userId = searchParams.get("userId");
    const filterIssuerId = searchParams.get("filterIssuerId");

    // 1. Validar el rol del usuario que solicita la información
    let isSuperadmin = false;
    if (userId) {
      const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (requesterProfile?.role === "superadmin") {
        isSuperadmin = true;
      }
    }

    // 2. Construir la consulta principal de certificados
    let query = supabase
      .from("sent_certificates")
      .select("*")
      .order("sent_at", { ascending: false });

    // Aislamiento por RLS / Rol:
    // - Si es Emisor: solo ve registros donde user_id = userId
    // - Si es Superadmin: ve todo, con opción de filtrar por un emisor específico
    if (!isSuperadmin && userId) {
      query = query.eq("user_id", userId);
    } else if (isSuperadmin && filterIssuerId && filterIssuerId !== "all") {
      query = query.eq("user_id", filterIssuerId);
    }

    // Filtro por Fecha de Inicio
    if (startDate && startDate.trim()) {
      const formattedStartDate = startDate.includes("T")
        ? startDate
        : `${startDate}T00:00:00.000Z`;
      query = query.gte("sent_at", formattedStartDate);
    }

    // Filtro por Fecha de Fin
    if (endDate && endDate.trim()) {
      const formattedEndDate = endDate.includes("T")
        ? endDate
        : `${endDate}T23:59:59.999Z`;
      query = query.lte("sent_at", formattedEndDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "Error al consultar la tabla sent_certificates en Supabase:",
        error
      );
      return NextResponse.json(
        {
          error: error.message,
          data: [],
          total: 0,
        },
        { status: 500 }
      );
    }

    // 3. Si es Superadmin, obtener la lista de emisores para el selector de auditoría
    let issuersList: Array<{
      id: string;
      full_name: string;
      email: string;
      cedula: string;
      academic_programs?: { name: string } | null;
    }> = [];

    if (isSuperadmin) {
      const { data: issuers } = await supabase
        .from("profiles")
        .select("id, full_name, email, cedula, academic_programs(name)")
        .order("full_name", { ascending: true });

      if (issuers) {
        issuersList = issuers as unknown as typeof issuersList;
      }
    }

    return NextResponse.json({
      data: data || [],
      total: data?.length || 0,
      isSuperadmin,
      issuers: issuersList,
    });
  } catch (err: unknown) {
    if ((err as { digest?: string })?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw err;
    }

    console.error("Excepción inesperada en GET /api/reports:", err);
    const errorMsg =
      err instanceof Error
        ? err.message
        : "Error interno al consultar los reportes.";

    return NextResponse.json(
      {
        error: errorMsg,
        data: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

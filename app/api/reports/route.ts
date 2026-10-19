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

    let query = supabase
      .from("sent_certificates")
      .select("*")
      .order("sent_at", { ascending: false });

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

    return NextResponse.json({
      data: data || [],
      total: data?.length || 0,
    });
  } catch (err: unknown) {
    // Permitir que Next.js maneje internamente las señales de prerendering dinámico
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

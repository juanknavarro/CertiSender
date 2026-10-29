/**
 * Utilidades de normalización estricta y mapeo dinámico de datos de Excel para CertiSender.
 */

import { Attendee } from "@/utils/pdfGenerator";

export interface ColumnMappingConfig {
  nameMode: "single" | "split";
  fullNameCol: string;
  firstNameCol: string;
  lastNameCol: string;
  emailCol: string;
  docNumberCol: string;
  docTypeCol: string;
  defaultDocType: string;
}

/**
 * Normaliza una cadena para comparaciones heurísticas sin acentos ni caracteres especiales.
 */
export function normalizeHeaderString(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Normaliza un nombre o apellido a MAYÚSCULAS absolutas,
 * eliminando espacios sobrantes al inicio, final y colapsando espacios múltiples internos.
 */
export function toCleanUppercase(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/**
 * Normaliza un correo electrónico a minúsculas absolutas,
 * removiendo espacios en blanco al inicio, final y caracteres invisibles internos.
 */
export function toCleanEmail(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return str
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * Normaliza un número de documento removiendo espacios y puntos decimales accidentales de Excel (.0).
 */
export function toCleanDocNumber(value: unknown): string {
  if (value === null || value === undefined) return "N/A";
  let str = String(value).trim();
  if (!str) return "N/A";
  // Si Excel parseó un número entero como decimal flotante (ej. 10456789.0)
  if (/^\d+\.0$/.test(str)) {
    str = str.replace(/\.0$/, "");
  }
  return str;
}

/**
 * Infiere automáticamente el mejor mapeo de columnas disponible a partir de los encabezados detectados.
 */
export function inferInitialColumnMapping(headers: string[]): ColumnMappingConfig {
  const normHeaders = headers.map((h) => ({
    original: h,
    norm: normalizeHeaderString(h),
  }));

  // 1. Detección de Nombre Completo
  let fullNameCol = "";
  const fullMatch = normHeaders.find((item) => {
    const n = item.norm;
    return (
      n === "nombresyapellidos" ||
      n === "nombreyapellido" ||
      n === "nombresyapellido" ||
      n === "nombrecompleto" ||
      n === "estudiante" ||
      n === "asistente" ||
      (n.includes("nombre") && (n.includes("apellido") || n.includes("completo")))
    );
  });
  if (fullMatch) fullNameCol = fullMatch.original;

  // 2. Detección de Nombres y Apellidos Separados
  let firstNameCol = "";
  let lastNameCol = "";

  const firstMatch = normHeaders.find((item) => {
    const n = item.norm;
    return (
      (n === "nombre" || n === "nombres" || n === "primernombre") &&
      !n.includes("apellido")
    );
  });
  if (firstMatch) firstNameCol = firstMatch.original;

  const lastMatch = normHeaders.find((item) => {
    const n = item.norm;
    return (
      n === "apellido" ||
      n === "apellidos" ||
      n === "primerapellido" ||
      n.includes("apellido")
    );
  });
  if (lastMatch) lastNameCol = lastMatch.original;

  // Decidir si arranca en modo 'split' o 'single'
  const preferSplit = !fullNameCol && Boolean(firstNameCol && lastNameCol);
  const nameMode: "single" | "split" = preferSplit ? "split" : "single";

  // Si no encontró fullMatch pero tampoco ambos para split, asignar el primero disponible
  if (!fullNameCol && headers.length > 0) {
    fullNameCol = headers[0];
  }
  if (!firstNameCol && headers.length > 0) {
    firstNameCol = headers[0];
  }
  if (!lastNameCol && headers.length > 1) {
    lastNameCol = headers[1];
  }

  // 3. Detección de Correo Electrónico
  let emailCol = "";
  const emailMatch2 = normHeaders.find((item) => {
    const n = item.norm;
    return (
      n === "correoelectronico2" ||
      ((n.includes("correo") || n.includes("email")) && n.includes("2"))
    );
  });

  const emailMatch = emailMatch2 || normHeaders.find((item) => {
    const n = item.norm;
    return (
      n === "correoelectronico" ||
      n === "correo" ||
      n === "email" ||
      n.includes("correo") ||
      n.includes("email") ||
      n.includes("mail")
    );
  });
  if (emailMatch) {
    emailCol = emailMatch.original;
  } else {
    // Tomar segunda o tercera columna por defecto si existe
    const fallbackEmail = headers.find((h) => h !== fullNameCol);
    emailCol = fallbackEmail || (headers[1] || headers[0] || "");
  }

  // 4. Detección de Tipo de Documento
  let docTypeCol = "";
  const docTypeMatch = normHeaders.find((item) => {
    const n = item.norm;
    return (
      n === "tipodeidentificacion" ||
      n === "tipodeidentificacin" ||
      n === "tipodocumento" ||
      n === "tipodoc" ||
      (n.includes("tipo") && (n.includes("identifica") || n.includes("documento")))
    );
  });
  if (docTypeMatch) docTypeCol = docTypeMatch.original;

  // 5. Detección de Número de Documento
  let docNumberCol = "";
  const docNumMatch = normHeaders.find((item) => {
    const n = item.norm;
    return (
      n === "ndeidentificacion" ||
      n === "nodeidentificacion" ||
      n === "nrodeidentificacion" ||
      n === "numerodeidentificacion" ||
      n === "numerodedocumento" ||
      n === "documento" ||
      n === "identificacion" ||
      n === "cedula" ||
      ((n.includes("identifica") || n.includes("documento")) && !n.includes("tipo"))
    );
  });
  if (docNumMatch) docNumberCol = docNumMatch.original;

  return {
    nameMode,
    fullNameCol,
    firstNameCol: firstNameCol || fullNameCol,
    lastNameCol: lastNameCol || fullNameCol,
    emailCol,
    docTypeCol,
    docNumberCol,
    defaultDocType: "CC",
  };
}

/**
 * Transforma las filas crudas leídas de Excel a un arreglo de Attendee con normalización estricta.
 */
export function transformRowsToAttendees(
  rawRows: unknown[][],
  headers: string[],
  mapping: ColumnMappingConfig,
  limit?: number
): Attendee[] {
  if (!rawRows || rawRows.length < 2) return [];

  const emailIdx = headers.indexOf(mapping.emailCol);
  const docTypeIdx = mapping.docTypeCol ? headers.indexOf(mapping.docTypeCol) : -1;
  const docNumberIdx = mapping.docNumberCol ? headers.indexOf(mapping.docNumberCol) : -1;

  const fullNameIdx = mapping.nameMode === "single" ? headers.indexOf(mapping.fullNameCol) : -1;
  const firstNameIdx = mapping.nameMode === "split" ? headers.indexOf(mapping.firstNameCol) : -1;
  const lastNameIdx = mapping.nameMode === "split" ? headers.indexOf(mapping.lastNameCol) : -1;

  const results: Attendee[] = [];
  const max = limit ? Math.min(rawRows.length, limit + 1) : rawRows.length;

  for (let i = 1; i < max; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.length === 0) continue;

    let rawFullName = "";
    if (mapping.nameMode === "single") {
      rawFullName = fullNameIdx !== -1 ? String(row[fullNameIdx] ?? "") : "";
    } else {
      const fName = firstNameIdx !== -1 ? String(row[firstNameIdx] ?? "") : "";
      const lName = lastNameIdx !== -1 ? String(row[lastNameIdx] ?? "") : "";
      rawFullName = `${fName} ${lName}`;
    }

    const cleanFullName = toCleanUppercase(rawFullName);
    const cleanEmail = emailIdx !== -1 ? toCleanEmail(row[emailIdx]) : "";
    const cleanDocType =
      docTypeIdx !== -1 && row[docTypeIdx]
        ? toCleanUppercase(row[docTypeIdx])
        : mapping.defaultDocType || "CC";
    const cleanDocNumber =
      docNumberIdx !== -1 ? toCleanDocNumber(row[docNumberIdx]) : "N/A";

    if (cleanFullName.length > 0 && cleanEmail.length > 0) {
      results.push({
        fullName: cleanFullName,
        email: cleanEmail,
        docType: cleanDocType,
        docNumber: cleanDocNumber,
      });
    }
  }

  return results;
}


import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { CertificateSettings } from "@/context/SettingsContext";

export interface Attendee {
  fullName: string;
  docType: string;
  docNumber: string;
  email: string;
}

/**
 * Convierte un código HEX (#RRGGBB o #RGB) a formato RGB de pdf-lib (escala decimal 0 a 1).
 *
 * @param hex Código hexadecimal de color
 * @returns Instancia rgb de pdf-lib lista para drawText
 */
export function hexToPdfRgb(hex: string) {
  let cleanHex = (hex || "").replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  return rgb(
    isNaN(r) ? 0.1 : Math.max(0, Math.min(1, r)),
    isNaN(g) ? 0.15 : Math.max(0, Math.min(1, g)),
    isNaN(b) ? 0.3 : Math.max(0, Math.min(1, b))
  );
}

/**
 * Construye y formatea el PDF del certificado para un participante a partir de un ArrayBuffer
 * y parámetros de diseño tipográficos dinámicos.
 *
 * @param attendee Datos del participante
 * @param templateBuffer Buffer binario del archivo PDF de la plantilla subida dinámicamente
 * @param settings Configuraciones dinámicas de tamaños de fuente y colores
 * @returns Instancia modificada de PDFDocument
 */
export async function buildCertificateDocument(
  attendee: Attendee,
  templateBuffer?: ArrayBuffer | null,
  settings?: CertificateSettings
): Promise<PDFDocument> {
  let existingPdfBytes: ArrayBuffer;

  if (templateBuffer) {
    existingPdfBytes = templateBuffer;
  } else {
    // Fallback hacia la plantilla estática si no se pasó un buffer dinámico
    const response = await fetch("/plantilla_base.pdf");
    if (!response.ok) {
      throw new Error(
        "No se encontró la plantilla PDF base. Por favor sube tu archivo PDF desde la interfaz antes de continuar."
      );
    }
    existingPdfBytes = await response.arrayBuffer();
  }

  // 1. Cargar el documento PDF con pdf-lib
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  // 2. Obtener la primera página y extraer dimensiones reales
  const pages = pdfDoc.getPages();
  const page = pages[0];

  if (!page) {
    throw new Error("El archivo PDF base no contiene páginas legibles.");
  }

  const { width, height } = page.getSize();

  // 3. Incrustar fuentes estándar para medición exacta del texto
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 4. Parámetros Tipográficos Dinámicos (o valores por defecto)
  const nameFontSize = settings?.nameFontSize ?? 28;
  const nameColor = hexToPdfRgb(settings?.nameColorHex ?? "#1a264d");

  const docFontSize = settings?.docFontSize ?? 14;
  const docColor = hexToPdfRgb(settings?.docColorHex ?? "#4d4d4d");

  // 5. Cálculo Proporcional del Eje Y
  const yNombre = height * 0.665; // A ras de la línea dorada inferior
  const yDoc = height * 0.62;     // Justo por debajo de la línea dorada

  // 6. Normalización a Mayúsculas y Centrado Horizontal Dinámico del Nombre Completo
  const formattedName = (attendee.fullName || "").trim().toUpperCase();
  const nameTextWidth = fontBold.widthOfTextAtSize(formattedName, nameFontSize);
  const xName = (width - nameTextWidth) / 2;

  page.drawText(formattedName, {
    x: xName,
    y: yNombre,
    size: nameFontSize,
    font: fontBold,
    color: nameColor,
  });

  // 7. Concatenación y Centrado Horizontal Dinámico del Tipo y Número de Documento
  const docType = (attendee.docType || "CC").trim();
  const docNumber = (attendee.docNumber || "N/A").trim();
  const docText = `${docType}. ${docNumber}`;
  const docTextWidth = fontRegular.widthOfTextAtSize(docText, docFontSize);
  const xDoc = (width - docTextWidth) / 2;

  page.drawText(docText, {
    x: xDoc,
    y: yDoc,
    size: docFontSize,
    font: fontRegular,
    color: docColor,
  });

  return pdfDoc;
}

/**
 * Genera el certificado y lo retorna como un Blob listo para visualización en el navegador.
 */
export async function generateCertificate(
  attendee: Attendee,
  templateBuffer?: ArrayBuffer | null,
  settings?: CertificateSettings
): Promise<Blob> {
  const pdfDoc = await buildCertificateDocument(
    attendee,
    templateBuffer,
    settings
  );
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as unknown as BlobPart], {
    type: "application/pdf",
  });
}

/**
 * Genera el certificado y lo retorna como una cadena en formato Base64 para el envío por correo.
 */
export async function generateCertificateBase64(
  attendee: Attendee,
  templateBuffer?: ArrayBuffer | null,
  settings?: CertificateSettings
): Promise<string> {
  const pdfDoc = await buildCertificateDocument(
    attendee,
    templateBuffer,
    settings
  );
  return await pdfDoc.saveAsBase64({ dataUri: false });
}

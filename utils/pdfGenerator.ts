import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface Attendee {
  fullName: string;
  docType: string;
  docNumber: string;
  email: string;
}

/**
 * Construye y formatea el PDF del certificado para un participante a partir de un ArrayBuffer de la plantilla base.
 *
 * @param attendee Datos del participante
 * @param templateBuffer Buffer binario del archivo PDF de la plantilla subida dinámicamente
 * @returns Instancia modificada de PDFDocument
 */
export async function buildCertificateDocument(
  attendee: Attendee,
  templateBuffer?: ArrayBuffer | null
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

  // 4. Cálculo Proporcional del Eje Y
  const yNombre = height * 0.665; // A ras de la línea dorada inferior
  const yDoc = height * 0.62;     // Justo por debajo de la línea dorada

  // 5. Normalización a Mayúsculas y Centrado Horizontal Dinámico del Nombre Completo
  const formattedName = (attendee.fullName || "").trim().toUpperCase();
  const nameFontSize = 28;
  const nameTextWidth = fontBold.widthOfTextAtSize(formattedName, nameFontSize);
  const xName = (width - nameTextWidth) / 2;

  page.drawText(formattedName, {
    x: xName,
    y: yNombre,
    size: nameFontSize,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.3),
  });

  // 6. Concatenación y Centrado Horizontal Dinámico del Tipo y Número de Documento
  const docType = (attendee.docType || "CC").trim();
  const docNumber = (attendee.docNumber || "N/A").trim();
  const docText = `${docType}. ${docNumber}`;
  const docFontSize = 14;
  const docTextWidth = fontRegular.widthOfTextAtSize(docText, docFontSize);
  const xDoc = (width - docTextWidth) / 2;

  page.drawText(docText, {
    x: xDoc,
    y: yDoc,
    size: docFontSize,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });

  return pdfDoc;
}

/**
 * Genera el certificado y lo retorna como un Blob listo para visualización en el navegador.
 */
export async function generateCertificate(
  attendee: Attendee,
  templateBuffer?: ArrayBuffer | null
): Promise<Blob> {
  const pdfDoc = await buildCertificateDocument(attendee, templateBuffer);
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
  templateBuffer?: ArrayBuffer | null
): Promise<string> {
  const pdfDoc = await buildCertificateDocument(attendee, templateBuffer);
  return await pdfDoc.saveAsBase64({ dataUri: false });
}

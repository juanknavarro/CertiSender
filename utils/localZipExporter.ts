import JSZip from "jszip";
import { CertificateSettings } from "@/context/SettingsContext";
import { generateCertificateBase64, Attendee } from "@/utils/pdfGenerator";

interface ExportLocalZipOptions {
  attendees: Attendee[];
  templateBuffer: ArrayBuffer | null;
  settings: CertificateSettings;
  subject: string;
  messageBody: string;
  personalizeMessage: (template: string, attendee: Attendee) => string;
  onProgress?: (current: number, total: number, name: string) => void;
}

// Limpia caracteres no aptos para nombres de archivo en Windows
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim();
}

// Escapa valores para formato CSV RFC 4180
function escapeCsvValue(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function exportLocalZipPackage({
  attendees,
  templateBuffer,
  settings,
  subject,
  messageBody,
  personalizeMessage,
  onProgress,
}: ExportLocalZipOptions): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();
  const folderCertificados = zip.folder("certificados");

  const csvRows: string[] = [
    "correo_destino,nombre_completo,documento,asunto,cuerpo_mensaje,archivo_pdf",
  ];

  const total = attendees.length;

  for (let i = 0; i < total; i++) {
    const attendee = attendees[i];
    if (onProgress) {
      onProgress(i + 1, total, attendee.fullName);
    }

    // 1. Generar PDF vectorial en base64
    const pdfBase64 = await generateCertificateBase64(
      attendee,
      templateBuffer,
      settings
    );

    // 2. Convertir base64 a Uint8Array
    const binary = atob(pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let b = 0; b < binary.length; b++) {
      bytes[b] = binary.charCodeAt(b);
    }

    // 3. Nombre de archivo único y limpio
    const cleanDoc = attendee.docNumber ? sanitizeFilename(attendee.docNumber) : `${i + 1}`;
    const cleanName = sanitizeFilename(attendee.fullName);
    const pdfFilename = `Certificado_${cleanDoc}_${cleanName}.pdf`;
    const relativePdfPath = `certificados/${pdfFilename}`;

    // Añadir PDF al ZIP
    folderCertificados?.file(pdfFilename, bytes);

    // 4. Personalizar mensaje
    const customizedBody = personalizeMessage(messageBody, attendee);

    // Añadir fila al CSV
    csvRows.push(
      [
        escapeCsvValue(attendee.email),
        escapeCsvValue(attendee.fullName),
        escapeCsvValue(attendee.docNumber || "N/A"),
        escapeCsvValue(subject.trim()),
        escapeCsvValue(customizedBody),
        escapeCsvValue(relativePdfPath),
      ].join(",")
    );
  }

  // Guardar archivo relacion.csv con BOM UTF-8 para compatibilidad nativa con Excel/Windows
  const csvContent = "\uFEFF" + csvRows.join("\r\n");
  zip.file("relacion.csv", csvContent);

  // Obtener el ejecutable compilado certisender_outlook.exe desde /public
  try {
    const exeResponse = await fetch("/certisender_outlook.exe");
    if (!exeResponse.ok) {
      throw new Error(
        `No se pudo cargar el archivo ejecutable 'certisender_outlook.exe' (HTTP ${exeResponse.status}). Verifica que esté ubicado en la carpeta public/.`
      );
    }
    const exeArrayBuffer = await exeResponse.arrayBuffer();
    zip.file("certisender_outlook.exe", exeArrayBuffer, { binary: true });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error
        ? err.message
        : "Error al obtener certisender_outlook.exe desde public/.";
    console.error("Fallo al empaquetar certisender_outlook.exe:", err);
    throw new Error(errorMsg);
  }

  // Añadir archivo LEEME_INSTRUCCIONES.txt
  const readmeContent = `==============================================================================
CERTISENDER - PAQUETE DE DESPACHO LOCAL (OUTLOOK DESKTOP)
==============================================================================

INSTRUCCIONES DE USO:
1. Extrae todo el contenido de este archivo ZIP en una carpeta de tu computador.
2. Asegúrate de tener abierto Microsoft Outlook institucional en Windows con tu sesión activa.
3. Haz doble clic directamente sobre el ejecutable:
       certisender_outlook.exe
   (No requiere tener instalado Python ni librerías adicionales).
4. El programa leerá automáticamente 'relacion.csv', adjuntará cada diploma de la carpeta
   'certificados/' y despachará los mensajes a través de tu cuenta corporativa.

==============================================================================
`;
  zip.file("LEEME_INSTRUCCIONES.txt", readmeContent);

  // Generar blob del ZIP
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const filename = `CertiSender_Despacho_${dateStr}.zip`;

  return { blob, filename };
}

// Descarga en navegador
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

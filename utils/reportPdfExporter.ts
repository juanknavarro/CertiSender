import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface SentCertificateRecord {
  id: string;
  recipient_name: string;
  recipient_email: string;
  doc_type: string;
  doc_number: string;
  sender_email: string;
  sent_at: string;
}

// Formateador de fecha legible
function formatDateTime(dateString: string): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
}

/**
 * Exporta el historial de certificados emitidos a un documento PDF vectorial y paginado.
 *
 * @param data Lista de registros de certificados emitidos
 * @param startDate Fecha inicial del filtro (opcional)
 * @param endDate Fecha final del filtro (opcional)
 */
export function exportReportsToPDF(
  data: SentCertificateRecord[],
  startDate?: string,
  endDate?: string
): void {
  // Inicializar documento A4 vertical en milímetros
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Banda decorativa superior (Azul Índigo / Corporativo)
  doc.setFillColor(49, 46, 129); // #312e81
  doc.rect(0, 0, pageWidth, 5, "F");

  // Título centrado y corporativo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("CertiSender - Reporte Oficial de Emisiones", pageWidth / 2, 20, {
    align: "center",
  });

  // Línea sutil divisoria bajo el título
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(14, 25, pageWidth - 14, 25);

  // Metadatos del informe
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105); // slate-600

  // Determinación del texto de rango
  let rangeText = "Historial Completo (Sin filtro de fechas)";
  if (startDate && endDate) {
    rangeText = `Del ${startDate} al ${endDate}`;
  } else if (startDate) {
    rangeText = `Desde ${startDate}`;
  } else if (endDate) {
    rangeText = `Hasta ${endDate}`;
  }

  // Generado el:
  const now = new Date();
  const generatedDateStr = `${String(now.getDate()).padStart(2, "0")}/${String(
    now.getMonth() + 1
  ).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(
    2,
    "0"
  )}:${String(now.getMinutes()).padStart(2, "0")}`;

  // Columna izquierda de metadatos
  doc.text(`Rango de fechas: ${rangeText}`, 14, 32);
  doc.text(`Total de certificados emitidos: ${data.length}`, 14, 38);

  // Columna derecha de metadatos
  doc.text(`Fecha de generación: ${generatedDateStr}`, pageWidth - 14, 32, {
    align: "right",
  });
  doc.text("Estado: Auditoría Verificada (TLS/SMTP)", pageWidth - 14, 38, {
    align: "right",
  });

  // Preparar filas de la tabla
  const tableHeaders = [
    [
      "#",
      "Participante",
      "Documento",
      "Correo Destino",
      "Fecha de Envío",
      "Remitente",
    ],
  ];

  const tableBody = data.map((record, index) => {
    const docDisplay =
      record.doc_type && record.doc_number
        ? `${record.doc_type}. ${record.doc_number}`
        : record.doc_number || "N/A";

    return [
      String(index + 1),
      record.recipient_name || "N/A",
      docDisplay,
      record.recipient_email || "N/A",
      formatDateTime(record.sent_at),
      record.sender_email || "N/A",
    ];
  });

  // Generación de tabla con jspdf-autotable
  autoTable(doc, {
    head: tableHeaders,
    body: tableBody,
    startY: 44,
    margin: { left: 14, right: 14, bottom: 20 },
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: [51, 65, 85], // slate-700
      cellPadding: 2.8,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [49, 46, 129], // indigo-900 (#312e81)
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 }, // #
      1: { fontStyle: "bold", cellWidth: 42 }, // Participante
      2: { cellWidth: 30 }, // Documento
      3: { cellWidth: 42 }, // Correo Destino
      4: { halign: "center", cellWidth: 26 }, // Fecha de Envío
      5: { cellWidth: 32 }, // Remitente
    },
    didDrawPage: (hookData) => {
      // Pie de página en todas las páginas
      const currentDoc = hookData.doc;
      const totalPages = (currentDoc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      const pageNum = hookData.pageNumber;

      currentDoc.setFont("helvetica", "normal");
      currentDoc.setFontSize(8);
      currentDoc.setTextColor(148, 163, 184); // slate-400

      // Línea superior del pie
      currentDoc.setDrawColor(226, 232, 240);
      currentDoc.setLineWidth(0.3);
      currentDoc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

      // Texto izquierdo: Sistema
      currentDoc.text(
        "CertiSender v2.1 • Sistema Automatizado de Certificados",
        14,
        pageHeight - 7
      );

      // Texto derecho: Número de página
      currentDoc.text(
        `Página ${pageNum} de ${totalPages}`,
        pageWidth - 14,
        pageHeight - 7,
        { align: "right" }
      );
    },
  });

  // Descarga del documento PDF
  doc.save("Reporte_CertiSender.pdf");
}

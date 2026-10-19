"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  UploadCloud,
  Send,
  FileCheck2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Mail,
  FileText,
  AlertTriangle,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  generateCertificate,
  generateCertificateBase64,
  Attendee,
} from "@/utils/pdfGenerator";
import { useSettings } from "@/context/SettingsContext";

// Flexible string normalization to match varying column header casing, accents and symbols
function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, "") // remove spaces, dots, °, º, etc.
    .trim();
}

export default function CertiSenderDashboard() {
  // Global Typography and Color Settings
  const { settings } = useSettings();

  // States for Dynamic PDF Template
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);

  // States for Sender Credentials
  const [senderEmail, setSenderEmail] = useState<string>("");
  const [senderPassword, setSenderPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // States for Email Configuration
  const [subject, setSubject] = useState<string>(
    "Entrega de Certificado Oficial de Acreditación - CertiSender"
  );
  const [messageBody, setMessageBody] = useState<string>(
    "Estimado/a [Nombre],\n\nNos complace adjuntar a este correo tu certificado oficial correspondiente al evento/curso completado satisfactoriamente.\n\nDatos registrados:\n- Identificación: {{tipo_doc}}. {{documento}}\n\n¡Felicitaciones por este logro!\n\nAtentamente,\nEl Equipo de Coordinación"
  );

  // States for File Upload and Attendees
  const [uploadedExcelFile, setUploadedExcelFile] = useState<File | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>("");
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // 1. Manejador de carga de Plantilla Base PDF
  const onDropPdf = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];

    const reader = new FileReader();
    reader.onerror = () => {
      setNotification({
        type: "error",
        message: "Error al leer el archivo PDF en el navegador.",
      });
    };

    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (!buffer) {
        setNotification({
          type: "error",
          message: "No se pudo leer el contenido binario del PDF.",
        });
        return;
      }

      setTemplateBuffer(buffer);
      setTemplateFile(file);
      setNotification({
        type: "success",
        message: `Plantilla base "${file.name}" cargada en memoria. Los certificados se generarán sobre este diseño.`,
      });
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const {
    getRootProps: getPdfRootProps,
    getInputProps: getPdfInputProps,
    isDragActive: isPdfDragActive,
  } = useDropzone({
    onDrop: onDropPdf,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  const handleRemovePdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplateFile(null);
    setTemplateBuffer(null);
    setNotification(null);
  };

  // 2. Manejador de carga y limpieza de Excel (Google Forms)
  const onDropExcel = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploadedExcelFile(file);
    setNotification(null);

    const reader = new FileReader();

    reader.onerror = () => {
      setAttendees([]);
      setNotification({
        type: "error",
        message:
          "Error al leer el archivo en el navegador. Por favor intenta nuevamente.",
      });
    };

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          throw new Error("No se pudo obtener el contenido del archivo.");
        }

        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new Error(
            "El archivo Excel subido no contiene ninguna hoja de cálculo válida."
          );
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
          blankrows: false,
        });

        if (rows.length < 2) {
          throw new Error(
            "El archivo Excel está vacío o no contiene filas de datos suficientes (se requiere cabecera y al menos un registro)."
          );
        }

        const headerRow = (rows[0] as unknown[]).map((cell) =>
          typeof cell === "string" ? cell.trim() : String(cell || "").trim()
        );

        // Column: "Nombres y apellidos"
        const fullNameIdx = headerRow.findIndex((h) => {
          const n = normalizeHeader(h);
          return (
            n === "nombresyapellidos" ||
            n === "nombreyapellido" ||
            n === "nombresyapellido" ||
            (n.includes("nombre") && (n.includes("apellido") || n.includes("completo")))
          );
        });

        // Column: "Tipo de identificación"
        const docTypeIdx = headerRow.findIndex((h) => {
          const n = normalizeHeader(h);
          return (
            n === "tipodeidentificacion" ||
            n === "tipodeidentificacin" ||
            n === "tipodocumento" ||
            (n.includes("tipo") && (n.includes("identifica") || n.includes("documento")))
          );
        });

        // Column: "N° de identificación"
        const docNumberIdx = headerRow.findIndex((h) => {
          const n = normalizeHeader(h);
          return (
            n === "ndeidentificacion" ||
            n === "nodeidentificacion" ||
            n === "nrodeidentificacion" ||
            n === "numerodeidentificacion" ||
            n === "numerodedocumento" ||
            ((n.includes("identifica") || n.includes("documento")) && !n.includes("tipo"))
          );
        });

        // Column: "Correo Electrónico2"
        let emailIdx = headerRow.findIndex((h) => {
          const n = normalizeHeader(h);
          return (
            n === "correoelectronico2" ||
            ((n.includes("correo") || n.includes("email")) && n.includes("2"))
          );
        });

        if (emailIdx === -1) {
          emailIdx = headerRow.findIndex((h) => {
            const n = normalizeHeader(h);
            return (
              n === "correoelectronico" ||
              n === "email" ||
              n.includes("correo") ||
              n.includes("email")
            );
          });
        }

        const missingCols: string[] = [];
        if (fullNameIdx === -1) missingCols.push('"Nombres y apellidos"');
        if (emailIdx === -1) missingCols.push('"Correo Electrónico2"');

        if (missingCols.length > 0) {
          throw new Error(
            `El archivo no contiene las columnas requeridas: ${missingCols.join(
              ", "
            )}. Asegúrate de subir el archivo original de Google Forms.`
          );
        }

        const cleanedAttendees: Attendee[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          if (!row || row.length === 0) continue;

          const fullName =
            fullNameIdx !== -1 ? String(row[fullNameIdx] ?? "").trim() : "";
          const docType =
            docTypeIdx !== -1 ? String(row[docTypeIdx] ?? "").trim() : "CC";
          const docNumber =
            docNumberIdx !== -1 ? String(row[docNumberIdx] ?? "").trim() : "N/A";
          const email =
            emailIdx !== -1 ? String(row[emailIdx] ?? "").trim() : "";

          if (fullName.length > 0 && email.length > 0) {
            cleanedAttendees.push({
              fullName,
              docType: docType || "CC",
              docNumber: docNumber || "N/A",
              email,
            });
          }
        }

        if (cleanedAttendees.length === 0) {
          throw new Error(
            "No se encontraron asistentes válidos. Todas las filas evaluadas carecían de Nombre o Correo Electrónico."
          );
        }

        setAttendees(cleanedAttendees);
        setNotification({
          type: "success",
          message: `¡Excel procesado con éxito! Se cargaron ${cleanedAttendees.length} asistentes listos para recibir su certificado.`,
        });
      } catch (err: unknown) {
        console.error("Error al procesar Excel:", err);
        setAttendees([]);
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Error inesperado al procesar el archivo Excel. Verifica el formato.";
        setNotification({
          type: "error",
          message: errorMsg,
        });
      }
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const {
    getRootProps: getExcelRootProps,
    getInputProps: getExcelInputProps,
    isDragActive: isExcelDragActive,
    isDragReject: isExcelDragReject,
  } = useDropzone({
    onDrop: onDropExcel,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  const handleRemoveExcel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedExcelFile(null);
    setAttendees([]);
    setNotification(null);
  };

  const insertVariable = (variable: string) => {
    setMessageBody((prev) => `${prev} {{${variable}}}`);
  };

  // Helper para personalizar el cuerpo del mensaje con datos del asistente
  const personalizeMessage = (template: string, attendee: Attendee) => {
    const formattedName = (attendee.fullName || "").trim().toUpperCase();
    const docType = (attendee.docType || "CC").trim();
    const docNumber = (attendee.docNumber || "N/A").trim();

    return template
      .replace(/\[nombre\]/gi, formattedName)
      .replace(/\{\{nombre\}\}/gi, formattedName)
      .replace(/\[documento\]/gi, docNumber)
      .replace(/\{\{documento\}\}/gi, docNumber)
      .replace(/\[tipo_doc\]/gi, docType)
      .replace(/\{\{tipo_doc\}\}/gi, docType);
  };

  // Manejador para previsualizar el certificado PDF de una fila
  const handleViewPdf = async (attendee: Attendee, index: number) => {
    if (!templateBuffer) {
      setNotification({
        type: "error",
        message:
          "Por favor, sube primero la plantilla base en formato PDF (.pdf) en la zona de trabajo.",
      });
      return;
    }

    try {
      setGeneratingIndex(index);
      const pdfBlob = await generateCertificate(
        attendee,
        templateBuffer,
        settings
      );
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");
    } catch (err: unknown) {
      console.error("Error al generar PDF:", err);
      const errorMsg =
        err instanceof Error
          ? err.message
          : "No se pudo generar la vista previa del certificado.";
      setNotification({
        type: "error",
        message: errorMsg,
      });
    } finally {
      setGeneratingIndex(null);
    }
  };

  // Manejador del botón "Generar y Enviar Certificados" con envío secuencial
  const handleGenerateAndSend = async () => {
    if (!templateBuffer) {
      setNotification({
        type: "error",
        message:
          "Debes subir la Plantilla Base en formato PDF (.pdf) antes de generar y enviar los certificados.",
      });
      return;
    }

    if (!uploadedExcelFile || attendees.length === 0) {
      setNotification({
        type: "error",
        message:
          "Debes subir un archivo Excel (.xlsx) con asistentes válidos antes de iniciar el envío.",
      });
      return;
    }

    if (!senderEmail.trim()) {
      setNotification({
        type: "error",
        message: "Por favor, ingresa el Correo Remitente en las credenciales.",
      });
      return;
    }

    if (!senderPassword.trim()) {
      setNotification({
        type: "error",
        message:
          "Por favor, ingresa la Contraseña de Aplicación en las credenciales.",
      });
      return;
    }

    if (!subject.trim()) {
      setNotification({
        type: "error",
        message: "Por favor, ingresa el asunto del correo.",
      });
      return;
    }

    if (!messageBody.trim()) {
      setNotification({
        type: "error",
        message: "Por favor, ingresa el cuerpo del mensaje.",
      });
      return;
    }

    setIsSending(true);
    setNotification(null);
    setProgress(`Iniciando envío a ${attendees.length} asistentes...`);

    let currentIndex = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const attendee of attendees) {
      currentIndex++;
      setProgress(
        `Enviando ${currentIndex} de ${attendees.length} (${attendee.fullName})...`
      );

      try {
        // 1. Generar el PDF en Base64 usando el templateBuffer dinámico y las configuraciones de diseño
        const pdfBase64 = await generateCertificateBase64(
          attendee,
          templateBuffer,
          settings
        );

        // 2. Personalizar el cuerpo del mensaje
        const customizedBody = personalizeMessage(messageBody, attendee);

        // 3. Petición POST a la API backend con credenciales dinámicas
        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: attendee.email,
            subject: subject.trim(),
            body: customizedBody,
            pdfBase64,
            senderEmail: senderEmail.trim(),
            senderPassword: senderPassword.trim(),
            recipient_name: attendee.fullName,
            doc_type: attendee.docType || "CC",
            doc_number: attendee.docNumber || "N/A",
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Error ${response.status}`);
        }

        successCount++;
      } catch (err: unknown) {
        failureCount++;
        const errorMessage =
          err instanceof Error ? err.message : "Error desconocido";
        console.error(
          `Error despachando certificado a ${attendee.email}:`,
          errorMessage
        );

        if (
          errorMessage.includes("credenciales") ||
          errorMessage.includes("EAUTH") ||
          errorMessage.includes("invalid login") ||
          errorMessage.includes("Username and Password not accepted") ||
          errorMessage.includes("ECONNREFUSED")
        ) {
          setNotification({
            type: "error",
            message: `Error de autenticación SMTP: ${errorMessage}. Revisa tu correo remitente y asegúrate de usar una contraseña de aplicación válida de 16 caracteres.`,
          });
          setIsSending(false);
          setProgress("");
          return;
        }
      }
    }

    setIsSending(false);
    setProgress("");

    if (failureCount === 0) {
      setNotification({
        type: "success",
        message: `¡Proceso completado exitosamente! Se generaron y enviaron los certificados a los ${successCount} asistentes.`,
      });
    } else {
      setNotification({
        type: "warning",
        message: `Envío finalizado: ${successCount} certificados entregados, ${failureCount} con error. Consulta la consola para más detalles.`,
      });
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Top Breadcrumb & Title Banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Emisión de Certificados
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Fase 1
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Carga tu plantilla PDF personalizada, importa los asistentes de Excel y despacha masivamente por correo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white py-1.5 px-3 rounded-lg border border-slate-200/70 shadow-2xs">
            <span
              className={`h-2 w-2 rounded-full ${
                templateBuffer ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
            <span>
              {templateBuffer ? "Plantilla PDF Lista" : "Esperando Plantilla"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white py-1.5 px-3 rounded-lg border border-slate-200/70 shadow-2xs">
            <span
              className={`h-2 w-2 rounded-full ${
                attendees.length > 0 ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            <span>{attendees.length} Asistentes</span>
          </div>
        </div>
      </div>

      {/* Banner Notification if active */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-xl border flex items-start gap-3 transition-all duration-300 ${
            notification.type === "success"
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-900 shadow-xs"
              : notification.type === "warning"
              ? "bg-amber-50/90 border-amber-200 text-amber-900 shadow-xs"
              : "bg-rose-50/90 border-rose-200 text-rose-900 shadow-xs"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : notification.type === "warning" ? (
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-sm font-medium">
            {notification.message}
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors ml-2 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* CSS Grid: Divided into Two Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ========================================================= */}
        {/* SECCIÓN IZQUIERDA: ZONA DE TRABAJO (lg:col-span-7/8)      */}
        {/* ========================================================= */}
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          {/* Header of Left Section */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 text-blue-700 text-xs font-bold">
                  1
                </span>
                Carga de Insumos (Plantilla & Destinatarios)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sube tu diseño PDF base y el archivo Excel exportado de Google Forms.
              </p>
            </div>
          </div>

          {/* DUAL DROPZONES: 1. Plantilla PDF  |  2. Archivo Excel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* DROPZONE 1: PLANTILLA BASE PDF */}
            <div
              {...getPdfRootProps()}
              className={`relative rounded-2xl border-2 border-dashed p-5 text-center transition-all duration-200 cursor-pointer ${
                isPdfDragActive
                  ? "border-indigo-500 bg-indigo-50/70 ring-4 ring-indigo-500/10 scale-[1.01]"
                  : templateBuffer
                  ? "border-emerald-300 bg-emerald-50/30 hover:border-emerald-400"
                  : "border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50/60 shadow-xs"
              }`}
            >
              <input {...getPdfInputProps()} />

              {templateFile ? (
                <div className="flex flex-col items-center justify-between h-full py-2">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs mb-2">
                    <FileText className="h-6 w-6 stroke-[2]" />
                  </div>
                  <div className="text-center px-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-semibold text-xs text-slate-900 truncate max-w-[180px]">
                        {templateFile.name}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                        PDF
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {(templateFile.size / 1024).toFixed(1)} KB • Plantilla en memoria
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <button
                      type="button"
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md shadow-2xs hover:bg-slate-50"
                    >
                      Reemplazar
                    </button>
                    <button
                      type="button"
                      onClick={handleRemovePdf}
                      className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                      title="Eliminar plantilla"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Plantilla Base PDF
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[180px] leading-tight">
                    Arrastra aquí tu diseño base (.pdf) o haz clic para buscarlo.
                  </p>
                  <span className="mt-3 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/50">
                    Exclusivo .pdf
                  </span>
                </div>
              )}
            </div>

            {/* DROPZONE 2: ARCHIVO EXCEL (.xlsx / .xls) */}
            <div
              {...getExcelRootProps()}
              className={`relative rounded-2xl border-2 border-dashed p-5 text-center transition-all duration-200 cursor-pointer ${
                isExcelDragActive
                  ? "border-blue-500 bg-blue-50/70 ring-4 ring-blue-500/10 scale-[1.01]"
                  : isExcelDragReject
                  ? "border-rose-400 bg-rose-50/50"
                  : uploadedExcelFile
                  ? "border-emerald-300 bg-emerald-50/30 hover:border-emerald-400"
                  : "border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/60 shadow-xs"
              }`}
            >
              <input {...getExcelInputProps()} />

              {uploadedExcelFile ? (
                <div className="flex flex-col items-center justify-between h-full py-2">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs mb-2">
                    <FileCheck2 className="h-6 w-6 stroke-[2]" />
                  </div>
                  <div className="text-center px-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-semibold text-xs text-slate-900 truncate max-w-[180px]">
                        {uploadedExcelFile.name}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                        Excel
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {(uploadedExcelFile.size / 1024).toFixed(1)} KB • {attendees.length} asistentes
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <button
                      type="button"
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md shadow-2xs hover:bg-slate-50"
                    >
                      Reemplazar
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveExcel}
                      className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                      title="Eliminar archivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Destinatarios Excel
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[180px] leading-tight">
                    Arrastra aquí el archivo exportado de Google Forms (.xlsx).
                  </p>
                  <span className="mt-3 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/50">
                    Formato .xlsx / .xls
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Data Table Section (Vista Previa con Columna de Enumeración #) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-600" />
                <h3 className="font-semibold text-sm text-slate-900">
                  Vista Previa de Destinatarios
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {attendees.length > 0 ? (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                    Total asistentes cargados: {attendees.length}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-500">
                    Esperando archivo
                  </span>
                )}
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    {/* COLUMNA DE NUMERACIÓN */}
                    <th scope="col" className="w-12 px-3.5 py-3.5 text-center">
                      #
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Nombre Completo
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Tipo de Identificación
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      N° Documento
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Correo Electrónico
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-center">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendees.length > 0 ? (
                    attendees.map((attendee, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Celda de Numeración (idx + 1) */}
                        <td className="w-12 px-3.5 py-3.5 text-center font-mono text-xs font-semibold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-6 py-3.5 font-medium text-slate-900">
                          {attendee.fullName}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {attendee.docType || "CC"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-slate-700 font-mono text-xs">
                          {attendee.docNumber || "N/A"}
                        </td>
                        <td className="px-6 py-3.5 text-blue-600 font-mono text-xs">
                          {attendee.email}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleViewPdf(attendee, idx)}
                            disabled={generatingIndex === idx}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800 border border-indigo-200 transition-all shadow-2xs active:scale-95 disabled:opacity-60 cursor-pointer"
                            title="Generar y previsualizar certificado en PDF"
                          >
                            {generatingIndex === idx ? (
                              <div className="h-3.5 w-3.5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 text-indigo-600" />
                            )}
                            <span>Ver PDF</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    /* Estado Vacío (Placeholder) - colSpan 6 por la nueva columna # */
                    <tr>
                      <td colSpan={6} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                            <FileSpreadsheet className="h-6 w-6 stroke-1.5" />
                          </div>
                          <h4 className="font-semibold text-slate-800 text-sm mb-1">
                            Sin datos para previsualizar
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Debes subir la plantilla base en PDF y el archivo de Excel con los destinatarios para poblar las filas.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECCIÓN DERECHA: CONFIGURACIÓN (lg:col-span-5/4)          */}
        {/* ========================================================= */}
        <section className="lg:col-span-5 xl:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sticky top-6">
            {/* Header of Configuration Card */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold">
                    2
                  </span>
                  Configuración de Envío
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Credenciales SMTP y parámetros de despacho.
                </p>
              </div>
            </div>

            {/* Form Controls */}
            <div className="space-y-5">
              {/* Tarjeta de Credenciales del Remitente */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Credenciales del Remitente
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200/60">
                    Gmail SMTP
                  </span>
                </div>

                {/* Correo Remitente */}
                <div>
                  <label
                    htmlFor="senderEmail"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Correo Remitente <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="senderEmail"
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      disabled={isSending}
                      placeholder="tu-correo@gmail.com"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Contraseña de Aplicación */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="senderPassword"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Contraseña de Aplicación <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="h-3 w-3" />
                          <span>Ocultar</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          <span>Mostrar</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="senderPassword"
                      type={showPassword ? "text" : "password"}
                      value={senderPassword}
                      onChange={(e) => setSenderPassword(e.target.value)}
                      disabled={isSending}
                      placeholder="•••• •••• •••• •••• (16 caracteres)"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono disabled:opacity-60"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Contraseña de aplicación de 16 caracteres generada en tu cuenta Google.
                  </p>
                </div>
              </div>

              {/* Asunto del Correo */}
              <div>
                <label
                  htmlFor="emailSubject"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Asunto del Correo <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="emailSubject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ej: Certificado de Acreditación Oficial"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Cuerpo del Mensaje */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="emailBody"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    Cuerpo del Mensaje <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {messageBody.length} caracteres
                  </span>
                </div>

                <textarea
                  id="emailBody"
                  rows={8}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Escribe el cuerpo del mensaje aquí..."
                  className="w-full p-3.5 bg-slate-50/60 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all resize-y leading-relaxed"
                />

                {/* Variables Helper Pills */}
                <div className="mt-2.5">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                    Insertar etiqueta dinámica:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {["[Nombre]", "tipo_doc", "documento"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (tag.startsWith("[")) {
                            setMessageBody((prev) => `${prev} ${tag}`);
                          } else {
                            insertVariable(tag);
                          }
                        }}
                        className="px-2.5 py-1 text-xs font-mono font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-md border border-slate-200 transition-colors cursor-pointer"
                      >
                        +{tag.startsWith("[") ? tag : `{{${tag}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Checks Pill */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Plantilla Base PDF:</span>
                  <span
                    className={`font-semibold ${
                      templateBuffer ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {templateBuffer ? "✓ Cargada" : "✗ Pendiente"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Destinatarios cargados:</span>
                  <span
                    className={`font-semibold ${
                      attendees.length > 0
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {attendees.length > 0
                      ? `✓ ${attendees.length} listos`
                      : "✗ Pendiente"}
                  </span>
                </div>
              </div>

              {/* Progress Status Banner during batch dispatch */}
              {isSending && progress && (
                <div className="p-3.5 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 flex items-center gap-3 animate-pulse shadow-2xs">
                  <div className="h-4 w-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin shrink-0" />
                  <div className="text-xs font-semibold">{progress}</div>
                </div>
              )}

              {/* Main Action Button */}
              <button
                type="button"
                onClick={handleGenerateAndSend}
                disabled={isSending || !templateBuffer || attendees.length === 0}
                className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-semibold text-sm text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 ${
                  isSending
                    ? "bg-indigo-400 cursor-not-allowed"
                    : !templateBuffer || attendees.length === 0
                    ? "bg-slate-300 text-slate-500 shadow-none cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:via-indigo-700 hover:to-indigo-800 active:scale-[0.99] hover:shadow-indigo-600/35 cursor-pointer"
                }`}
              >
                {isSending ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{progress || "Enviando certificados..."}</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Generar y Enviar Certificados</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

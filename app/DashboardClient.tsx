"use client";

import React, { useState, useCallback, useMemo } from "react";
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
  Archive,
  Globe,
  Laptop,
  SlidersHorizontal,
  X,
  Sparkles,
  Check,
} from "lucide-react";
import {
  generateCertificate,
  generateCertificateBase64,
  Attendee,
} from "@/utils/pdfGenerator";
import {
  exportLocalZipPackage,
  triggerBrowserDownload,
} from "@/utils/localZipExporter";
import {
  ColumnMappingConfig,
  inferInitialColumnMapping,
  transformRowsToAttendees,
} from "@/utils/excelNormalizer";
import { supabase } from "@/lib/supabaseClient";
import { useSettings } from "@/context/SettingsContext";
import { useAuth } from "@/context/AuthContext";

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
  const { user } = useAuth();

  // States for Dynamic PDF Template
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);

  // States for Dispatch Mode (Hybrid: Cloud SMTP vs Local Outlook)
  const [dispatchMode, setDispatchMode] = useState<"cloud" | "local">("cloud");

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
  const [rawExcelRows, setRawExcelRows] = useState<unknown[][]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [mappingConfig, setMappingConfig] = useState<ColumnMappingConfig | null>(null);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState<boolean>(false);
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

  // 2. Manejador de carga de archivo Excel / CSV (Ingesta Cruda)
  const onDropExcel = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploadedExcelFile(file);
    setNotification(null);

    const reader = new FileReader();

    reader.onerror = () => {
      setAttendees([]);
      setRawExcelRows([]);
      setExcelHeaders([]);
      setMappingConfig(null);
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
            "El archivo subido no contiene ninguna hoja de cálculo válida."
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
            "El archivo está vacío o no contiene filas de datos suficientes (se requiere cabecera y al menos un registro)."
          );
        }

        // Extraer encabezados de la primera fila
        const headerRow = (rows[0] as unknown[])
          .map((cell) =>
            typeof cell === "string" ? cell.trim() : String(cell || "").trim()
          )
          .filter((cell) => cell.length > 0);

        if (headerRow.length === 0) {
          throw new Error("No se detectaron encabezados válidos en la primera fila.");
        }

        // Inferencia heurística inicial del mapeo
        const initialMapping = inferInitialColumnMapping(headerRow);

        setRawExcelRows(rows);
        setExcelHeaders(headerRow);
        setMappingConfig(initialMapping);
        setIsMappingModalOpen(true);

        setNotification({
          type: "warning",
          message: `Archivo cargado (${rows.length - 1} filas detectadas). Revisa y confirma el mapeo de columnas para procesar los asistentes.`,
        });
      } catch (err: unknown) {
        console.error("Error al procesar archivo:", err);
        setUploadedExcelFile(null);
        setAttendees([]);
        setRawExcelRows([]);
        setExcelHeaders([]);
        setMappingConfig(null);
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Error inesperado al procesar el archivo. Verifica el formato.";
        setNotification({
          type: "error",
          message: errorMsg,
        });
      }
    };

    reader.readAsArrayBuffer(file);
  }, []);

  // Previsualización en tiempo real de las primeras 3 filas para el Modal de Mapeo
  const previewAttendees = useMemo(() => {
    if (!mappingConfig || rawExcelRows.length < 2) return [];
    return transformRowsToAttendees(rawExcelRows, excelHeaders, mappingConfig, 3);
  }, [rawExcelRows, excelHeaders, mappingConfig]);

  // Aplicar el mapeo seleccionado y generar los attendees normalizados
  const handleApplyMapping = () => {
    if (!mappingConfig || rawExcelRows.length < 2) return;

    if (mappingConfig.nameMode === "single" && !mappingConfig.fullNameCol) {
      alert("Por favor, selecciona la columna de 'Nombres y Apellidos'.");
      return;
    }

    if (
      mappingConfig.nameMode === "split" &&
      (!mappingConfig.firstNameCol || !mappingConfig.lastNameCol)
    ) {
      alert("Por favor, selecciona las columnas de 'Nombres' y 'Apellidos'.");
      return;
    }

    if (!mappingConfig.emailCol) {
      alert("Por favor, selecciona la columna de 'Correo Electrónico'.");
      return;
    }

    const cleaned = transformRowsToAttendees(rawExcelRows, excelHeaders, mappingConfig);

    if (cleaned.length === 0) {
      alert(
        "No se encontraron asistentes válidos con el mapeo seleccionado. Verifica que las columnas no estén vacías."
      );
      return;
    }

    setAttendees(cleaned);
    setIsMappingModalOpen(false);
    setNotification({
      type: "success",
      message: `¡Mapeo dinámico aplicado! Se procesaron ${cleaned.length} asistentes con nombres normalizados en MAYÚSCULAS y correos limpios.`,
    });
  };

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
      "text/csv": [".csv"],
    },
    multiple: false,
  });

  const handleRemoveExcel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedExcelFile(null);
    setRawExcelRows([]);
    setExcelHeaders([]);
    setMappingConfig(null);
    setAttendees([]);
    setNotification(null);
    setIsMappingModalOpen(false);
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

  // Manejador del botón "Generar y Enviar Certificados" (Híbrido: Nube SMTP o Local ZIP)
  const handleGenerateAndSend = async () => {
    if (!templateBuffer) {
      setNotification({
        type: "error",
        message:
          "Debes subir la Plantilla Base en formato PDF (.pdf) antes de generar los certificados.",
      });
      return;
    }

    if (!uploadedExcelFile || attendees.length === 0) {
      setNotification({
        type: "error",
        message:
          "Debes subir un archivo Excel (.xlsx) con asistentes válidos antes de iniciar el proceso.",
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

    // --- FLUJO LOCAL (Generación de ZIP para Outlook Desktop) ---
    if (dispatchMode === "local") {
      setIsSending(true);
      setNotification(null);
      setProgress(`Iniciando empaquetado de certificados para ${attendees.length} asistentes...`);

      try {
        const { blob, filename } = await exportLocalZipPackage({
          attendees,
          templateBuffer,
          settings,
          subject: subject.trim(),
          messageBody,
          personalizeMessage,
          onProgress: (current, total, name) => {
            setProgress(`Empaquetando diploma ${current} de ${total} (${name})...`);
          },
        });

        // Disparar descarga en el navegador
        triggerBrowserDownload(blob, filename);

        // Registro de auditoría institucional (sent_certificates)
        if (user?.id) {
          try {
            const records = attendees.map((a) => ({
              recipient_name: a.fullName,
              recipient_email: a.email,
              doc_type: a.docType || "CC",
              doc_number: a.docNumber || "N/A",
              sender_email: user.email || "despacho_local_outlook",
              user_id: user.id,
            }));
            await supabase.from("sent_certificates").insert(records);
          } catch (logErr) {
            console.warn("No se pudo registrar bitácora local:", logErr);
          }
        }

        setNotification({
          type: "success",
          message: `¡Paquete '${filename}' generado y descargado con éxito! Descomprime el archivo y ejecuta certisender_outlook.exe para despachar automáticamente desde tu Outlook institucional.`,
        });
      } catch (err: unknown) {
        console.error("Error al generar paquete ZIP:", err);
        const msg = err instanceof Error ? err.message : "Error al procesar el archivo ZIP.";
        setNotification({
          type: "error",
          message: `Ocurrió un error al generar el paquete ZIP: ${msg}`,
        });
      } finally {
        setIsSending(false);
        setProgress("");
      }
      return;
    }

    // --- FLUJO NUBE (Despacho directo vía SMTP) ---
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
            user_id: user?.id || null,
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMappingModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md shadow-2xs hover:bg-indigo-100 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Ajustar correspondencia de columnas"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Mapear Columnas</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveExcel}
                      className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
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
                    Destinatarios Excel / CSV
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[190px] leading-tight">
                    Arrastra aquí tu archivo Excel (.xlsx / .xls) o CSV con cualquier estructura.
                  </p>
                  <span className="mt-3 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/50">
                    Formato .xlsx / .xls / .csv
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
                {uploadedExcelFile && (
                  <button
                    type="button"
                    onClick={() => setIsMappingModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded-xl shadow-2xs hover:bg-indigo-100 transition-colors cursor-pointer"
                    title="Reconfigurar la asociación de columnas del archivo actual"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Reconfigurar Columnas</span>
                  </button>
                )}

                {attendees.length > 0 ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    Total asistentes cargados: {attendees.length}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-500">
                    {uploadedExcelFile ? "Pendiente de confirmación" : "Esperando archivo"}
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
                            {uploadedExcelFile
                              ? "Asignación de columnas pendiente"
                              : "Sin datos para previsualizar"}
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed mb-3">
                            {uploadedExcelFile
                              ? "Has cargado un archivo pero aún no has confirmado el mapeo de columnas para procesar los datos."
                              : "Debes subir la plantilla base en PDF y el archivo de Excel/CSV con los destinatarios para poblar las filas."}
                          </p>
                          {uploadedExcelFile && (
                            <button
                              type="button"
                              onClick={() => setIsMappingModalOpen(true)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs cursor-pointer active:scale-95"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                              <span>Configurar Mapeo de Columnas</span>
                            </button>
                          )}
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
              {/* Selector de Vía de Despacho (Híbrido) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Método de Despacho
                </label>
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setDispatchMode("cloud")}
                    className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      dispatchMode === "cloud"
                        ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>Nube (SMTP)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchMode("local")}
                    className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      dispatchMode === "local"
                        ? "bg-white text-indigo-700 shadow-xs border border-slate-200/60"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Laptop className="h-3.5 w-3.5" />
                    <span>Local (Outlook)</span>
                  </button>
                </div>
              </div>

              {/* Si es Modo Local: Tarjeta Informativa Outlook */}
              {dispatchMode === "local" ? (
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-indigo-900">
                    <Laptop className="h-4 w-4 text-indigo-600" />
                    <span>Vía Local para Microsoft Outlook</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed">
                    No necesitas contraseñas de aplicación ni configurar SMTP. Al procesar, se descargará un archivo <strong>.ZIP</strong> con todos los diplomas en PDF, el archivo <code>relacion.csv</code> y el ejecutable precompilado <code>certisender_outlook.exe</code>.
                  </p>
                </div>
              ) : (
                /* Si es Modo Nube: Tarjeta de Credenciales del Remitente */
                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-indigo-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Credenciales del Remitente
                      </h3>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200/60">
                      Gmail / Microsoft 365
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
                        placeholder="tu-correo@unisinu.edu.co"
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
                      Enrutamiento inteligente: Gmail (465 SSL) o Microsoft 365 (587 STARTTLS).
                    </p>
                  </div>
                </div>
              )}

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
                    <span>{progress || "Procesando certificados..."}</span>
                  </>
                ) : dispatchMode === "local" ? (
                  <>
                    <Archive className="h-4 w-4" />
                    <span>Generar y Descargar Paquete ZIP</span>
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

      {/* MODAL DE MAPEO DINÁMICO DE COLUMNAS */}
      {isMappingModalOpen && mappingConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Encabezado del Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Mapeo Dinámico de Columnas
                  </h3>
                  <p className="text-xs text-slate-500">
                    {uploadedExcelFile?.name || "Archivo de destinatarios"} •{" "}
                    {rawExcelRows.length > 1 ? rawExcelRows.length - 1 : 0} filas detectadas
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMappingModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Contenido del Formulario de Mapeo */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* SECCIÓN 1: NOMBRE DEL ASISTENTE + TOGGLE DE NOMBRES SEPARADOS */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Nombre del Asistente *
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Define si el nombre y apellido están en una columna o separados
                    </p>
                  </div>

                  {/* Switch Toggle: Columna Única vs Nombres Separados */}
                  <button
                    type="button"
                    onClick={() => {
                      setMappingConfig((prev) => {
                        if (!prev) return prev;
                        const newMode = prev.nameMode === "single" ? "split" : "single";
                        return { ...prev, nameMode: newMode };
                      });
                    }}
                    className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer self-start sm:self-auto ${
                      mappingConfig.nameMode === "split"
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-[11px]">
                      {mappingConfig.nameMode === "split"
                        ? "Nombres separados (2 columnas)"
                        : "Nombre completo (1 columna)"}
                    </span>
                    <div
                      className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 ${
                        mappingConfig.nameMode === "split"
                          ? "bg-indigo-600"
                          : "bg-slate-300"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                          mappingConfig.nameMode === "split"
                            ? "translate-x-3.5"
                            : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                </div>

                {/* Renderizado Condicional del Switch */}
                {mappingConfig.nameMode === "single" ? (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Columna de Nombres y Apellidos Completos *
                    </label>
                    <select
                      value={mappingConfig.fullNameCol}
                      onChange={(e) =>
                        setMappingConfig((prev) =>
                          prev ? { ...prev, fullNameCol: e.target.value } : prev
                        )
                      }
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                    >
                      {excelHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Se convertirá automáticamente a MAYÚSCULAS absolutas y se normalizarán espacios.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Columna de Nombres *
                        </label>
                        <select
                          value={mappingConfig.firstNameCol}
                          onChange={(e) =>
                            setMappingConfig((prev) =>
                              prev ? { ...prev, firstNameCol: e.target.value } : prev
                            )
                          }
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                        >
                          {excelHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Columna de Apellidos *
                        </label>
                        <select
                          value={mappingConfig.lastNameCol}
                          onChange={(e) =>
                            setMappingConfig((prev) =>
                              prev ? { ...prev, lastNameCol: e.target.value } : prev
                            )
                          }
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                        >
                          {excelHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-[10px] text-indigo-700 font-semibold bg-indigo-50/80 px-3 py-1.5 rounded-lg border border-indigo-200/50">
                      ℹ️ CertiSender concatenará [Nombres] + [Apellidos] con un espacio y aplicará MAYÚSCULAS uniformes.
                    </p>
                  </div>
                )}
              </div>

              {/* SECCIÓN 2: CORREO ELECTRÓNICO */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Correo Electrónico *
                </label>
                <select
                  value={mappingConfig.emailCol}
                  onChange={(e) =>
                    setMappingConfig((prev) =>
                      prev ? { ...prev, emailCol: e.target.value } : prev
                    )
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                >
                  {excelHeaders.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  Se convertirá a minúsculas absolutas y se removerán espacios en blanco al inicio, final e internos.
                </p>
              </div>

              {/* SECCIÓN 3: DOCUMENTO DE IDENTIDAD */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Documento de Identificación (Opcional)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Utilizado para la numeración oficial en el diploma y el nombre del archivo PDF
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      Columna de N° de Documento
                    </label>
                    <select
                      value={mappingConfig.docNumberCol}
                      onChange={(e) =>
                        setMappingConfig((prev) =>
                          prev ? { ...prev, docNumberCol: e.target.value } : prev
                        )
                      }
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                    >
                      <option value="">(Ninguna / Asignar N/A)</option>
                      {excelHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      Columna de Tipo de Documento
                    </label>
                    <select
                      value={mappingConfig.docTypeCol}
                      onChange={(e) =>
                        setMappingConfig((prev) =>
                          prev ? { ...prev, docTypeCol: e.target.value } : prev
                        )
                      }
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                    >
                      <option value="">(Fijo por defecto: CC)</option>
                      {excelHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 4: PREVISUALIZACIÓN EN VIVO (LIVE PREVIEW) */}
              <div className="rounded-2xl border border-indigo-200/90 bg-indigo-50/40 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    Previsualización en Vivo de la Normalización (Primeras 3 filas)
                  </span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-md">
                    En tiempo real
                  </span>
                </div>

                <div className="overflow-x-auto bg-white rounded-xl border border-indigo-100 shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-center w-8">#</th>
                        <th className="px-3 py-2">Nombre Completo (MAYÚSCULAS)</th>
                        <th className="px-3 py-2">Correo (minúsculas)</th>
                        <th className="px-3 py-2">Documento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewAttendees.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-4 text-center text-slate-400 text-xs"
                          >
                            Selecciona las columnas arriba para previsualizar los datos normalizados.
                          </td>
                        </tr>
                      ) : (
                        previewAttendees.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 font-mono text-[11px]">
                            <td className="px-3 py-2 text-center font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2 font-sans font-bold text-slate-900">
                              {item.fullName}
                            </td>
                            <td className="px-3 py-2 text-indigo-600">
                              {item.email}
                            </td>
                            <td className="px-3 py-2 font-sans text-slate-600">
                              {item.docType}. {item.docNumber}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsMappingModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cerrar sin guardar
              </button>

              <button
                type="button"
                onClick={handleApplyMapping}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-[0.99]"
              >
                <Check className="h-4 w-4" />
                <span>Confirmar y Procesar Destinatarios</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

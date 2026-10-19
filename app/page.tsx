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
  Users,
  Sparkles,
  ShieldCheck,
  HelpCircle,
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>("");
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Manejador para previsualizar el certificado PDF de una fila
  const handleViewPdf = async (attendee: Attendee, index: number) => {
    try {
      setGeneratingIndex(index);
      const pdfBlob = await generateCertificate(attendee);
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

  // Handle Drag & Drop with SheetJS (xlsx) Parsing & Cleaning
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploadedFile(file);
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

        // Read Excel binary/array buffer
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new Error(
            "El archivo Excel subido no contiene ninguna hoja de cálculo válida."
          );
        }

        const worksheet = workbook.Sheets[firstSheetName];

        // Convert worksheet to array of arrays to flexibly inspect header row
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

        // Process Header Row
        const headerRow = (rows[0] as unknown[]).map((cell) =>
          typeof cell === "string" ? cell.trim() : String(cell || "").trim()
        );

        // 1. Column: "Nombres y apellidos"
        const fullNameIdx = headerRow.findIndex((h) => {
          const n = normalizeHeader(h);
          return (
            n === "nombresyapellidos" ||
            n === "nombreyapellido" ||
            n === "nombresyapellido" ||
            (n.includes("nombre") && (n.includes("apellido") || n.includes("completo")))
          );
        });

        // 2. Column: "Tipo de identificación"
        const docTypeIdx = headerRow.findIndex((h) => {
          const n = normalizeHeader(h);
          return (
            n === "tipodeidentificacion" ||
            n === "tipodeidentificacin" ||
            n === "tipodocumento" ||
            (n.includes("tipo") && (n.includes("identifica") || n.includes("documento")))
          );
        });

        // 3. Column: "N° de identificación"
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

        // 4. Column: "Correo Electrónico2" (Prioritize "Correo Electrónico2", fallback to general email)
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

        // Validate required columns
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

        // Extract and clean data: filter out rows without fullName or email
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

          // Must have at least full name and email
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
          message: `¡Archivo procesado con éxito! Se cargaron y limpiaron ${cleanedAttendees.length} asistentes listos para recibir su certificado.`,
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

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
          ".xlsx",
        ],
        "application/vnd.ms-excel": [".xls"],
      },
      multiple: false,
    });

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedFile(null);
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

  // Manejador del botón "Generar y Enviar Certificados" con envío secuencial
  const handleGenerateAndSend = async () => {
    if (!uploadedFile || attendees.length === 0) {
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

    // Iteración secuencial con for...of y await para respetar límites del servidor y SMTP
    for (const attendee of attendees) {
      currentIndex++;
      setProgress(
        `Enviando ${currentIndex} de ${attendees.length} (${attendee.fullName})...`
      );

      try {
        // 1. Generar el PDF en Base64 para el asistente actual
        const pdfBase64 = await generateCertificateBase64(attendee);

        // 2. Personalizar el cuerpo del mensaje reemplazando [Nombre] y variables
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

        // Si el fallo es por autenticación SMTP inválida, detenemos el bucle
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <FileSpreadsheet className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  CertiSender
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  v1.0 Pro
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Plataforma de Generación y Envío Automatizado de Certificados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/80 py-1.5 px-3 rounded-lg border border-slate-200/60">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Conexión Segura SSL</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sistema Operativo</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container with CSS Grid Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors ml-2"
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
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 text-blue-700 text-xs font-bold">
                    1
                  </span>
                  Zona de Trabajo y Datos
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Carga el archivo Excel exportado de Google Forms para extraer
                  automáticamente los asistentes.
                </p>
              </div>

              {attendees.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Archivo procesado
                </span>
              )}
            </div>

            {/* Dropzone Area */}
            <div
              {...getRootProps()}
              className={`relative overflow-hidden cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                isDragActive
                  ? "border-blue-500 bg-blue-50/70 ring-4 ring-blue-500/10 scale-[1.008]"
                  : isDragReject
                  ? "border-rose-400 bg-rose-50/50"
                  : uploadedFile
                  ? "border-emerald-300 bg-emerald-50/20 hover:border-emerald-400 hover:bg-emerald-50/30"
                  : "border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/60 shadow-xs"
              }`}
            >
              <input {...getInputProps()} />

              {uploadedFile ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
                      <FileCheck2 className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-base">
                          {uploadedFile.name}
                        </span>
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-md">
                          Cargado
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {(uploadedFile.size / 1024).toFixed(1)} KB • {attendees.length} asistentes válidos detectados
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
                    >
                      Reemplazar
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Eliminar archivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200 ${
                      isDragActive
                        ? "bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/30"
                        : "bg-blue-50 text-blue-600 group-hover:scale-105"
                    }`}
                  >
                    <UploadCloud className="h-7 w-7" />
                  </div>

                  <p className="text-base font-semibold text-slate-800">
                    {isDragActive
                      ? "¡Suelta el archivo Excel aquí!"
                      : "Arrastra y suelta tu archivo Excel (.xlsx) aquí"}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    o haz clic para buscar en tus archivos
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-slate-600" />
                    <span>Compatible con exportaciones de Google Forms (.xlsx / .xls)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Contador destacado encima de la tabla si hay asistentes cargados */}
            {attendees.length > 0 && (
              <div className="flex items-center justify-between p-3.5 bg-blue-50/80 border border-blue-200/90 rounded-xl text-blue-900 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-blue-700">Estado de extracción:</span>
                    <p className="text-sm font-bold text-blue-900">
                      Total asistentes cargados: {attendees.length}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-white rounded-md border border-blue-200 text-blue-800 shadow-2xs">
                  Listo para despacho
                </span>
              </div>
            )}

            {/* Data Table Section (Vista Previa) */}
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
                      /* Estado Vacío (Placeholder) */
                      <tr>
                        <td colSpan={5} className="px-6 py-14 text-center">
                          <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                              <FileSpreadsheet className="h-6 w-6 stroke-1.5" />
                            </div>
                            <h4 className="font-semibold text-slate-800 text-sm mb-1">
                              Sin datos para previsualizar
                            </h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Debes subir el archivo original de Excel (.xlsx) en
                              la zona superior para poblar automáticamente las
                              columnas y verificar los datos.
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
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sticky top-24">
              {/* Header of Configuration Card */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold">
                      2
                    </span>
                    Configuración de Envío
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Personaliza el contenido del correo y los parámetros de
                    despacho.
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
                          className="px-2.5 py-1 text-xs font-mono font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-md border border-slate-200 transition-colors"
                        >
                          +{tag.startsWith("[") ? tag : `{{${tag}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Information Tip Box */}
                <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-900 leading-relaxed">
                  <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p>
                    Cada participante recibirá de manera automatizada su
                    certificado en formato <strong>PDF</strong> adjunto y
                    personalizado con sus credenciales.
                  </p>
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
                  disabled={isSending}
                  className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-semibold text-sm text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 ${
                    isSending
                      ? "bg-indigo-400 cursor-not-allowed"
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

              {/* Footer details inside right panel */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Destinatarios listos: {attendees.length}
                </span>
                <span>Prioridad: Alta</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

// Inicializar cliente Supabase con variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

interface SmtpTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS?: boolean;
  tls?: {
    ciphers?: string;
    minVersion?: string;
    rejectUnauthorized?: boolean;
  };
}

// Resuelve dinámicamente la configuración SMTP según el dominio del correo remitente
export function resolveSmtpConfig(email: string): SmtpTransportConfig {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Detección de Proveedor Google / Gmail
  if (
    cleanEmail.endsWith("@gmail.com") ||
    cleanEmail.endsWith("@googlemail.com")
  ) {
    return {
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // SSL directo
    };
  }

  // 2. Detección de Microsoft 365, Outlook, Hotmail o Correo Institucional Unisinú
  if (
    cleanEmail.endsWith("@unisinu.edu.co") ||
    cleanEmail.endsWith("@outlook.com") ||
    cleanEmail.endsWith("@hotmail.com") ||
    cleanEmail.endsWith("@live.com") ||
    cleanEmail.includes("microsoft") ||
    cleanEmail.includes("office365")
  ) {
    return {
      host: "smtp.office365.com",
      port: 587,
      secure: false, // Negocia STARTTLS en puerto 587
      requireTLS: true,
      tls: {
        ciphers: "SSLv3",
        minVersion: "TLSv1.2",
      },
    };
  }

  // 3. Fallback corporativo estándar (Puerto 587 con STARTTLS)
  return {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    requireTLS: true,
    tls: {
      minVersion: "TLSv1.2",
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const bodyJson = await req.json();
    const {
      to,
      subject,
      body,
      pdfBase64,
      senderEmail,
      senderPassword,
      recipient_name,
      recipientName,
      doc_type,
      docType,
      doc_number,
      docNumber,
      user_id,
      userId,
    } = bodyJson;

    const currentUserId = user_id || userId || null;

    // 1. Validación de campos obligatorios para despacho
    if (!to || !subject || !body || !pdfBase64) {
      return NextResponse.json(
        {
          error:
            "Faltan campos obligatorios. Se requiere 'to', 'subject', 'body' y 'pdfBase64'.",
        },
        { status: 400 }
      );
    }

    // 2. Validación de credenciales del remitente recibidas desde el frontend
    if (!senderEmail || !senderPassword) {
      return NextResponse.json(
        {
          error:
            "Faltan las credenciales del remitente. Por favor ingresa el correo remitente y la contraseña de aplicación en el panel.",
        },
        { status: 400 }
      );
    }

    // Extracción normalizada de datos del participante para el log
    const participantName =
      (recipient_name || recipientName || "").trim();
    const documentType = (doc_type || docType || "CC").trim();
    const documentNumber = (doc_number || docNumber || "N/A").trim();

    // 3. Configuración del transporte Nodemailer dinámico con credenciales y enrutamiento inteligente
    const smtpConfig = resolveSmtpConfig(senderEmail);
    const transporter = nodemailer.createTransport({
      ...smtpConfig,
      auth: {
        user: senderEmail.trim(),
        pass: senderPassword.trim(),
      },
    } as Parameters<typeof nodemailer.createTransport>[0]);

    // Formatear cuerpo del mensaje para texto plano y HTML
    const htmlBody = body.replace(/\n/g, "<br>");

    // 4. Envío del correo con el PDF adjunto
    const info = await transporter.sendMail({
      from: `"CertiSender" <${senderEmail.trim()}>`,
      to,
      subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">${htmlBody}</div>`,
      attachments: [
        {
          filename: "Certificado_Asistencia.pdf",
          content: Buffer.from(pdfBase64, "base64"),
          contentType: "application/pdf",
        },
      ],
    });

    // 5. Registro en Base de Datos Supabase (sent_certificates) tras despacho exitoso
    if (supabase) {
      try {
        const { error: dbError } = await supabase
          .from("sent_certificates")
          .insert([
            {
              recipient_name: participantName,
              recipient_email: to,
              doc_type: documentType,
              doc_number: documentNumber,
              sender_email: senderEmail.trim(),
              user_id: currentUserId,
            },
          ]);

        if (dbError) {
          console.error(
            "Error al registrar certificado en Supabase (sent_certificates):",
            dbError
          );
        }
      } catch (dbErr: unknown) {
        console.error("Excepción inesperada al insertar en Supabase:", dbErr);
      }
    } else {
      console.warn(
        "Supabase no está inicializado. Verifica NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en tus variables de entorno."
      );
    }

    // Retorna HTTP 200 prioritario si el correo se despachó exitosamente
    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      recipient: to,
    });
  } catch (error: unknown) {
    console.error("Error al enviar correo:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Error interno al despachar el correo electrónico.";

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

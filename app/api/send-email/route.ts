import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, pdfBase64, senderEmail, senderPassword } =
      await req.json();

    // 1. Validación de campos obligatorios
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

    // 3. Configuración del transporte Nodemailer dinámico con credenciales del usuario
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // puerto 465 SSL estándar
      auth: {
        user: senderEmail.trim(),
        pass: senderPassword.trim(),
      },
    });

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

import nodemailer from "nodemailer";

export async function enviarEmail({ to, subject, html }) {
  try {
    if (!process.env.SMTP_HOST) {
      throw new Error("SMTP_HOST não configurado");
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false, // true só se for 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    });

    console.log("📧 Email enviado:", info.messageId);
    return info;

  } catch (err) {
    console.error("❌ ERRO AO ENVIAR EMAIL:", err);
    throw err;
  }
}

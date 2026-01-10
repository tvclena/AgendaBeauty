import nodemailer from "nodemailer";

export async function enviarEmail({ to, subject, html }) {

  if (!to) {
    console.warn("⚠️ Email não enviado: destinatário vazio");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html
  });
}

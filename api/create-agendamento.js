import { createClient } from "@supabase/supabase-js";
import { enviarEmail } from "../lib/email.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {

  // 🔓 CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    const {
      loja_id,
      servico_id,
      servico_nome,
      valor_servico,
      data,
      hora_inicio,
      hora_fim,
      cliente_nome,
      cliente_whatsapp,
      cliente_email,
      cliente_id
    } = body;

    if (!loja_id || !servico_id || !data || !hora_inicio || !cliente_nome) {
      return res.status(400).json({
        error: "Payload incompleto",
        received: body
      });
    }

    // 1️⃣ SALVA AGENDAMENTO (ISSO NÃO PODE FALHAR)
    const { error: insertError } = await supabase
      .from("agendamentos")
      .insert({
        user_id: loja_id,
        loja_id,
        servico_id,
        valor_servico,
        data,
        hora_inicio,
        hora_fim,
        cliente_nome,
        cliente_whatsapp,
        cliente_id
      });

    if (insertError) {
      console.error("❌ ERRO INSERT:", insertError);
      return res.status(500).json({
        error: "Erro ao salvar agendamento",
        details: insertError.message
      });
    }

    // 2️⃣ BUSCA EMAIL DA LOJA
    const { data: loja } = await supabase
      .from("user_profile")
      .select("email, negocio")
      .eq("user_id", loja_id)
      .single();

    // 3️⃣ EMAIL (SE FALHAR, NÃO QUEBRA)
    if (loja?.email) {
      try {
        await enviarEmail({
          to: loja.email,
          subject: "📅 Novo agendamento realizado",
          html: `
            <h2>Novo agendamento</h2>
            <p><strong>Loja:</strong> ${loja.negocio || "Loja"}</p>
            <p><strong>Cliente:</strong> ${cliente_nome}</p>
            <p><strong>WhatsApp:</strong> ${cliente_whatsapp}</p>
            <p><strong>Serviço:</strong> ${servico_nome}</p>
            <p><strong>Data:</strong> ${data}</p>
            <p><strong>Horário:</strong> ${hora_inicio} - ${hora_fim}</p>
          `
        });
      } catch (emailErr) {
        console.warn("⚠️ Email não enviado:", emailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Agendamento criado com sucesso"
    });

  } catch (err) {
    console.error("🔥 ERRO GERAL API:", err);
    return res.status(500).json({
      error: "Erro interno no servidor",
      details: err.message
    });
  }
}

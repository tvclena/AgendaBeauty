import { createClient } from "@supabase/supabase-js";
import { enviarEmail } from "../../lib/email.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {

  /* ================= CORS ================= */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      stage: "method",
      error: "Método não permitido"
    });
  }

  try {
    /* ================= BODY ================= */
    let body;
    try {
      body = typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;
    } catch (e) {
      return res.status(400).json({
        stage: "body",
        error: "JSON inválido no body",
        detail: e.message
      });
    }

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
    } = body || {};

    /* ================= VALIDAÇÕES ================= */
    if (!loja_id || !data || !hora_inicio || !hora_fim || !cliente_nome || !cliente_whatsapp) {
      return res.status(400).json({
        stage: "validation",
        error: "Campos obrigatórios ausentes",
        received: {
          loja_id,
          data,
          hora_inicio,
          hora_fim,
          cliente_nome,
          cliente_whatsapp
        }
      });
    }

    /* ================= SALVAR AGENDAMENTO ================= */
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
      console.error("❌ ERRO SUPABASE INSERT:", insertError);
      return res.status(500).json({
        stage: "database_insert",
        error: "Erro ao salvar agendamento",
        detail: insertError.message
      });
    }

    /* ================= BUSCAR LOJA ================= */
    const { data: loja, error: lojaError } = await supabase
      .from("user_profile")
      .select("email, negocio")
      .eq("user_id", loja_id)
      .single();

    if (lojaError) {
      console.warn("⚠️ Loja não encontrada para email:", lojaError.message);
    }

    /* ================= EMAIL (NÃO BLOQUEANTE) ================= */
    if (loja?.email) {
      try {
        await enviarEmail({
          to: loja.email,
          subject: "📅 Novo agendamento realizado",
          html: `
            <h2>Novo agendamento</h2>
            <p><strong>Loja:</strong> ${loja.negocio || "Não informado"}</p>
            <p><strong>Cliente:</strong> ${cliente_nome}</p>
            <p><strong>WhatsApp:</strong> ${cliente_whatsapp}</p>
            <p><strong>Serviço:</strong> ${servico_nome || "-"}</p>
            <p><strong>Data:</strong> ${data}</p>
            <p><strong>Horário:</strong> ${hora_inicio} - ${hora_fim}</p>
          `
        });
      } catch (emailError) {
        console.error("⚠️ ERRO AO ENVIAR EMAIL:", {
          message: emailError.message,
          stack: emailError.stack
        });
        // ⚠️ NÃO retorna erro — agendamento já foi salvo
      }
    }

    /* ================= SUCESSO ================= */
    return res.status(200).json({
      success: true,
      message: "Agendamento criado com sucesso"
    });

  } catch (err) {
    console.error("🔥 ERRO GERAL CREATE-AGENDAMENTO:", err);
    return res.status(500).json({
      stage: "unexpected",
      error: "Erro inesperado no servidor",
      detail: err.message
    });
  }
}

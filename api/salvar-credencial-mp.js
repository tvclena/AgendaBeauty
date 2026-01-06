import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { loja_id, mp_access_token } = req.body;

    if (!loja_id || !mp_access_token) {
      return res.status(400).json({ error: "Payload inválido" });
    }

    if (!mp_access_token.startsWith("APP_USR-")) {
      return res.status(400).json({ error: "Token Mercado Pago inválido" });
    }

    /* 1️⃣ SALVA OU ATUALIZA CREDENCIAL */
    await supabase
      .from("lojas_pagamento_credenciais")
      .upsert({
        user_id: loja_id,
        mp_access_token,
        ativo: true
      });

    /* 2️⃣ ATIVA FLAG DA LOJA */
    await supabase
      .from("user_profile")
      .update({ pagamento_online_ativo: true })
      .eq("user_id", loja_id);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("ERRO SALVAR MP:", err);
    return res.status(500).json({
      error: "Erro interno ao salvar credencial"
    });
  }
}

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
      return res.status(400).json({ error: "Dados incompletos" });
    }

    /* 🔐 valida token MP produção */
    if (!mp_access_token.startsWith("APP_USR-")) {
      return res.status(400).json({
        error: "Use apenas Access Token de PRODUÇÃO"
      });
    }

    /* ❌ bloqueia duplicidade */
    const { data: existente } = await supabase
      .from("lojas_pagamento_credenciais")
      .select("id")
      .eq("user_id", loja_id)
      .single();

    if (existente) {
      return res.status(409).json({
        error: "Esta loja já possui integração ativa"
      });
    }

    /* 1️⃣ salva credencial */
    await supabase
      .from("lojas_pagamento_credenciais")
      .insert({
        user_id: loja_id,
        mp_access_token,
        ativo: true
      });

    /* 2️⃣ ativa flag da loja */
    await supabase
      .from("user_profile")
      .update({ pagamento_online_ativo: true })
      .eq("user_id", loja_id);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao salvar credencial" });
  }
}

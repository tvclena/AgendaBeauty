import { createClient } from "@supabase/supabase-js";
import MercadoPago from "mercadopago";
import crypto from "crypto";

/* SUPABASE (pode ser anon ou service, tanto faz agora) */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { loja_id, cliente, itens } = body;

    if (
      !loja_id ||
      !cliente?.nome ||
      !cliente?.whatsapp ||
      !Array.isArray(itens) ||
      itens.length === 0
    ) {
      return res.status(400).json({ error: "Payload inválido" });
    }

    /* 1. CONFIRMA LOJA (USER_PROFILE) */
    const { data: loja } = await supabase
      .from("user_profile")
      .select("user_id")
      .eq("user_id", loja_id)
      .single();

    if (!loja) {
      return res.status(400).json({ error: "Loja inválida" });
    }

    /* 2. CREDENCIAL MP */
    const { data: cred } = await supabase
      .from("lojas_pagamento_credenciais")
      .select("mp_access_token")
      .eq("user_id", loja.user_id)
      .eq("ativo", true)
      .single();

    if (!cred?.mp_access_token) {
      return res
        .status(400)
        .json({ error: "Pagamento online não configurado" });
    }

    /* 3. PRODUTOS */
    const produtoIds = itens.map(i => i.id);

    const { data: produtos } = await supabase
      .from("produtos_servicos")
      .select("id, nome, preco")
      .in("id", produtoIds)
      .eq("user_id", loja.user_id)
      .eq("pg_online", true)
      .eq("ativo", true);

    if (!produtos || produtos.length !== itens.length) {
      return res.status(400).json({ error: "Itens inválidos" });
    }

    const mpItems = produtos.map(p => {
      const item = itens.find(i => i.id === p.id);
      const qtd = Number(item.quantidade || 1);
      const preco = Number(String(p.preco).replace(",", "."));

      return {
        title: p.nome,
        quantity: qtd,
        unit_price: preco,
        currency_id: "BRL"
      };
    });

    const valorTotal = mpItems.reduce(
      (t, i) => t + i.unit_price * i.quantity,
      0
    );

    /* 4. REFERÊNCIA */
    const referencia = crypto.randomUUID();

    /* 5. INSERT PÚBLICO */
    await supabase.from("pedidos_publicos").insert({
      id: referencia,
      loja_user_id: loja.user_id,
      valor: valorTotal,
      cliente_nome: cliente.nome,
      cliente_whatsapp: cliente.whatsapp,
      status: "CRIADO",
      payload: { itens }
    });

    /* 6. MERCADO PAGO */
    const mp = new MercadoPago({
      accessToken: cred.mp_access_token
    });

    const mpRes = await mp.preferences.create({
      items: mpItems,
      external_reference: referencia,
      payer: { name: cliente.nome },
      back_urls: {
        success: `${process.env.APP_URL}/sucesso.html`,
        failure: `${process.env.APP_URL}/erro.html`,
        pending: `${process.env.APP_URL}/pendente.html`
      },
      auto_return: "approved",
      notification_url: `${process.env.APP_URL}/api/webhook-mercadopago`
    });

    await supabase
      .from("pedidos_publicos")
      .update({ mp_preference_id: mpRes.body.id })
      .eq("id", referencia);

    return res.json({ init_point: mpRes.body.init_point });

  } catch (err) {
    console.error("CREATE PAGAMENTO:", err);
    return res.status(500).json({ error: err.message });
  }
}

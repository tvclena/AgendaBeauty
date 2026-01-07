import { createClient } from "@supabase/supabase-js";
import mercadopago from "mercadopago";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);
export async function handlePedido(paymentMaster) {
  try {
    const paymentId = String(paymentMaster.id);

    /* 1️⃣ BUSCA MOVIMENTAÇÃO */
    const { data: mov } = await supabase
      .from("movimentacoes_pagamento")
      .select("id, loja_id, pedido_id, status")
      .eq("mp_payment_id", paymentId)
      .single();

    if (!mov) return;

    // 🛑 IDEMPOTÊNCIA
    if (mov.status === "APPROVED") return;

    /* 2️⃣ TOKEN DA LOJA */
    const { data: cred } = await supabase
      .from("credenciais_pagamento")
      .select("mp_access_token")
      .eq("user_id", mov.loja_id)
      .single();

    if (!cred?.mp_access_token) return;

    mercadopago.configure({
      access_token: cred.mp_access_token
    });

    /* 3️⃣ CONSULTA PAGAMENTO REAL */
    const payment = await mercadopago.payment.get(paymentId);
    const status = payment.body.status;

    /* 4️⃣ ATUALIZA MOVIMENTAÇÃO */
    await supabase
      .from("movimentacoes_pagamento")
      .update({
        status: status.toUpperCase(),
        payload: payment.body,
        updated_at: new Date().toISOString()
      })
      .eq("id", mov.id);

    if (status !== "approved") return;

    /* 5️⃣ LIBERA PEDIDO */
    await supabase
      .from("pedidos")
      .update({ status: "PAGO" })
      .eq("id", mov.pedido_id);

    /* 6️⃣ GERA COMANDA */
    const { data: comanda } = await supabase
      .from("comandas")
      .insert({
        loja_id: mov.loja_id,
        pedido_id: mov.pedido_id,
        status: "ABERTA"
      })
      .select()
      .single();

    /* 7️⃣ PUSH */
    await supabase.rpc("fn_enqueue_push", {
      p_user_id: mov.loja_id,
      p_tipo: "PAGAMENTO",
      p_titulo: "Pagamento aprovado 💳",
      p_mensagem: "Pedido pago e liberado automaticamente.",
      p_url: "/comandas.html"
    });

    console.log("✔ Pedido liberado | Comanda:", comanda?.id);

  } catch (err) {
    console.error("❌ Erro pedido:", err);
  }
}

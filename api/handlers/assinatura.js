import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);


export async function handleAssinatura(payment) {
  try {
    const status = payment.status;
    const metadata = payment.metadata || {};
    const valor = payment.transaction_amount;

    if (!metadata.user_id) return;

    const user_id = metadata.user_id;
    const paymentId = String(payment.id);

    /* 1️⃣ ATUALIZA PAGAMENTO */
    const { data: pagamentoAtualizado } = await supabase
      .from("pagamentos_assinatura")
      .update({
        status,
        valor,
        pago_em: status === "approved" ? new Date().toISOString() : null,
        atualizado_em: new Date().toISOString()
      })
      .eq("mp_payment_id", paymentId)
      .select()
      .single();

    if (!pagamentoAtualizado) {
      console.warn("Pagamento assinatura não encontrado:", paymentId);
      return;
    }

    // 🛑 IDEMPOTÊNCIA
    if (pagamentoAtualizado.status === "approved" && status === "approved") {
      return;
    }

    if (status !== "approved") return;

    /* 2️⃣ BUSCA VALIDADE ATUAL */
    const { data: profile } = await supabase
      .from("user_profile")
      .select("assinatura_valida_ate")
      .eq("user_id", user_id)
      .single();

    const agora = new Date();
    let novaValidade = new Date();

    if (
      profile?.assinatura_valida_ate &&
      new Date(profile.assinatura_valida_ate) > agora
    ) {
      novaValidade = new Date(profile.assinatura_valida_ate);
    }

    novaValidade.setDate(novaValidade.getDate() + 30);

    /* 3️⃣ ATIVA / RENOVA ASSINATURA */
    await supabase
      .from("user_profile")
      .update({
        status: "active",
        assinatura_ativa: true,
        assinatura_plano: "PROFISSIONAL",
        assinatura_valor: valor,
        assinatura_valida_ate: novaValidade.toISOString(),
        atualizado_em: new Date().toISOString()
      })
      .eq("user_id", user_id);

    console.log("✅ Assinatura renovada:", user_id);

  } catch (err) {
    console.error("❌ Erro assinatura:", err);
  }
}

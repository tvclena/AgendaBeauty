import { MercadoPagoConfig, Payment } from "mercadopago";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN_DONO,
});

const paymentClient = new Payment(mp);

export default async function handler(req, res) {
  try {
    // 🔔 RESPONDE 200 IMEDIATO
    res.status(200).json({ received: true });

    const paymentId = req.body?.data?.id;
    if (!paymentId) return;

    // 🔎 BUSCA PAGAMENTO NO MP
    const payment = await paymentClient.get({ id: paymentId });

    const status = payment.status;
    const metadata = payment.metadata || {};
    const valor = payment.transaction_amount;

    // 🔐 CONFERE SE É ASSINATURA
    if (metadata.tipo !== "assinatura" || !metadata.user_id) return;

    const user_id = metadata.user_id;

    // 🗄️ ATUALIZA PAGAMENTO
    const { data: pagamentoAtualizado } = await supabase
      .from("pagamentos_assinatura")
      .update({
        status,
        valor,
        pago_em: status === "approved" ? new Date().toISOString() : null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("mp_payment_id", String(paymentId))
      .select()
      .single();

    if (!pagamentoAtualizado) {
      console.warn("Pagamento não encontrado:", paymentId);
      return;
    }

    if (status !== "approved") return;

    // 🔁 CALCULA NOVA VALIDADE
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

    // ✅ ATIVA / RENOVA ASSINATURA
    await supabase
      .from("user_profile")
      .update({
        status: "active",
        assinatura_ativa: true,
        assinatura_plano: "PROFISSIONAL",
        assinatura_valor: valor,
        assinatura_valida_ate: novaValidade.toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq("user_id", user_id);

  } catch (err) {
    console.error("❌ Webhook assinatura erro:", err);
  }
}

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
    // 🔔 SEMPRE responder 200 rápido
    const paymentId = req.body?.data?.id;

    if (!paymentId) {
      return res.status(200).json({ ignored: true });
    }

    // 🔎 Busca pagamento real no Mercado Pago
    const payment = await paymentClient.get({ id: paymentId });

    const status = payment.body.status;
    const metadata = payment.body.metadata || {};
    const valor = payment.body.transaction_amount;

    // 🔐 Garante que é assinatura
    if (metadata.tipo !== "assinatura" || !metadata.user_id) {
      return res.status(200).json({ ignored: true });
    }

    const user_id = metadata.user_id;

    // 🗄️ ATUALIZA PAGAMENTO (ID COMO STRING)
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

    // ❗ Se não encontrou o pagamento no banco
    if (!pagamentoAtualizado) {
      console.warn("Pagamento não encontrado no banco:", paymentId);
      return res.status(200).json({ not_found: true });
    }

    // ❌ Se ainda não foi aprovado, encerra aqui
    if (status !== "approved") {
      return res.status(200).json({ status });
    }

    // 🔁 BUSCA ASSINATURA ATUAL
    const { data: profile } = await supabase
      .from("user_profile")
      .select("assinatura_valida_ate")
      .eq("user_id", user_id)
      .single();

    const agora = new Date();
    let novaValidade = new Date();

    // 🧠 Se já tinha assinatura válida, renova a partir dela
    if (
      profile?.assinatura_valida_ate &&
      new Date(profile.assinatura_valida_ate) > agora
    ) {
      novaValidade = new Date(profile.assinatura_valida_ate);
    }

    // ➕ Soma 30 dias
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

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("❌ Webhook erro:", err);
    return res.status(200).json({ error: true });
  }
}

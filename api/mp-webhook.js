export default async function handler(req, res) {
  // 🔔 RESPONDE IMEDIATO (MP exige isso)
  res.status(200).json({ received: true });

  try {
    const paymentId =
      req.body?.data?.id ||
      req.body?.id ||
      req.body?.resource?.split("/").pop();

    if (!paymentId) return;

    // 🔍 BUSCA PAGAMENTO COM TOKEN DONO (sempre funciona)
    const payment = await paymentClient.get({ id: paymentId });

    const metadata = payment.metadata || {};

    console.log("MP Webhook:", {
      paymentId,
      tipo: metadata.tipo,
      status: payment.status
    });

    // 🔀 ROTEAMENTO
    if (metadata.tipo === "assinatura") {
      await handleAssinatura(payment);
      return;
    }

    if (metadata.tipo === "pedido") {
      await handlePedido(payment);
      return;
    }

    console.warn("Tipo de pagamento desconhecido:", metadata.tipo);

  } catch (err) {
    console.error("❌ Webhook MP erro:", err);
  }
}

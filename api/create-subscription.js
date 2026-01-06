import mercadopago from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN_DONO
})


export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const { user_id, email } = req.body

    if (!user_id || !email) {
      return res.status(400).json({ error: 'user_id e email são obrigatórios' })
    }

    // 🔐 Verifica se usuário existe
    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('user_id')
      .eq('user_id', user_id)
      .single()

    if (profileError || !profile) {
      return res.status(400).json({ error: 'Usuário não encontrado' })
    }

    // 💰 Regra de preço
    const hoje = new Date()
    const limitePromo = new Date('2026-02-06T23:59:59')

    const valor = hoje <= limitePromo ? 9.90 : 32.90

    // 🧾 Criação do pagamento
    const payment = await mercadopago.payment.create({
      transaction_amount: valor,
      description: 'Assinatura Agenda Clena',
      payment_method_id: 'pix',
      payer: {
        email
      },
      metadata: {
        user_id,
        tipo: 'assinatura'
      }
    })

    // 🗄️ Salva pagamento no banco
    await supabase.from('pagamentos_assinatura').insert({
      user_id,
      mp_payment_id: payment.body.id,
      status: payment.body.status,
      valor
    })

    // 🔁 Retorno para o front
    return res.status(200).json({
      mp_payment_id: payment.body.id,
      status: payment.body.status,
      qr_code: payment.body.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: payment.body.point_of_interaction?.transaction_data?.qr_code_base64,
      ticket_url: payment.body.point_of_interaction?.transaction_data?.ticket_url
    })

  } catch (err) {
    console.error('Erro create-subscription:', err)
    return res.status(500).json({ error: 'Erro ao criar assinatura' })
  }
}

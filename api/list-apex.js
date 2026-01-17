import { createClient } from "@supabase/supabase-js";

// =====================================
// CONFIGURAÇÃO DO SUPABASE
// =====================================
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// =====================================
// HANDLER
// =====================================
export default async function handler(req, res) {
  // Apenas GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // =====================================
    // BUSCA PLANOS APEX (RECARGA)
    // =====================================
    const { data, error } = await supabase
      .from("planos")
      .select("id, nome, valor")
      .eq("ativo", true)
      .eq("dias", 0)        // 🔥 IMPORTANTE: NUMBER
      .order("valor", { ascending: true });

    if (error) {
      console.error("Erro Supabase:", error);
      return res.status(500).json({
        error: "Erro ao buscar planos Apex",
        details: error.message
      });
    }

    // =====================================
    // RESPOSTA FINAL
    // =====================================
    return res.status(200).json({
      planos: data || []
    });

  } catch (err) {
    console.error("Erro interno API list-apex:", err);
    return res.status(500).json({
      error: "Erro interno da API",
      details: err.message
    });
  }
}

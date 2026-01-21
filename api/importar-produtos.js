import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

function esc(text=""){
  return text.replace(/'/g, "''");
}

async function gerarImagem({ nome, descricao, categoria, tipo, user_id }) {
  const prompt = `
Foto profissional de ${tipo === "SERVICO" ? "serviço" : "produto"}.
Nome: ${nome}
Categoria: ${categoria || "geral"}
Descrição: ${descricao || "produto de alta qualidade"}
Estilo: clean, comercial, fundo neutro, iluminação profissional
  `.trim();

  const img = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024"
  });

  const base64 = img.data[0].b64_json;
  const buffer = Buffer.from(base64, "base64");

  const filePath = `${user_id}/${crypto.randomUUID()}.png`;

  await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType: "image/png",
      upsert: true
    });

  const { data } = supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { rows } = req.body;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: "Planilha inválida" });
  }

  let sql = "BEGIN;\n\n";
  let preview = `
<tr>
  <th>Nome</th>
  <th>Tipo</th>
  <th>Status</th>
</tr>`;

  for (const row of rows) {
    try {
      const user_id = row.user_id;
      const tipo = (row.tipo || "PRODUTO").toUpperCase();
      const nome = esc(row.nome || "");
      const descricao = esc(row.descricao || "");
      const categoria = esc(row.categoria || "");
      const preco = Number(row.preco || 0);
      const custo = Number(row.custo || 0);

      let imagem_url = row.imagem_url || "";

      if (!imagem_url) {
        imagem_url = await gerarImagem({
          nome, descricao, categoria, tipo, user_id
        });
      }

      sql += `
INSERT INTO produtos_servicos (
  id,
  user_id,
  tipo,
  nome,
  descricao,
  categoria,
  preco,
  custo,
  imagem_url,
  ativo
) VALUES (
  gen_random_uuid(),
  '${user_id}',
  '${tipo}',
  '${nome}',
  '${descricao}',
  '${categoria}',
  ${preco},
  ${custo},
  '${imagem_url}',
  true
);
`;

      preview += `
<tr>
  <td>${nome}</td>
  <td>${tipo}</td>
  <td><span class="tag ok">OK</span></td>
</tr>`;

    } catch (err) {
      preview += `
<tr>
  <td>${row.nome || "-"}</td>
  <td>${row.tipo || "-"}</td>
  <td><span class="tag err">ERRO</span></td>
</tr>`;
    }
  }

  sql += "\nCOMMIT;";

  return res.status(200).json({ sql, preview });
}

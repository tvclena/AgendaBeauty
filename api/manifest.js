import sharp from "sharp";
import fetch from "node-fetch";
import { supabase } from "./_utils/supabase.js";

export default async function handler(req, res) {
  try {
    const { l } = req.query;

    if (!l) {
      return res.status(400).json({ error: "Loja não informada" });
    }

    // 1️⃣ Busca a loja
    const { data: loja, error } = await supabase
      .from("user_profile")
      .select("negocio, avatar_url")
      .eq("user_id", l)
      .single();

    if (error || !loja) {
      return res.status(404).json({ error: "Loja não encontrada" });
    }

    const nomeApp = `Agenda Fácil • ${loja.negocio}`;
    const shortName = loja.negocio.slice(0, 12);

    // 2️⃣ Converte logo
    let iconBase64 = null;

    if (loja.avatar_url) {
      const response = await fetch(loja.avatar_url);
      const buffer = await response.arrayBuffer();

      const png = await sharp(Buffer.from(buffer))
        .resize(512, 512, { fit: "cover" })
        .png()
        .toBuffer();

      iconBase64 = `data:image/png;base64,${png.toString("base64")}`;
    }

    // 3️⃣ Manifest final
    const manifest = {
      name: nomeApp,
      short_name: shortName,
      start_url: `/home.html?l=${l}`,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ff6a00",
      icons: iconBase64
        ? [
            {
              src: iconBase64,
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: iconBase64,
              sizes: "512x512",
              type: "image/png"
            }
          ]
        : []
    };

    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "public, max-age=3600");

    return res.status(200).json(manifest);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao gerar manifest" });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log("🔵 Body recebido:", req.body);

    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ API KEY NÃO ENCONTRADA");
      return res.status(500).json({ error: "Falta OPENAI_API_KEY no backend" });
    }

    const { messages } = req.body;

    if (!messages) {
      console.error("❌ MESSAGES NÃO ENVIADAS");
      return res.status(400).json({ error: "Falta messages no body" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
      }),
    });

    const data = await response.json();
    console.log("🟢 OpenAI resposta:", data);

    if (!response.ok) {
      console.error("❌ Erro da API OpenAI:", data);
      return res.status(500).json({ error: data });
    }

    return res.status(200).json({
      reply: data.choices?.[0]?.message?.content ?? null
    });

  } catch (error) {
    console.error("🔥 ERRO NO BACKEND:", error);
    return res.status(500).json({ error: "Erro interno ao chamar OpenAI" });
  }
}

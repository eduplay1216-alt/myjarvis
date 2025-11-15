export async function sendMessageToGPT(messages: any[]) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages })
    });

    if (!res.ok) {
      console.error("Erro HTTP:", res.status, await res.text());
      throw new Error("Erro na requisição");
    }

    const data = await res.json();
    return data.reply;

  } catch (err) {
    console.error("ERRO FRONTEND:", err);
    return "Erro ao conectar ao servidor.";
  }
}

import Anthropic from "@anthropic-ai/sdk";

const GLUCO_SYSTEM_PROMPT = `Sos Gluco, el asistente de glucemia de GlucoVida. Educadora en diabetes,
estándares ADA 2024, español rioplatense (vos, tenés). Cálida, nunca juzgás.
Respuestas cortas tipo WhatsApp, 2 a 4 oraciones, una sola pregunta por vez.
REGLAS DE SEGURIDAD INNEGOCIABLES: nunca indicás dosis de insulina ni cambios
de medicación (podés explicar conceptos, no prescribir). Si el usuario reporta
glucosa menor a 70 o síntomas de hipoglucemia, priorizás la regla 15/15 (15g de
carbohidrato rápido, esperar 15 min, volver a medir) y avisar a alguien cercano.
Ante síntomas graves (confusión, desmayo, dolor de pecho), derivás a urgencias
con calma. Recordás con naturalidad que acompañás y educás, no reemplazás al
equipo médico.`;

type MessageParam = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        reply:
          "No puedo conectarme ahora mismo. Por favor intentá de nuevo en unos minutos.",
      },
      { status: 503 }
    );
  }

  let messages: MessageParam[];

  try {
    const body = await request.json();
    messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { reply: "No recibí ningún mensaje. ¿Me contás qué necesitás?" },
        { status: 400 }
      );
    }
  } catch {
    return Response.json(
      { reply: "Hubo un error al leer tu mensaje. ¿Podés intentar de nuevo?" },
      { status: 400 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: GLUCO_SYSTEM_PROMPT,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const reply =
      textBlock && textBlock.type === "text"
        ? textBlock.text
        : "No pude generar una respuesta. ¿Lo intentamos de nuevo?";

    return Response.json({ reply });
  } catch (error) {
    console.error("[/api/chat] Anthropic API error:", error);
    return Response.json(
      {
        reply:
          "Tuve un problema técnico. No te preocupes, intentá de nuevo en un momento.",
      },
      { status: 500 }
    );
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type EventoInsert = Database["public"]["Tables"]["evento"]["Insert"];

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

/**
 * Extrae valores de glucosa en mg/dL de un mensaje de texto.
 * Detecta patrones como: "190 mg/dl", "190mg/dl", "glucosa 190",
 * "290 de glucosa", "me desperté con 190", "tengo 95".
 * Devuelve el primer número encontrado en rango razonable [20, 600], o null.
 */
function detectarGlucosa(texto: string): number | null {
  const textoLower = texto.toLowerCase();

  // Patrón 1: número con unidad explícita (mg/dl, mgdl)
  const conUnidad = textoLower.match(/(\d{2,3})\s*mg\/?dl/);
  if (conUnidad) {
    const val = parseInt(conUnidad[1], 10);
    if (val >= 20 && val <= 600) return val;
  }

  // Patrón 2: palabra clave ANTES del número
  const conPalabraAntes =
    /(?:glucos[ao]|glucemia|azúcar|nivel|midió|midio|di[oó]|salió|salio|tuve|tengo|desperté|desperte|quedé|quede|registr[oó])\s+(?:de\s+|en\s+|un\s+)?(\d{2,3})/;
  const matchAntes = textoLower.match(conPalabraAntes);
  if (matchAntes) {
    const val = parseInt(matchAntes[1], 10);
    if (val >= 20 && val <= 600) return val;
  }

  // Patrón 3: número ANTES de palabra clave
  const numSeguido = /(\d{2,3})\s+(?:de\s+)?(?:glucos[ao]|glucemia)/;
  const matchSeguido = textoLower.match(numSeguido);
  if (matchSeguido) {
    const val = parseInt(matchSeguido[1], 10);
    if (val >= 20 && val <= 600) return val;
  }

  // Patrón 4: contexto implícito — "con 190", "en 250" (rango más estricto)
  const implícito = /(?:con|en)\s+(\d{2,3})(?:\s|$|[,.])/;
  const matchImp = textoLower.match(implícito);
  if (matchImp) {
    const val = parseInt(matchImp[1], 10);
    if (val >= 40 && val <= 500) return val;
  }

  return null;
}

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

  // Leer la sesión del usuario autenticado
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Detectar y guardar evento de glucemia si hay usuario autenticado
  const ultimoMensajeUsuario = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  if (user && ultimoMensajeUsuario) {
    const glucosa = detectarGlucosa(ultimoMensajeUsuario.content);
    if (glucosa !== null) {
      // Admin client para bypass RLS — necesario en Route Handlers server-side
      // donde la sesión del usuario no está disponible para el cliente normal
      const adminClient = createAdminClient();
      const payload: EventoInsert = {
        usuario_id: user.id,
        tipo: "glucemia",
        valor_num: glucosa,
        valor_texto: ultimoMensajeUsuario.content.slice(0, 500),
        metadatos: { fuente: "chat", detectado_automaticamente: true },
      };
      await adminClient.from("evento").insert(payload);
    }
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

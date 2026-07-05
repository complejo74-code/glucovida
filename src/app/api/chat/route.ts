import Anthropic from "@anthropic-ai/sdk";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type EventoInsert = Database["public"]["Tables"]["evento"]["Insert"];

// Prompt base — reglas de seguridad innegociables, nunca se modifican
const GLUCO_SYSTEM_PROMPT_BASE = `Sos Gluco, el asistente de glucemia de GlucoVida. Educadora en diabetes,
estándares ADA 2024, español rioplatense (vos, tenés). Cálida, nunca juzgás.
Respuestas cortas tipo WhatsApp, 2 a 4 oraciones, una sola pregunta por vez.
REGLAS DE SEGURIDAD INNEGOCIABLES: nunca indicás dosis de insulina ni cambios
de medicación (podés explicar conceptos, no prescribir). Si el usuario reporta
glucosa menor a 70 o síntomas de hipoglucemia, priorizás la regla 15/15 (15g de
carbohidrato rápido, esperar 15 min, volver a medir) y avisar a alguien cercano.
Ante síntomas graves (confusión, desmayo, dolor de pecho), derivás a urgencias
con calma. Recordás con naturalidad que acompañás y educás, no reemplazás al
equipo médico.`;

/**
 * Formatea una fecha como texto relativo legible en español rioplatense.
 * Ej: "hoy 08:30", "ayer 22:00", "hace 3 días 10:15"
 */
function formatFechaRelativa(fecha: Date, ahora: Date): string {
  const diffMs = ahora.getTime() - fecha.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hora = fecha.getHours().toString().padStart(2, "0");
  const min = fecha.getMinutes().toString().padStart(2, "0");
  const horaStr = `${hora}:${min}`;

  if (diffDias === 0) return `hoy ${horaStr}`;
  if (diffDias === 1) return `ayer ${horaStr}`;
  if (diffDias <= 6) return `hace ${diffDias} días ${horaStr}`;
  return `el ${fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} ${horaStr}`;
}

/**
 * Lee los últimos eventos de glucemia del usuario usando el cliente con sesión
 * (anon key + cookies → RLS aplicado). Garantiza que cada usuario solo lee sus
 * propios datos. Devuelve "" si no hay historial o hay error.
 */
async function buildHistorialContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const { data: eventos, error } = await supabase
    .from("evento")
    .select("valor_num, ocurrido_en")
    .eq("tipo", "glucemia")
    .eq("usuario_id", userId) // defensa en profundidad + intención explícita
    .not("valor_num", "is", null)
    .order("ocurrido_en", { ascending: false })
    .limit(15);

  if (error || !eventos || eventos.length === 0) return "";

  const ahora = new Date();
  const items = eventos
    .map((e) => {
      if (e.valor_num === null) return null;
      const label = formatFechaRelativa(new Date(e.ocurrido_en), ahora);
      return `${label}: ${e.valor_num} mg/dL`;
    })
    .filter((item): item is string => item !== null);

  return items.join(" | ");
}

/**
 * Construye el system prompt final. Si hay historial, agrega una sección
 * privada con instrucciones sobre cómo usarlo con calidez, sin recitar
 * estadísticas ni juzgar. Las reglas de seguridad del prompt base nunca cambian.
 */
function buildSystemPrompt(historial: string): string {
  if (!historial) return GLUCO_SYSTEM_PROMPT_BASE;

  return `${GLUCO_SYSTEM_PROMPT_BASE}

[CONTEXTO PRIVADO — no mostrar crudo ni recitar al usuario]
Últimas glucemias registradas: ${historial}
Cómo usar este historial:
- Úsalo para acompañar con calidez cuando sume algo humano (ej: "venís mejor que ayer").
- No recités estadísticas ni promedios. No lo mencionás en cada respuesta.
- Si el usuario comparte una glucemia nueva, podés comparar con suavidad cuando sea alentador.
- Si no hay nada relevante que decir del historial en este momento, ignoralo completamente.
- La memoria acompaña, no vigila. Jamás juzgás ni alarmás innecesariamente.`;
}

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

  // Leer historial de glucemia del usuario (con RLS — cliente de sesión, no admin)
  // y guardar el evento actual si se detecta un valor. Ambas operaciones son
  // independientes: el historial se lee ANTES de llamar a Anthropic.
  const ultimoMensajeUsuario = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  // Leer historial con el cliente de sesión (RLS aplicado — solo datos del usuario)
  const historial = user
    ? await buildHistorialContext(supabase, user.id)
    : "";

  // Guardar evento de glucemia detectado en el mensaje actual
  if (user && ultimoMensajeUsuario) {
    const glucosa = detectarGlucosa(ultimoMensajeUsuario.content);
    if (glucosa !== null) {
      // Admin client para bypass RLS en escritura desde Route Handler server-side.
      // La service_role solo se usa aquí; la lectura del historial usa el cliente
      // de sesión (anon key + cookies) para que el RLS se aplique normalmente.
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
      system: buildSystemPrompt(historial),
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

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  preFiltroSeguridad,
  detectarGlucosa,
} from "@/lib/agents/seguridad";
import { clasificar, construirSystemPrompt } from "@/lib/agents/orquestador";
import type { ResultadoRuteo } from "@/lib/agents/tipos";
import {
  leerLecturas14d,
  calcularPatrones,
  sincronizarPatrones,
  construirContextoPatrones,
} from "@/lib/patrones";

type EventoInsert = Database["public"]["Tables"]["evento"]["Insert"];

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

type MessageParam = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Observabilidad del ruteo. Guarda qué agente(s) atendieron el mensaje:
 * - Si hubo glucemia detectada, va en metadatos del evento "glucemia".
 * - Si no, se inserta un evento liviano tipo "ruteo_chat".
 * Usa el cliente CON SESIÓN del usuario (anon key + cookies): la política RLS
 * `evento_insert_own` (WITH CHECK auth.uid() = usuario_id) autoriza el insert.
 * Nada en este flujo usa service_role.
 * Los errores se loguean pero nunca rompen la respuesta al usuario.
 * NADA de esto viaja al cliente.
 */
async function registrarObservabilidad(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  mensaje: string,
  ruteo: ResultadoRuteo
): Promise<void> {
  try {
    const glucosa = detectarGlucosa(mensaje);

    const metadatosRuteo = {
      agentes: ruteo.agentes,
      emergencia: ruteo.emergencia,
      via: ruteo.via,
    };

    if (glucosa !== null) {
      const payload: EventoInsert = {
        usuario_id: userId,
        tipo: "glucemia",
        valor_num: glucosa,
        valor_texto: mensaje.slice(0, 500),
        metadatos: {
          fuente: "chat",
          detectado_automaticamente: true,
          ruteo: metadatosRuteo,
        },
      };
      const { error } = await supabase.from("evento").insert(payload);
      if (error) throw error;
    } else {
      const payload: EventoInsert = {
        usuario_id: userId,
        tipo: "ruteo_chat",
        valor_texto: mensaje.slice(0, 200),
        metadatos: { fuente: "chat", ruteo: metadatosRuteo },
      };
      const { error } = await supabase.from("evento").insert(payload);
      if (error) throw error;
    }
  } catch (error) {
    console.error("[/api/chat] error registrando observabilidad:", error);
  }
}

export async function POST(request: Request) {
  // ── AUTENTICACIÓN ESTRICTA ─────────────────────────────────────────────────
  // Sin sesión válida no se procesa NADA: ni body, ni clasificación, ni LLM.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { reply: "Necesitás iniciar sesión para chatear con Gluco." },
      { status: 401 }
    );
  }

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
    const body: unknown = await request.json();
    const candidato = (body as { messages?: unknown }).messages;

    // Validación runtime de la forma de cada mensaje. Sin esto, un content
    // no-string crashearía el pre-filtro de seguridad (toLowerCase sobre no-string).
    const esMensajeValido = (m: unknown): m is MessageParam =>
      typeof m === "object" &&
      m !== null &&
      ((m as MessageParam).role === "user" ||
        (m as MessageParam).role === "assistant") &&
      typeof (m as MessageParam).content === "string";

    if (
      !Array.isArray(candidato) ||
      candidato.length === 0 ||
      !candidato.every(esMensajeValido)
    ) {
      return Response.json(
        { reply: "No recibí ningún mensaje. ¿Me contás qué necesitás?" },
        { status: 400 }
      );
    }
    messages = candidato;
  } catch {
    return Response.json(
      { reply: "Hubo un error al leer tu mensaje. ¿Podés intentar de nuevo?" },
      { status: 400 }
    );
  }

  const ultimoMensajeUsuario = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const textoUsuario = ultimoMensajeUsuario?.content ?? "";

  // ── PASO 1: PRE-FILTRO DE SEGURIDAD ──────────────────────────────────────
  // Determinístico (regex + keywords), server-side, ANTES de cualquier LLM.
  // Si detecta glucosa <70, síntomas de hipo o síntomas graves, la respuesta
  // prioriza el protocolo 15/15 / urgencias y NO se clasifica nada.
  const preFiltro = preFiltroSeguridad(textoUsuario);

  const client = new Anthropic({ apiKey });

  // ── PASO 2: CLASIFICACIÓN ────────────────────────────────────────────────
  // Solo si NO hay emergencia. Llamada corta a Haiku que devuelve JSON.
  // Si falla o no hay match claro → agentes=[] → Gluco general (que también
  // lleva las reglas de seguridad: el prompt SIEMPRE arranca con ellas).
  let ruteo: ResultadoRuteo;
  if (preFiltro.esEmergencia) {
    ruteo = { agentes: [], emergencia: true, via: "prefiltro" };
  } else {
    const clasificacion = await clasificar(client, textoUsuario);
    ruteo = {
      agentes: clasificacion.agentes,
      emergencia: false,
      via: clasificacion.via,
    };
  }

  // Log server-side del ruteo (observabilidad; jamás viaja al cliente)
  console.log("[/api/chat] ruteo:", JSON.stringify(ruteo));

  // Memoria del paso 4: historial de glucemia con RLS (cliente de sesión)
  const historial = await buildHistorialContext(supabase, user.id);

  // Observabilidad: guardar ruteo (y glucemia si se detectó). Server-side only,
  // con el cliente de sesión del usuario (RLS aplicado).
  if (textoUsuario) {
    await registrarObservabilidad(supabase, user.id, textoUsuario, ruteo);
  }

  // ── PASO 6: PATRONES TEMPORALES (determinísticos, RLS) ───────────────────
  // Se corre DESPUÉS de la observabilidad para incluir la lectura recién
  // guardada. Recalcula (upsert) los patrones del usuario y arma el contexto
  // privado para el prompt. NUNCA en emergencia: no se diluye el 15/15 con
  // patrones. Todo con el cliente de sesión (RLS); los errores nunca rompen
  // la respuesta.
  let contextoPatrones = "";
  if (!ruteo.emergencia) {
    try {
      const ahora = new Date();
      const lecturas = await leerLecturas14d(supabase, user.id, ahora);
      const patrones = calcularPatrones(lecturas, ahora);
      await sincronizarPatrones(supabase, user.id, patrones);
      contextoPatrones = construirContextoPatrones(patrones);
    } catch (error) {
      console.error("[/api/chat] error en patrones:", error);
    }
  }

  // ── PASO 3: RESPUESTA ÚNICA ──────────────────────────────────────────────
  // Un solo prompt: seguridad (siempre) + especialidades elegidas + memoria
  // + patrones. Si son 2+ subagentes, se combinan en la misma llamada.
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: construirSystemPrompt({
        agentes: ruteo.agentes,
        emergencia: ruteo.emergencia,
        historial,
        patrones: contextoPatrones,
      }),
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const reply =
      textBlock && textBlock.type === "text"
        ? textBlock.text
        : "No pude generar una respuesta. ¿Lo intentamos de nuevo?";

    // El cliente recibe SOLO la respuesta. El ruteo interno nunca se expone.
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

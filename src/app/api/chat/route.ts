import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  preFiltroSeguridad,
  detectarGlucosa,
} from "@/lib/agents/seguridad";
import { detectarEventos } from "@/lib/agents/deteccion";
import { clasificar, construirSystemPrompt } from "@/lib/agents/orquestador";
import type { ResultadoRuteo } from "@/lib/agents/tipos";
import {
  leerLecturas14d,
  calcularPatrones,
  calcularCruces,
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

/**
 * Memoria del paso 7: últimos eventos de SUEÑO y ESTRÉS del usuario (comida y
 * ejercicio quedan afuera a propósito: demasiado ruido). Mismo cliente de sesión
 * (RLS + filtro explícito por usuario_id) y misma disciplina que la memoria de
 * glucemia. Devuelve "" si no hay nada. El texto es CONTEXTO PRIVADO; Gluco
 * decide si mencionarlo con suavidad ("¿cómo venís durmiendo?"), nunca lo recita.
 */
async function buildVariablesContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("evento")
    .select("tipo, valor_num, valor_texto, ocurrido_en")
    .in("tipo", ["sueno", "estres"])
    .eq("usuario_id", userId) // defensa en profundidad + intención explícita
    .order("ocurrido_en", { ascending: false })
    .limit(12);

  if (error || !data || data.length === 0) return "";

  const ahora = new Date();
  const linea = (
    tipo: "sueno" | "estres",
    unidad: (v: number) => string
  ): string | null => {
    const items = data
      .filter((e) => e.tipo === tipo)
      .slice(0, 3)
      .map((e) => {
        const label = formatFechaRelativa(new Date(e.ocurrido_en), ahora);
        const valor = e.valor_num !== null ? unidad(e.valor_num) : "sin dato";
        const nota = (e.valor_texto ?? "").trim().slice(0, 40);
        return `${label}: ${valor}${nota ? ` ("${nota}")` : ""}`;
      });
    if (items.length === 0) return null;
    const etiqueta = tipo === "sueno" ? "Sueño reciente" : "Estrés reciente";
    return `${etiqueta}: ${items.join(" | ")}`;
  };

  const partes = [
    linea("sueno", (v) => `${v} h`),
    linea("estres", (v) => `${v}/10`),
  ].filter((p): p is string => p !== null);

  return partes.join("\n");
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

    // Carril de glucemia / observabilidad del ruteo (como hasta ahora): una fila.
    const base: EventoInsert =
      glucosa !== null
        ? {
            usuario_id: userId,
            tipo: "glucemia",
            valor_num: glucosa,
            valor_texto: mensaje.slice(0, 500),
            metadatos: {
              fuente: "chat",
              detectado_automaticamente: true,
              ruteo: metadatosRuteo,
            },
          }
        : {
            usuario_id: userId,
            tipo: "ruteo_chat",
            valor_texto: mensaje.slice(0, 200),
            metadatos: { fuente: "chat", ruteo: metadatosRuteo },
          };

    // Carril de variables conversacionales (paso 7): sueño, estrés, comida,
    // ejercicio, insulina. Cada detección es una fila ADICIONAL. La insulina es
    // registro estrictamente informativo: valor_num viene null desde el detector
    // (cero semántica de dosis) y jamás se produce ni persiste una recomendación.
    const capturados: EventoInsert[] = detectarEventos(mensaje).map((ev) => ({
      usuario_id: userId,
      tipo: ev.tipo,
      valor_num: ev.valorNum,
      valor_texto: ev.valorTexto.slice(0, 500),
      metadatos: {
        fuente: "chat",
        detectado_automaticamente: true,
        ...(ev.metadatos ?? {}),
      },
    }));

    // Un solo insert por lote (base + variables) → un round-trip, mismo cliente
    // de sesión (RLS: WITH CHECK auth.uid() = usuario_id valida cada fila).
    const { error } = await supabase.from("evento").insert([base, ...capturados]);
    if (error) throw error;
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

  // Memoria del paso 7: sueño y estrés recientes (RLS). Solo fuera de emergencia
  // (no se diluye el 15/15); construirSystemPrompt igual lo vuelve a gatear.
  const variables = ruteo.emergencia
    ? ""
    : await buildVariablesContext(supabase, user.id);

  // Observabilidad: guardar ruteo (y glucemia si se detectó). Server-side only,
  // con el cliente de sesión del usuario (RLS aplicado).
  if (textoUsuario) {
    await registrarObservabilidad(supabase, user.id, textoUsuario, ruteo);
  }

  // ── PASO 6+8: PATRONES TEMPORALES Y CRUZADOS (determinísticos, RLS) ───────
  // Se corre DESPUÉS de la observabilidad para incluir la lectura recién
  // guardada. Recalcula (upsert) los patrones simples y cruzados del usuario y
  // arma el contexto privado para el prompt. Los cruces (paso 8) relacionan
  // sueño/estrés con la glucemia; son CORRELACIÓN, no causa, y la selección
  // elige UN solo patrón (simple o cruzado) entre todos. NUNCA en emergencia:
  // no se diluye el 15/15. Todo con el cliente de sesión (RLS); los errores
  // nunca rompen la respuesta.
  let contextoPatrones = "";
  if (!ruteo.emergencia) {
    try {
      const ahora = new Date();
      const [lecturas, sueno, estres] = await Promise.all([
        leerLecturas14d(supabase, user.id, ahora),
        leerLecturas14d(supabase, user.id, ahora, "sueno"),
        leerLecturas14d(supabase, user.id, ahora, "estres"),
      ]);
      const patrones = calcularPatrones(lecturas, ahora);
      const cruces = calcularCruces(lecturas, sueno, estres, ahora);
      await sincronizarPatrones(supabase, user.id, [...patrones, ...cruces]);
      contextoPatrones = construirContextoPatrones(patrones, cruces);
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
        variables,
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

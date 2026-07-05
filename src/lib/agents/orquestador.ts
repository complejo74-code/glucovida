/**
 * ORQUESTADOR — v1
 *
 * Decide qué subagente(s) atienden cada mensaje y construye el system prompt
 * final. Garantía central: construirSystemPrompt() SIEMPRE arranca con
 * REGLAS_SEGURIDAD — es estructuralmente imposible armar un prompt sin ellas,
 * sin importar qué devuelva (o no devuelva) el clasificador.
 *
 * Flujo: pre-filtro (seguridad.ts, determinístico) → clasificar() (Haiku,
 * JSON corto) → construirSystemPrompt() → una sola respuesta al usuario.
 * El ruteo interno jamás se expone al cliente.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { REGLAS_SEGURIDAD, INSTRUCCION_EMERGENCIA } from "./seguridad";
import { nutricion } from "./nutricion";
import { insulina } from "./insulina";
import { emocional } from "./emocional";
import type { AgenteId, Subagente, ResultadoRuteo } from "./tipos";

export const SUBAGENTES: Record<AgenteId, Subagente> = {
  nutricion,
  insulina,
  emocional,
};

const IDS_VALIDOS: readonly AgenteId[] = ["nutricion", "insulina", "emocional"];

function esAgenteId(valor: unknown): valor is AgenteId {
  return typeof valor === "string" && (IDS_VALIDOS as string[]).includes(valor);
}

/** Prompt del clasificador: respuesta SOLO JSON, barata y corta. */
function buildPromptClasificador(): string {
  const catalogo = IDS_VALIDOS.map(
    (id) => `- "${id}": ${SUBAGENTES[id].descripcion}`
  ).join("\n");

  return `Sos un clasificador de mensajes para un asistente de diabetes.
Dado el último mensaje del usuario, decidí qué especialidades aplican:
${catalogo}

Respondé SOLO con JSON válido, sin texto adicional, con este formato exacto:
{"agentes": ["nutricion"]}
Podés elegir varias: {"agentes": ["nutricion", "emocional"]}
Si ninguna aplica claramente (saludo, charla general, pregunta fuera de estas
especialidades), respondé: {"agentes": []}`;
}

/**
 * Clasifica el mensaje con una llamada corta a Haiku.
 * Si la llamada falla, el JSON no parsea o no hay match → [] (fallback al
 * Gluco general, que también lleva las reglas de seguridad).
 */
export async function clasificar(
  client: Anthropic,
  mensaje: string
): Promise<{ agentes: AgenteId[]; via: ResultadoRuteo["via"] }> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: buildPromptClasificador(),
      messages: [{ role: "user", content: mensaje }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { agentes: [], via: "fallback" };
    }

    // Tolerar texto alrededor del JSON (defensa ante desvíos del modelo)
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { agentes: [], via: "fallback" };

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as { agentes?: unknown }).agentes)
    ) {
      return { agentes: [], via: "fallback" };
    }

    const agentes = (parsed as { agentes: unknown[] }).agentes.filter(esAgenteId);
    // Dedupe preservando orden
    const unicos = [...new Set(agentes)];

    return unicos.length > 0
      ? { agentes: unicos, via: "clasificador" }
      : { agentes: [], via: "fallback" };
  } catch {
    // Cualquier error de red/parseo → Gluco general (con seguridad incluida)
    return { agentes: [], via: "fallback" };
  }
}

/**
 * Construye el system prompt final. INVARIANTE DE SEGURIDAD:
 * REGLAS_SEGURIDAD va SIEMPRE primero, en todos los caminos posibles:
 * - emergencia=true  → seguridad + instrucción de emergencia (+ historial)
 * - agentes=[a,b]    → seguridad + especialidades combinadas (+ historial + patrones)
 * - agentes=[]       → seguridad sola = el Gluco general de siempre (+ historial + patrones)
 *
 * El contexto de patrones (paso 6) se inyecta como bloque privado, igual que la
 * memoria: siempre DESPUÉS de seguridad y especialidades, y NUNCA en emergencia
 * (no se diluye el 15/15 con patrones). Ese gate es estructural acá adentro
 * —no depende de que el caller pase patrones=""—, igual que la garantía de que
 * REGLAS_SEGURIDAD va primero.
 */
export function construirSystemPrompt(opciones: {
  agentes: AgenteId[];
  emergencia: boolean;
  historial: string;
  patrones?: string;
}): string {
  const { agentes, emergencia, historial, patrones = "" } = opciones;
  const partes: string[] = [REGLAS_SEGURIDAD];

  if (emergencia) {
    partes.push(INSTRUCCION_EMERGENCIA);
  } else {
    for (const id of agentes) {
      partes.push(SUBAGENTES[id].especialidad);
    }
  }

  if (historial) {
    partes.push(`[CONTEXTO PRIVADO — no mostrar crudo ni recitar al usuario]
Últimas glucemias registradas: ${historial}
Cómo usar este historial:
- Úsalo para acompañar con calidez cuando sume algo humano (ej: "venís mejor que ayer").
- No recités estadísticas ni promedios. No lo mencionás en cada respuesta.
- Si el usuario comparte una glucemia nueva, podés comparar con suavidad cuando sea alentador.
- Si no hay nada relevante que decir del historial en este momento, ignoralo completamente.
- La memoria acompaña, no vigila. Jamás juzgás ni alarmás innecesariamente.`);
  }

  // Gate estructural: jamás inyectamos patrones durante una emergencia.
  if (patrones && !emergencia) {
    partes.push(patrones);
  }

  return partes.join("\n\n");
}

/**
 * PATRONES TEMPORALES v0 — comunicación (paso 6)
 *
 * Traduce los patrones (calculados, determinísticos) a un bloque de CONTEXTO
 * PRIVADO para el system prompt, con el mismo estilo y guardrails que la
 * memoria del paso 4. Reglas de diseño de salud:
 *  - Máximo UN patrón conversacional por conversación, como observación suave.
 *  - Jamás diagnóstico, jamás nombre clínico, jamás alarma. La memoria contiene,
 *    no vigila.
 *  - Excepción: hipos_recurrentes SIEMPRE se comunica (con calidez) invitando a
 *    llevarlo al equipo médico.
 * Todo esto es texto; la garantía de que REGLAS_SEGURIDAD va primero vive en
 * construirSystemPrompt (orquestador). Este módulo no genera prompts sueltos.
 */
import type {
  DetalleAmanecer,
  DetalleFranja,
  DetalleHipos,
  DetalleTendencia,
  FactorPatron,
  Patron,
} from "./tipos";

/** Prioridad de desempate cuando dos patrones conversacionales empatan en confianza. */
const PRIORIDAD: readonly FactorPatron[] = [
  "amanecer_alto",
  "franja_problematica",
  "tendencia_semanal",
];

/** hipos_recurrentes no es "de charla"; una tendencia "estable" no dice nada. */
function esConversacional(p: Patron): boolean {
  if (p.factor === "hipos_recurrentes") return false;
  if (p.factor === "tendencia_semanal") {
    return (p.detalle as DetalleTendencia).direccion !== "estable";
  }
  return true;
}

/**
 * Elige el único patrón conversacional a ofrecer: el de mayor confianza,
 * con desempate por PRIORIDAD. Ignora hipos y tendencias estables.
 */
export function seleccionarConversacional(patrones: Patron[]): Patron | null {
  const conversacionales = patrones.filter(esConversacional);
  if (conversacionales.length === 0) return null;
  return conversacionales.reduce((mejor, p) => {
    if (p.confianza > mejor.confianza) return p;
    if (
      p.confianza === mejor.confianza &&
      PRIORIDAD.indexOf(p.factor) < PRIORIDAD.indexOf(mejor.factor)
    ) {
      return p;
    }
    return mejor;
  });
}

function lineaConversacional(p: Patron): string {
  switch (p.factor) {
    case "amanecer_alto": {
      const d = p.detalle as DetalleAmanecer;
      return `Las glucemias del amanecer (5–9 h) vienen más altas que el resto del día (aprox. ${d.promedioAmanecer} vs ${d.promedioResto} mg/dL, sobre ${p.nObservaciones} registros).`;
    }
    case "franja_problematica": {
      const d = p.detalle as DetalleFranja;
      return `En la franja de la ${d.franja}, varias lecturas vienen por encima de 180 mg/dL (promedio aprox. ${d.promedio}, sobre ${p.nObservaciones} registros).`;
    }
    case "tendencia_semanal": {
      const d = p.detalle as DetalleTendencia;
      const magnitud = Math.abs(p.efectoEstimado);
      const rumbo = d.direccion === "baja" ? "más abajo" : "más arriba";
      return `El promedio de esta semana viene alrededor de ${magnitud} mg/dL ${rumbo} que el de la semana anterior.`;
    }
    default:
      return "";
  }
}

function bloqueConversacional(p: Patron): string {
  return `[CONTEXTO PRIVADO — patrón observado, NO es diagnóstico]
${lineaConversacional(p)}
Cómo usarlo:
- Mencionalo COMO MÁXIMO una vez, y solo si viene al caso, como una pregunta u observación suave ("¿notaste que...?").
- Nunca como diagnóstico, nunca con nombre clínico, nunca con tono de alarma o vigilancia.
- Si no viene al caso en esta charla, ignoralo por completo. La memoria acompaña, no vigila.`;
}

function bloqueHipos(d: DetalleHipos): string {
  return `[CONTEXTO PRIVADO — seguridad, no mostrar crudo]
Registré ${d.cantidad} lecturas por debajo de 70 mg/dL en los últimos ${d.ventanaDias} días.
Cómo usarlo:
- Con calidez y sin asustar, invitá a la persona a charlar estas bajas con su médico/a o equipo de salud.
- No es una emergencia si ahora está bien: es una observación para cuidar, no para alarmar.
- Decilo una vez, sin insistir ni convertirlo en un reto.`;
}

/**
 * Arma el contexto de patrones para inyectar en el system prompt.
 * Estructura: bloque de seguridad de hipos (si aplica, SIEMPRE) + como máximo
 * un bloque conversacional. Devuelve "" si no hay nada que decir.
 */
export function construirContextoPatrones(patrones: Patron[]): string {
  const bloques: string[] = [];

  const hipos = patrones.find((p) => p.factor === "hipos_recurrentes");
  if (hipos) {
    bloques.push(bloqueHipos(hipos.detalle as DetalleHipos));
  }

  const conversacional = seleccionarConversacional(patrones);
  if (conversacional) {
    bloques.push(bloqueConversacional(conversacional));
  }

  return bloques.join("\n\n");
}

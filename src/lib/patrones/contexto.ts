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
  DetalleEstresGlucemia,
  DetalleFranja,
  DetalleHipos,
  DetalleSuenoAmanecer,
  DetalleTendencia,
  FactorCruce,
  FactorPatron,
  Patron,
  PatronCruzado,
} from "./tipos";

/** Prioridad de desempate cuando dos patrones conversacionales empatan en confianza. */
const PRIORIDAD: readonly FactorPatron[] = [
  "amanecer_alto",
  "franja_problematica",
  "tendencia_semanal",
];

/** Desempate entre cruces (paso 8). Van DESPUÉS de los simples en empate. */
const PRIORIDAD_CRUCE: readonly FactorCruce[] = [
  "sueno_vs_amanecer",
  "estres_vs_glucemia",
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

/**
 * La ÚNICA mención conversacional a ofrecer, elegida entre patrones simples y
 * cruzados (paso 8): gana la mayor confianza; el desempate usa PRIORIDAD (y los
 * cruces van después de los simples). Los cruces son siempre "de charla"
 * (tentativos); hipos y tendencias estables quedan fuera vía `esConversacional`.
 */
type Candidato =
  | { tipo: "simple"; patron: Patron }
  | { tipo: "cruce"; patron: PatronCruzado };

function prioridadDe(c: Candidato): number {
  return c.tipo === "simple"
    ? PRIORIDAD.indexOf(c.patron.factor)
    : PRIORIDAD.length + PRIORIDAD_CRUCE.indexOf(c.patron.factor);
}

export function seleccionarMencion(
  patrones: Patron[],
  cruces: PatronCruzado[]
): Candidato | null {
  const candidatos: Candidato[] = [
    ...patrones.filter(esConversacional).map((p) => ({ tipo: "simple" as const, patron: p })),
    ...cruces.map((p) => ({ tipo: "cruce" as const, patron: p })),
  ];
  if (candidatos.length === 0) return null;
  return candidatos.reduce((mejor, c) => {
    if (c.patron.confianza > mejor.patron.confianza) return c;
    if (c.patron.confianza === mejor.patron.confianza && prioridadDe(c) < prioridadDe(mejor)) {
      return c;
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

// ── Comunicación de CRUCES (paso 8): SIEMPRE pregunta tentativa, jamás causal ──
/**
 * Una línea asociativa (no causal) para un cruce. Regla de oro: NUNCA "sube/
 * causa/genera"; solo "coinciden con", "los días/noches que…". El rumbo del
 * efecto se lee del signo de `efectoEstimado` (nunca afirma dirección causal).
 */
function lineaCruce(p: PatronCruzado): string {
  const rumbo = p.efectoEstimado >= 0 ? "más arriba" : "más abajo";
  switch (p.factor) {
    case "sueno_vs_amanecer": {
      const d = p.detalle as DetalleSuenoAmanecer;
      return `¿Será que las noches en que dormís menos coinciden con amanecers distintos? Las mañanas después de dormir menos de ${d.umbralHoras} h, tus glucemias del amanecer vienen en promedio ${rumbo} que cuando descansás más (aprox. ${d.pocoSueno.promedio} vs ${d.suenoNormal.promedio} mg/dL, sobre ${d.pocoSueno.n} y ${d.suenoNormal.n} días). Es algo interesante para mirar con tu médico/a.`;
    }
    case "estres_vs_glucemia": {
      const d = p.detalle as DetalleEstresGlucemia;
      return `¿Será que los días de más estrés coinciden con glucemias distintas? Los días que registrás más estrés, tu glucemia promedio del día viene ${rumbo} que en los días más tranquilos (aprox. ${d.estresAlto.promedio} vs ${d.estresBajo.promedio} mg/dL, sobre ${d.estresAlto.n} y ${d.estresBajo.n} días). Es algo interesante para mirar con tu médico/a.`;
    }
    default:
      return "";
  }
}

function bloqueCruce(p: PatronCruzado): string {
  return `[CONTEXTO PRIVADO — posible asociación observada, NO es diagnóstico]
${lineaCruce(p)}
Recordá: esto es una CORRELACIÓN observada (dos cosas que coinciden), no significa que una lleve a la otra ni es diagnóstico. Puede haber muchas razones detrás.
Cómo usarlo:
- Mencionalo COMO MÁXIMO una vez, y SIEMPRE como una pregunta curiosa y tentativa ("¿será que...?"), nunca como una afirmación.
- Jamás digas que una cosa "sube", "baja" o "genera" la otra: solo que "coinciden" o que "los días/noches que...".
- Invitá a la persona a mirarlo con su médico/a. Si no viene al caso en esta charla, ignoralo. La memoria acompaña, no vigila.`;
}

/**
 * Arma el contexto de patrones para inyectar en el system prompt.
 * Estructura: bloque de seguridad de hipos (si aplica, SIEMPRE) + como máximo
 * UN bloque conversacional, elegido entre patrones simples y cruzados (paso 8).
 * Devuelve "" si no hay nada que decir.
 */
export function construirContextoPatrones(
  patrones: Patron[],
  cruces: PatronCruzado[] = []
): string {
  const bloques: string[] = [];

  const hipos = patrones.find((p) => p.factor === "hipos_recurrentes");
  if (hipos) {
    bloques.push(bloqueHipos(hipos.detalle as DetalleHipos));
  }

  const mencion = seleccionarMencion(patrones, cruces);
  if (mencion?.tipo === "simple") {
    bloques.push(bloqueConversacional(mencion.patron));
  } else if (mencion?.tipo === "cruce") {
    bloques.push(bloqueCruce(mencion.patron));
  }

  return bloques.join("\n\n");
}

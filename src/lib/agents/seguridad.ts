/**
 * MÓDULO DE SEGURIDAD — v1
 *
 * Reglas innegociables compartidas por TODOS los agentes de Gluco.
 * Este bloque se inyecta en cada system prompt sin excepción: subagentes,
 * Gluco general (fallback) y respuestas de emergencia.
 *
 * También vive acá el pre-filtro determinístico de emergencias, que corre
 * server-side ANTES de cualquier llamada a un LLM. Al ser regex + keywords
 * (sin IA), no puede fallar por mal ruteo ni por un JSON mal parseado.
 */

export const REGLAS_SEGURIDAD = `Sos Gluco, el asistente de glucemia de GlucoVida. Educadora en diabetes,
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
 * Instrucción adicional cuando el pre-filtro detecta una emergencia.
 * Se suma a REGLAS_SEGURIDAD para que la respuesta priorice el protocolo.
 */
export const INSTRUCCION_EMERGENCIA = `
[PRIORIDAD MÁXIMA — el sistema detectó una posible hipoglucemia o emergencia]
Tu respuesta DEBE priorizar la seguridad inmediata antes que cualquier otro tema:
1. Guiá el protocolo 15/15 con calma: 15g de carbohidrato rápido AHORA (medio
   vaso de jugo o gaseosa común, 3 caramelos, 1 cda de azúcar), esperar 15
   minutos, volver a medir.
2. Sugerí avisar a alguien cercano.
3. Si hay síntomas graves (confusión, desmayo, convulsiones, dolor de pecho),
   indicá llamar a urgencias ya.
Sé breve, clara y contenedora. Nada de teoría ahora: acción concreta primero.`;

/** Resultado del pre-filtro de seguridad. */
export interface ResultadoPreFiltro {
  esEmergencia: boolean;
  motivo: "glucosa_baja" | "sintomas_hipo" | "sintomas_graves" | null;
}

// Síntomas típicos de hipoglucemia (rioplatense incluido)
const SINTOMAS_HIPO =
  /tiembl|temblor|sudor\s*fr[ií]o|sudando\s*fr[ií]o|mareo|maread|visi[oó]n\s*borrosa|palpitacion|taquicardia|hormigueo|debilidad\s*repentina|hipoglucemia|estoy\s+en\s+hipo|me\s+baj[oó]\s+(el\s+)?az[uú]car/i;

// Síntomas graves que ameritan urgencias
const SINTOMAS_GRAVES =
  /confusi[oó]n|confundid|desmay|desvanec|convulsi|p[eé]rdida\s*de\s*conocimiento|dolor\s*de\s*pecho|no\s+puedo\s+hablar|no\s+veo/i;

// ── Detección de glucosa endurecida (paso 5.5) ──────────────────────────────
// Filosofía: en salud, un dato faltante es mejor que un dato falso.
// Solo se acepta un número si (a) no está pegado a una unidad no glucémica ni
// tiene formato de hora/fecha, (b) tiene contexto glucémico real cerca, y
// (c) está en rango plausible [30, 600] mg/dL. Ante la duda → null.

/** Rango plausible de glucemia capilar/CGM en mg/dL. */
const GLUCOSA_MIN = 30;
const GLUCOSA_MAX = 600;

/** Unidades/palabras que descartan el número si aparecen inmediatamente después. */
const EXCLUSION_DESPUES =
  /^\s*(?:hs\b|hrs?\b|horas?\b|hora\b|a[ñn]os?\b|pesos?\b|d[oó]lares?\b|usd\b|gramos?\b|grs?\b|g\s+de\b|kg\b|kilos?\b|minutos?\b|min\b|mins\b|segundos?\b|d[ií]as?\b|semanas?\b|meses\b|veces\b|cuadras?\b|km\b|metros?\b|%)/;

/** Prefijos que descartan el número si aparecen inmediatamente antes. */
const EXCLUSION_ANTES = /(?:\$|n[uú]mero|nro\.?|n°|a\s+las?|el\s+bondi|colectivo|l[ií]nea)\s*$/;

/** Unidad glucémica explícita inmediatamente después del número. */
const UNIDAD_DESPUES = /^\s*(?:mg\s*\/?\s*dl|mgdl)/;

/** Palabra glucémica poco después del número: "190 de glucemia". */
const CONTEXTO_DESPUES = /^\s*(?:de\s+)?(?:glucos[ao]|glucemia|de\s+az[uú]car)/;

/**
 * Contexto glucémico ANTES del número (evaluado sobre la ventana previa):
 * - Sustantivo glucémico a distancia corta: glucosa, glucemia, azúcar,
 *   "me medí", medición, sensor, dexcom, freestyle.
 * - O frase corporal que precede DIRECTAMENTE al número: "amanecí en/con",
 *   "me desperté con", "estoy en", "quedé en", etc. (sin palabras en el medio,
 *   para no confundir "estoy en 62" con "estoy en la calle 62").
 */
const CONTEXTO_ANTES =
  /(?:glucos[ao]|glucemia|az[uú]car|me\s+med[ií]|medici[oó]n|sensor|dexcom|freestyle|libre\s+marca)[^\d]{0,30}$|(?:amanec[ií]|me\s+despert[eé]|me\s+levant[eé]|arranqu[eé])\s+(?:en|con)\s+$|(?:estoy|ando|qued[eé]|sigo)\s+en\s+$/;

/** Formato hora (8:30) o fecha (15/07): el número toca ':' '/' o '-'. */
function esHoraOFecha(texto: string, inicio: number, fin: number): boolean {
  const antes = inicio > 0 ? texto[inicio - 1] : "";
  const despues = fin < texto.length ? texto[fin] : "";
  return [":", "/", "-", ",", "."].includes(antes) || [":", "/", "-"].includes(despues);
}

/**
 * Extrae UN valor de glucemia en mg/dL de un mensaje, con criterio estricto.
 * Ejemplos que guarda: "amanecí en 190", "estoy en 62", "tengo 250 mg/dl",
 * "mi glucemia es 110", "me dio 190 de glucemia".
 * Ejemplos que descarta: "nos vemos a las 190hs", "gasté 150 pesos",
 * "comí 80 gramos", "el bondi 152", "tengo 45 años", "a las 8:30".
 * Devuelve el primer número con contexto glucémico en [30, 600], o null.
 */
export function detectarGlucosa(texto: string): number | null {
  const textoLower = texto.toLowerCase();

  for (const match of textoLower.matchAll(/\d{2,3}/g)) {
    const inicio = match.index;
    const fin = inicio + match[0].length;

    // Descartar si es parte de un número más largo (ej: "12345")
    if (/\d/.test(textoLower[inicio - 1] ?? "") || /\d/.test(textoLower[fin] ?? "")) {
      continue;
    }

    // Exclusiones: hora/fecha, unidades no glucémicas, prefijos descartables
    if (esHoraOFecha(textoLower, inicio, fin)) continue;
    const ventanaAntes = textoLower.slice(Math.max(0, inicio - 45), inicio);
    const restoDespues = textoLower.slice(fin);
    if (EXCLUSION_DESPUES.test(restoDespues)) continue;
    if (EXCLUSION_ANTES.test(ventanaAntes)) continue;

    // Contexto glucémico obligatorio: unidad o palabra clave cerca
    const tieneContexto =
      UNIDAD_DESPUES.test(restoDespues) ||
      CONTEXTO_DESPUES.test(restoDespues) ||
      CONTEXTO_ANTES.test(ventanaAntes);
    if (!tieneContexto) continue;

    // Rango plausible
    const val = parseInt(match[0], 10);
    if (val >= GLUCOSA_MIN && val <= GLUCOSA_MAX) return val;
  }

  return null;
}

// ── Detección laxa de hipo, SOLO para el pre-filtro de emergencia ────────────
// El costo es asimétrico respecto de la persistencia: un falso positivo acá es
// un mensaje de 15/15 de más; un falso negativo es una hipo sin protocolo.
// Por eso: mismas exclusiones (horas, plata, unidades), pero contexto más laxo
// ("me dio", "me marcó", "bajé a") y piso 20 (los glucómetros leen desde ~20).
// NADA de esto persiste datos: la escritura sigue usando detectarGlucosa.

const HIPO_MIN = 20;
const HIPO_MAX = 69;

/** Frases laxas que preceden directamente al número reportando una medición. */
const CONTEXTO_HIPO_ANTES =
  /(?:me\s+dio|me\s+marc[oó]|marc[oó]|me\s+baj[oó]\s+a|baj[eé]\s+a|ca[ií]\s+a)\s+(?:un\s+|de\s+)?$/;

/** Palabra glucémica en cualquier parte del mensaje (contexto global laxo). */
const CONTEXTO_HIPO_GLOBAL =
  /glucos[ao]|glucemia|az[uú]car|sensor|dexcom|freestyle|glucómetro|glucometro|mg\s*\/?\s*dl|hipo/i;

/**
 * ¿El mensaje sugiere una glucemia en rango de hipoglucemia [20, 69]?
 * Más sensible que detectarGlucosa, pero mantiene las exclusiones duras
 * (horas, fechas, plata, unidades no glucémicas) para no gritar 15/15
 * ante "me dio 52 pesos" o "nos vemos a las 45hs".
 */
function detectarHipoPosible(texto: string): boolean {
  const textoLower = texto.toLowerCase();
  const contextoGlobal = CONTEXTO_HIPO_GLOBAL.test(textoLower);

  for (const match of textoLower.matchAll(/\d{2}/g)) {
    const inicio = match.index;
    const fin = inicio + match[0].length;

    if (/\d/.test(textoLower[inicio - 1] ?? "") || /\d/.test(textoLower[fin] ?? "")) {
      continue;
    }
    if (esHoraOFecha(textoLower, inicio, fin)) continue;

    const ventanaAntes = textoLower.slice(Math.max(0, inicio - 45), inicio);
    const restoDespues = textoLower.slice(fin);
    if (EXCLUSION_DESPUES.test(restoDespues)) continue;
    if (EXCLUSION_ANTES.test(ventanaAntes)) continue;

    const tieneContexto =
      contextoGlobal ||
      CONTEXTO_ANTES.test(ventanaAntes) ||
      CONTEXTO_HIPO_ANTES.test(ventanaAntes);
    if (!tieneContexto) continue;

    const val = parseInt(match[0], 10);
    if (val >= HIPO_MIN && val <= HIPO_MAX) return true;
  }

  return false;
}

/**
 * PRE-FILTRO DE SEGURIDAD — determinístico, sin LLM.
 * Corre ANTES de la clasificación y de cualquier llamada a Anthropic.
 * Dispara si: glucosa detectada < 70 (o hipo posible con criterio laxo),
 * síntomas de hipo, o síntomas graves.
 */
export function preFiltroSeguridad(texto: string): ResultadoPreFiltro {
  if (SINTOMAS_GRAVES.test(texto)) {
    return { esEmergencia: true, motivo: "sintomas_graves" };
  }

  const glucosa = detectarGlucosa(texto);
  if (glucosa !== null && glucosa < 70) {
    return { esEmergencia: true, motivo: "glucosa_baja" };
  }

  if (glucosa === null && detectarHipoPosible(texto)) {
    return { esEmergencia: true, motivo: "glucosa_baja" };
  }

  if (SINTOMAS_HIPO.test(texto)) {
    return { esEmergencia: true, motivo: "sintomas_hipo" };
  }

  return { esEmergencia: false, motivo: null };
}

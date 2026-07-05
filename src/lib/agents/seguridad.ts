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

/**
 * Extrae valores de glucosa en mg/dL de un mensaje de texto.
 * Detecta patrones como: "190 mg/dl", "glucosa 190", "290 de glucosa",
 * "me desperté con 190", "estoy en 62".
 * Devuelve el primer número encontrado en rango razonable [20, 600], o null.
 */
export function detectarGlucosa(texto: string): number | null {
  const textoLower = texto.toLowerCase();

  // Patrón 1: número con unidad explícita (mg/dl, mgdl)
  const conUnidad = textoLower.match(/(\d{2,3})\s*mg\/?dl/);
  if (conUnidad) {
    const val = parseInt(conUnidad[1], 10);
    if (val >= 20 && val <= 600) return val;
  }

  // Patrón 2: palabra clave ANTES del número
  const conPalabraAntes =
    /(?:glucos[ao]|glucemia|azúcar|nivel|midió|midio|di[oó]|salió|salio|tuve|tengo|desperté|desperte|amanec[ií]|quedé|quede|registr[oó])\s+(?:de\s+|en\s+|un\s+|con\s+)?(\d{2,3})/;
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
  const implicito = /(?:con|en)\s+(\d{2,3})(?:\s|$|[,.])/;
  const matchImp = textoLower.match(implicito);
  if (matchImp) {
    const val = parseInt(matchImp[1], 10);
    if (val >= 40 && val <= 500) return val;
  }

  return null;
}

/**
 * PRE-FILTRO DE SEGURIDAD — determinístico, sin LLM.
 * Corre ANTES de la clasificación y de cualquier llamada a Anthropic.
 * Dispara si: glucosa detectada < 70, síntomas de hipo, o síntomas graves.
 */
export function preFiltroSeguridad(texto: string): ResultadoPreFiltro {
  if (SINTOMAS_GRAVES.test(texto)) {
    return { esEmergencia: true, motivo: "sintomas_graves" };
  }

  const glucosa = detectarGlucosa(texto);
  if (glucosa !== null && glucosa < 70) {
    return { esEmergencia: true, motivo: "glucosa_baja" };
  }

  if (SINTOMAS_HIPO.test(texto)) {
    return { esEmergencia: true, motivo: "sintomas_hipo" };
  }

  return { esEmergencia: false, motivo: null };
}

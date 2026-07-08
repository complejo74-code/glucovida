/**
 * DETECCIÓN CONVERSACIONAL DE VARIABLES — paso 7
 *
 * Extrae de forma DETERMINÍSTICA (regex + keywords, sin LLM) las variables que
 * el usuario menciona al pasar mientras charla con Gluco: sueño, estrés, comida,
 * ejercicio e insulina. Alimenta los patrones cruzados del futuro.
 *
 * Filosofía (la misma que detectarGlucosa en seguridad.ts):
 *  - Ante la duda, NO guardar. Un dato faltante es mejor que un dato falso.
 *  - Cada detector exige su contexto obligatorio y descarta lo ambiguo.
 *  - Son funciones PURAS y testeables: mismo input → mismo output, sin efectos.
 *  - Un mensaje puede generar MÚLTIPLES eventos.
 *
 * Captura PASIVA: registra lo que el usuario ofrece naturalmente. NUNCA se le
 * pide un dato que no dio. La glucemia sigue viviendo en su propio carril
 * (seguridad.ts / detectarGlucosa); acá van las otras cinco variables.
 *
 * INSULINA: registro estrictamente INFORMATIVO. Se guarda lo que el usuario
 * CUENTA que hizo. Jamás dispara ante una PREGUNTA de dosis y jamás produce
 * nada prescriptivo (valorNum queda en null a propósito: cero semántica de
 * dosis). Toda decisión de dosis es del equipo médico, siempre.
 */

/** Variables capturadas conversacionalmente (la glucemia va aparte). */
export type TipoVariable = "sueno" | "estres" | "comida" | "ejercicio" | "insulina";

/** Un evento capturado, listo para persistir como fila de `evento`. */
export interface EventoCapturado {
  tipo: TipoVariable;
  /** Valor numérico si se pudo inferir con seguridad; null si no. */
  valorNum: number | null;
  /** Nota original / descripción textual. */
  valorTexto: string;
  /** Metadatos de dominio (ej. estimacion_carbs). Nunca dosis de insulina. */
  metadatos?: Record<string, number | string | boolean>;
}

// ── SUEÑO ────────────────────────────────────────────────────────────────────
// Contexto obligatorio: verbos/estados de dormir. Las horas SOLO se toman si el
// usuario las dice con unidad ("5 horas", "7 hs"); "me acosté a las 3" NO es una
// duración de sueño, así que ahí valorNum queda null.

const CTX_SUENO =
  /dorm[ií]|durmi[oó]|me\s+acost[eé]|descans[eé]|siesta|insomnio|desvel[eé]|desvelad|no\s+pegu[eé]\s+un\s+ojo/i;

/** Horas explícitas con unidad de tiempo. Rango plausible de sueño [0, 24]. */
function extraerHoras(t: string): number | null {
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:horas?\b|hs\b|\bh\b)/);
  if (!m) return null;
  const val = parseFloat(m[1].replace(",", "."));
  return val >= 0 && val <= 24 ? val : null;
}

export function detectarSueno(texto: string): EventoCapturado | null {
  if (!CTX_SUENO.test(texto)) return null;
  return {
    tipo: "sueno",
    valorNum: extraerHoras(texto.toLowerCase()),
    valorTexto: texto.trim(),
  };
}

// ── ESTRÉS ───────────────────────────────────────────────────────────────────
// Escala 1-10 inferida por keywords (proxy grueso, no medición). Prioridad:
// número explícito ("9/10", "9 sobre 10", solo si hay contexto de estrés) →
// alto → medio → calma. Sin ninguna señal → null. La calma exige estado propio
// ("día tranquilo", "ando relajado"): "quedate tranquilo" (a otro) NO cuenta.

const ESTRES_ALTO =
  /re\s+estresad|muy\s+estresad|re\s+ansios|muy\s+ansios|a\s+full|no\s+doy\s+m[aá]s|reventad|sobrepasad|desbordad|hasta\s+las\s+manos|al\s+borde/i;

const ESTRES_MEDIO =
  /estresad|estr[eé]s|ansios|nervios|angustiad|agobiad|saturad|abrumad|me\s+tiene\s+mal|me\s+supera/i;

// El lookbehind evita que "re" matchee el final de otra palabra ("siemp-re
// tranquilo"); solo cuenta "re" como intensificador propio ("estoy re tranqui").
// "sin/cero/nada de estrés" es lo opuesto a estrés: se toma como calma.
const CALMA =
  /d[ií]a\s+tranqui|(?<![a-záéíóúñ])(?:estoy|ando|estuve|anduve|re|muy|todo|bastante)\s+(?:tranqui|relajad|distendid)|en\s+paz|(?:sin|cero|nada\s+de)\s+(?:estr[eé]s|ansiedad|nervios)/i;

export function detectarEstres(texto: string): EventoCapturado | null {
  const t = texto.toLowerCase();
  const valorTexto = texto.trim();

  const expl = t.match(/(\d{1,2})\s*(?:\/|sobre)\s*10/);
  if (expl && /estr[eé]s/.test(t)) {
    const n = parseInt(expl[1], 10);
    if (n >= 1 && n <= 10) return { tipo: "estres", valorNum: n, valorTexto };
  }

  // Negación explícita ("sin estrés") ANTES que ESTRES_MEDIO, que si no matchearía
  // la palabra "estrés" y devolvería 6 (moderado), justo lo opuesto al estado real.
  if (/(?:sin|cero|nada\s+de)\s+(?:estr[eé]s|ansiedad|nervios)/.test(t)) {
    return { tipo: "estres", valorNum: 2, valorTexto };
  }

  if (ESTRES_ALTO.test(t)) return { tipo: "estres", valorNum: 8, valorTexto };
  if (ESTRES_MEDIO.test(t)) return { tipo: "estres", valorNum: 6, valorTexto };
  if (CALMA.test(t)) return { tipo: "estres", valorNum: 2, valorTexto };
  return null;
}

// ── COMIDA ───────────────────────────────────────────────────────────────────
// Solo verbos de comer en PASADO (registro de algo ya hecho): descarta el "como"
// conjunción ("como te decía") y la intención futura ("voy a comer"). Los carbos
// solo se estiman si el usuario los dice EXPLÍCITAMENTE; nada de adivinar (v0).

// Nota: usamos lookbehind/lookahead con clase de vocales acentuadas en vez de
// \b, porque en JS \b es ASCII y NO reconoce "í"/"é"/"ó" como parte de palabra
// (\bcomí\b nunca matchearía). Así "comí" cuenta pero "comida"/"como" no.
const CTX_COMIDA =
  /(?<![a-záéíóúñ])(?:com[ií]|comimos|comi[oó]|almorc[eé]|almorzamos|almorz[oó]|desayun[eé]|desayunamos|desayun[oó]|cen[eé]|cenamos|cen[oó]|merend[eé]|merendamos|piqu[eé]|morf[eé])(?![a-záéíóúñ])/i;

/** Carbohidratos declarados explícitamente por el usuario. Rango [0, 400] g. */
function extraerCarbs(t: string): number | null {
  const m = t.match(
    /(\d{1,3})\s*(?:g|gr|gramos?)?\s*(?:de\s+)?(?:carbohidratos?|carbos?|hidratos?)/
  );
  if (!m) return null;
  const val = parseInt(m[1], 10);
  return val >= 0 && val <= 400 ? val : null;
}

export function detectarComida(texto: string): EventoCapturado | null {
  if (!CTX_COMIDA.test(texto)) return null;
  const carbs = extraerCarbs(texto.toLowerCase());
  const evento: EventoCapturado = {
    tipo: "comida",
    valorNum: null,
    valorTexto: texto.trim(),
  };
  if (carbs !== null) {
    evento.metadatos = { estimacion_carbs: carbs, fuente_estimacion: "usuario" };
  }
  return evento;
}

// ── EJERCICIO ────────────────────────────────────────────────────────────────
// Contexto de actividad física. Los minutos SOLO se toman con unidad de tiempo
// ("40 minutos", "1 hora"→60): "corrí 5 km" NO interpreta 5 como minutos.
// El sedentarismo declarado ("no me moví") se registra con valorNum 0.

const SEDENTARIO = /no\s+me\s+mov[ií]|no\s+me\s+mu[eo]v|no\s+hice\s+nada\s+de\s+f[ií]sic|sedentari/i;

const CTX_EJERCICIO =
  /camin[eé]|caminata|camin[eé]?\s|sal[ií]\s+a\s+caminar|corr[ií]|corri[oó]|trot[eé]|trotar|\bgym\b|gimnasio|entren[eé]|entrenamiento|bici\b|bicicleta|nad[eé]|nataci[oó]n|pesas|f[uú]tbol|\bfutbol\b|jugu[eé]\s+al|yoga|pilates|el[ií]ptico|spinning|crossfit|me\s+mov[ií]|hice\s+ejercicio|hice\s+actividad|sal[ií]\s+a\s+correr/i;

/** Minutos: primero unidad de minutos, si no horas → *60. Null si no hay unidad. */
function extraerMinutos(t: string): number | null {
  const min = t.match(/(\d+)\s*(?:min\b|mins\b|minutos?\b)/);
  if (min) return parseInt(min[1], 10);
  const hr = t.match(/(\d+(?:[.,]\d+)?)\s*(?:horas?\b|hs\b|\bh\b)/);
  if (hr) return Math.round(parseFloat(hr[1].replace(",", ".")) * 60);
  return null;
}

export function detectarEjercicio(texto: string): EventoCapturado | null {
  const t = texto.toLowerCase();
  const valorTexto = texto.trim();
  if (SEDENTARIO.test(t)) return { tipo: "ejercicio", valorNum: 0, valorTexto };
  if (!CTX_EJERCICIO.test(t)) return null;
  return { tipo: "ejercicio", valorNum: extraerMinutos(t), valorTexto };
}

// ── INSULINA ─────────────────────────────────────────────────────────────────
// SOLO registro informativo. Exige DOS señales juntas: (a) un verbo de
// aplicación en PASADO ("me puse", "me apliqué"…) y (b) contexto de insulina.
// Esto excluye por diseño las PREGUNTAS de dosis ("¿cuánta me pongo?") y la
// intención futura ("tengo que ponerme…"). valorNum SIEMPRE null: no se
// interpreta ni se guarda ninguna dosis. Nunca sugiere aplicarse ni cambiar nada.

// Igual que en comida: negative lookahead en vez de \b, porque los verbos
// terminan en vocal acentuada ("apliqué", "inyecté", "pinché") y \b es ASCII.
const APLICACION_PASADO =
  /me\s+(?:puse|apliqu[eé]|inyect[eé]|pinch[eé]|coloqu[eé]|dispar[eé])(?![a-záéíóúñ])|me\s+di(?![a-záéíóúñ])(?!\s+cuenta)/i;

// Los tipos de insulina por adjetivo ("rápida", "lenta", "basal") solo cuentan
// cuando van precedidos de artículo/preposición ("la lenta", "de rápida", "4 de
// basal"). Sueltos son adjetivos comunes ("estuvo lenta", "rápidamente") y
// generarían un registro de insulina falso. Los nombres comerciales y "insulina"
// sí valen por sí mismos.
const CTX_INSULINA =
  /insulina|\bnph\b|lantus|humalog|novorapid|apidra|toujeo|tresiba|levemir|glargina|degludec|unidades\s+de|lapicera|lapicero|(?:de|la|el|una|mi|con)\s+(?:ultrarr[aá]pida|r[aá]pida|lenta|basal)/i;

export function detectarInsulina(texto: string): EventoCapturado | null {
  if (!APLICACION_PASADO.test(texto) || !CTX_INSULINA.test(texto)) return null;
  return {
    tipo: "insulina",
    valorNum: null, // deliberado: cero semántica de dosis
    valorTexto: texto.trim(),
  };
}

// ── AGREGADOR ────────────────────────────────────────────────────────────────

const DETECTORES: readonly ((texto: string) => EventoCapturado | null)[] = [
  detectarSueno,
  detectarEstres,
  detectarComida,
  detectarEjercicio,
  detectarInsulina,
];

/**
 * Corre los cinco detectores de variables sobre un mensaje y devuelve todos los
 * eventos capturados (puede ser 0, 1 o varios). La glucemia NO se incluye acá:
 * vive en su propio carril (detectarGlucosa) por su rol en el pre-filtro de
 * seguridad. Un mensaje como "dormí 5 horas y amanecí en 190" produce un evento
 * de sueño acá y uno de glucemia por el otro carril.
 */
export function detectarEventos(texto: string): EventoCapturado[] {
  const eventos: EventoCapturado[] = [];
  for (const detectar of DETECTORES) {
    const e = detectar(texto);
    if (e) eventos.push(e);
  }
  return eventos;
}

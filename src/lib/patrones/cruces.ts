/**
 * PATRONES CRUZADOS v0 — cálculo DETERMINÍSTICO (paso 8)
 *
 * Relaciones entre DOS variables: una variable de estilo de vida (sueño,
 * estrés) contra la glucemia. Nada de LLM acá: solo aritmética sobre las
 * lecturas. `ahora` se inyecta (determinismo + testeabilidad).
 *
 * ⚠️ ESTO DETECTA CORRELACIÓN, NO CAUSALIDAD. Que dos cosas coincidan no
 * significa que una cause la otra: puede haber un tercer factor, azar, o la
 * relación inversa. Por eso el rigor es innegociable y la comunicación (en
 * contexto.ts) es SIEMPRE una pregunta tentativa, jamás una afirmación causal.
 *
 * Rigor (factor 41), aún más estricto que en los patrones simples:
 *  - ≥5 observaciones (días/noches) en CADA grupo que se compara.
 *  - La diferencia de promedios debe superar un umbral relevante (≥20 mg/dL).
 *  - Con datos escasos o diferencia chica → null (el sistema CALLA). Un patrón
 *    cruzado falso es peor que ningún patrón.
 *
 * Estructura preparada para sumar más cruces: cada cruce arma dos grupos de
 * observaciones y delega el veredicto en `evaluarCruce`.
 */
import {
  confianzaMuestra,
  enVentana,
  fechaLocalKey,
  horaLocal,
  promedio,
  redondear,
} from "./calculo";
import type {
  DetalleCruce,
  FactorCruce,
  GrupoComparado,
  Lectura,
  PatronCruzado,
} from "./tipos";

// ── Constantes de rigor y umbrales (v0, documentadas y tuneables) ────────────
/** Ventana de análisis (misma que los patrones simples). */
const VENTANA_DIAS = 14;
/** Piso de rigor: observaciones mínimas EN CADA grupo comparado. */
const MIN_OBS_CRUCE = 5;
/** Diferencia mínima de promedios para reportar (evita ruido). Menos = ruido. */
const DELTA_CRUCE_MIN = 20;
/** Horas de sueño que separan "poco" (<) de "normal" (≥). */
const UMBRAL_SUENO_HORAS = 6;
/** Escala de estrés ≥ este valor = día de estrés "alto". */
const UMBRAL_ESTRES_ALTO = 7;
/** Escala de estrés ≤ este valor = día de estrés "bajo". El medio (5–6) se excluye. */
const UMBRAL_ESTRES_BAJO = 4;

// ── Helpers de agrupación por día local ──────────────────────────────────────

/** Agrupa valores por clave de día local rioplatense. */
function agruparPorDia(lecturas: Lectura[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const l of lecturas) {
    const k = fechaLocalKey(l.fecha);
    const arr = m.get(k);
    if (arr) arr.push(l.valor);
    else m.set(k, [l.valor]);
  }
  return m;
}

/**
 * Veredicto genérico de un cruce: aplica el rigor (factor 41) sobre dos grupos
 * de observaciones de glucemia y arma el `PatronCruzado`, o devuelve null.
 * `expuesto` es el grupo de interés (poco sueño / estrés alto); `control` el otro.
 */
function evaluarCruce(
  factor: FactorCruce,
  expuesto: number[],
  control: number[],
  armarDetalle: (exp: GrupoComparado, ctrl: GrupoComparado) => DetalleCruce
): PatronCruzado | null {
  if (expuesto.length < MIN_OBS_CRUCE || control.length < MIN_OBS_CRUCE) return null;

  const pExp = promedio(expuesto);
  const pCtrl = promedio(control);
  const delta = pExp - pCtrl;
  if (Math.abs(delta) < DELTA_CRUCE_MIN) return null;

  const exp: GrupoComparado = { promedio: redondear(pExp), n: expuesto.length };
  const ctrl: GrupoComparado = { promedio: redondear(pCtrl), n: control.length };

  return {
    factor,
    efectoEstimado: redondear(delta),
    nObservaciones: expuesto.length + control.length,
    confianza: confianzaMuestra(Math.min(expuesto.length, control.length)),
    detalle: armarDetalle(exp, ctrl),
  };
}

// ── Cruce 1: sueno_vs_amanecer ────────────────────────────────────────────────
/**
 * Compara la glucemia del amanecer (5–9 h local) según cuánto durmió la persona.
 *
 * Unidad de observación: un DÍA local que tenga (a) sueño con horas conocidas y
 * (b) al menos una glucemia de amanecer. Emparejamiento (v0, documentado): el
 * sueño reportado un día se cruza con el amanecer de ESE MISMO día local. Los
 * verbos de sueño son siempre pasado ("dormí 4 h"), así que reportar de mañana
 * (sobre la noche que pasó) o de noche (sobre la noche anterior) cae en el
 * mismo día calendario que su amanecer. Sin par día→mañana, la observación no
 * cuenta. Reporta solo con ≥5 días en cada grupo y diferencia ≥20 mg/dL.
 */
export function suenoVsAmanecer(
  glucemias: Lectura[],
  sueno: Lectura[],
  ahora: Date
): PatronCruzado | null {
  const g = enVentana(glucemias, ahora, VENTANA_DIAS);
  const s = enVentana(sueno, ahora, VENTANA_DIAS);

  // Horas de sueño por día (promedio si hubo varias menciones el mismo día).
  const horasPorDia = new Map<string, number>();
  for (const [dia, horas] of agruparPorDia(s)) {
    horasPorDia.set(dia, promedio(horas));
  }

  // Glucemia de amanecer (5–9 h local) por día.
  const amanecerPorDia = agruparPorDia(
    g.filter((l) => {
      const h = horaLocal(l.fecha);
      return h >= 5 && h < 9;
    })
  );

  const poco: number[] = [];
  const normal: number[] = [];
  for (const [dia, horas] of horasPorDia) {
    const amaneceres = amanecerPorDia.get(dia);
    if (!amaneceres || amaneceres.length === 0) continue; // sin par día→mañana
    const gluAmanecer = promedio(amaneceres);
    if (horas < UMBRAL_SUENO_HORAS) poco.push(gluAmanecer);
    else normal.push(gluAmanecer);
  }

  return evaluarCruce("sueno_vs_amanecer", poco, normal, (exp, ctrl) => ({
    pocoSueno: exp,
    suenoNormal: ctrl,
    umbralHoras: UMBRAL_SUENO_HORAS,
  }));
}

// ── Cruce 2: estres_vs_glucemia ───────────────────────────────────────────────
/**
 * Compara la glucemia promedio del día según el nivel de estrés de ese día.
 *
 * Unidad de observación: un DÍA local con (a) estrés con escala conocida y (b)
 * al menos una glucemia. El día es "alto" si el MÁXIMO de estrés del día ≥7, y
 * "bajo" si el máximo ≤4. El estrés medio (5–6) se EXCLUYE a propósito: sin
 * separación clara entre grupos, la comparación es ruido. Reporta solo con ≥5
 * días en cada grupo y diferencia ≥20 mg/dL.
 */
export function estresVsGlucemia(
  glucemias: Lectura[],
  estres: Lectura[],
  ahora: Date
): PatronCruzado | null {
  const g = enVentana(glucemias, ahora, VENTANA_DIAS);
  const e = enVentana(estres, ahora, VENTANA_DIAS);

  const estresPorDia = agruparPorDia(e);
  const glucemiaPorDia = agruparPorDia(g);

  const alto: number[] = [];
  const bajo: number[] = [];
  for (const [dia, escalas] of estresPorDia) {
    const glu = glucemiaPorDia.get(dia);
    if (!glu || glu.length === 0) continue; // día sin glucemia no cuenta
    const gluDia = promedio(glu);
    const maxEstres = Math.max(...escalas);
    if (maxEstres >= UMBRAL_ESTRES_ALTO) alto.push(gluDia);
    else if (maxEstres <= UMBRAL_ESTRES_BAJO) bajo.push(gluDia);
    // else: día de estrés medio (5–6) → se descarta.
  }

  return evaluarCruce("estres_vs_glucemia", alto, bajo, (exp, ctrl) => ({
    estresAlto: exp,
    estresBajo: ctrl,
  }));
}

// ── Orquestación ──────────────────────────────────────────────────────────────
/**
 * Calcula todos los cruces vigentes. Barato de correr por mensaje (sin cron).
 * Los que no aplican (datos escasos / diferencia chica) se descartan (null).
 */
export function calcularCruces(
  glucemias: Lectura[],
  sueno: Lectura[],
  estres: Lectura[],
  ahora: Date = new Date()
): PatronCruzado[] {
  const candidatos = [
    suenoVsAmanecer(glucemias, sueno, ahora),
    estresVsGlucemia(glucemias, estres, ahora),
  ];
  return candidatos.filter((c): c is PatronCruzado => c !== null);
}

/**
 * PATRONES TEMPORALES v0 — tipos (paso 6)
 *
 * Detección DETERMINÍSTICA de patrones sobre las glucemias del usuario.
 * La matemática vive en calculo.ts (sin LLM). El LLM solo comunica.
 */

/** Los cuatro patrones de v0. */
export type FactorPatron =
  | "amanecer_alto"
  | "franja_problematica"
  | "tendencia_semanal"
  | "hipos_recurrentes";

/** Una lectura de glucemia normalizada desde `evento`. */
export interface Lectura {
  /** mg/dL */
  valor: number;
  /** Momento de la medición (equivale a `ocurrido_en`). */
  fecha: Date;
}

/** Franjas horarias (hora local rioplatense). */
export type FranjaHoraria = "madrugada" | "mañana" | "tarde" | "noche";

/**
 * Dirección de la tendencia semanal. NEUTRA a propósito: no decimos
 * "mejora/empeora" en el dato (sería un veredicto clínico). El matiz cálido
 * lo pone Gluco en la comunicación, no la tabla. La memoria contiene, no juzga.
 */
export type DireccionTendencia = "baja" | "sube" | "estable";

export interface DetalleAmanecer {
  promedioAmanecer: number;
  promedioResto: number;
}

export interface DetalleFranja {
  franja: FranjaHoraria;
  promedio: number;
  /** Fracción [0,1] de lecturas de la franja por encima de 180. */
  proporcionAlta: number;
}

export interface DetalleTendencia {
  direccion: DireccionTendencia;
  promedioReciente: number;
  promedioPrevio: number;
  nReciente: number;
  nPrevio: number;
}

export interface DetalleHipos {
  cantidad: number;
  ventanaDias: number;
}

export type DetallePatron =
  | DetalleAmanecer
  | DetalleFranja
  | DetalleTendencia
  | DetalleHipos;

/** Un patrón detectado, ya con su rigor estadístico adjunto. */
export interface Patron {
  factor: FactorPatron;
  /** Magnitud del efecto (unidad según el factor). */
  efectoEstimado: number;
  /** Cuántas lecturas respaldan el patrón (factor 41). */
  nObservaciones: number;
  /** Robustez por tamaño de muestra [0,1]. Proxy v0, NO es un p-value. */
  confianza: number;
  detalle: DetallePatron;
}

// ── PATRONES CRUZADOS v0 (paso 8) ────────────────────────────────────────────
// Relación observada entre DOS variables (una variable vs. la glucemia). El
// cálculo es determinístico (cruces.ts, sin LLM). CRÍTICO: esto detecta
// CORRELACIÓN, no causalidad; la comunicación es SIEMPRE una pregunta tentativa.

/** Los cruces de v0. Estructura pensada para sumar más después. */
export type FactorCruce = "sueno_vs_amanecer" | "estres_vs_glucemia";

/** Un grupo comparado dentro de un cruce (ej. "noches de poco sueño"). */
export interface GrupoComparado {
  /** Promedio de glucemia del grupo (mg/dL). */
  promedio: number;
  /** Nº de observaciones (días/noches) en el grupo. Rigor: factor 41. */
  n: number;
}

export interface DetalleSuenoAmanecer {
  /** Amanecer tras noches por debajo del umbral de horas. */
  pocoSueno: GrupoComparado;
  /** Amanecer tras noches de sueño ≥ umbral de horas. */
  suenoNormal: GrupoComparado;
  /** Umbral de horas que separa "poco" de "normal" (v0: 6 h). */
  umbralHoras: number;
}

export interface DetalleEstresGlucemia {
  /** Glucemia promedio de los días de estrés alto. */
  estresAlto: GrupoComparado;
  /** Glucemia promedio de los días de estrés bajo. */
  estresBajo: GrupoComparado;
}

export type DetalleCruce = DetalleSuenoAmanecer | DetalleEstresGlucemia;

/**
 * Un patrón cruzado detectado. Comparte forma con `Patron` (mismos campos de
 * rigor) a propósito: así persiste en la misma tabla `patron` por la misma vía
 * RLS. `efectoEstimado` es la diferencia de promedios (grupo expuesto − control).
 */
export interface PatronCruzado {
  factor: FactorCruce;
  /** Diferencia de promedios (expuesto − control), mg/dL. Puede ser negativa. */
  efectoEstimado: number;
  /** Total de observaciones en ambos grupos. */
  nObservaciones: number;
  /** Robustez por tamaño de muestra [0,1]. Proxy v0, NO es un p-value. */
  confianza: number;
  detalle: DetalleCruce;
}

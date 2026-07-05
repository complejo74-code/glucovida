/**
 * PATRONES TEMPORALES v0 — cálculo DETERMINÍSTICO (paso 6)
 *
 * Nada de LLM acá: solo aritmética sobre las lecturas. Cada función recibe
 * `ahora` de forma explícita (testeabilidad + determinismo). El rigor
 * estadístico (factor 41) es innegociable: ningún patrón conversacional se
 * reporta sin ≥5 lecturas en cada grupo que compara. Con pocos datos → null.
 * Un patrón falso es peor que ningún patrón.
 */
import type {
  DireccionTendencia,
  FranjaHoraria,
  Lectura,
  Patron,
} from "./tipos";

// ── Constantes de rigor y umbrales (v0, documentadas y tuneables) ────────────
/** Piso de rigor: lecturas mínimas por grupo para reportar un patrón de charla. */
const MIN_LECTURAS = 5;
/** Ventana principal de análisis. */
const VENTANA_DIAS = 14;
/** n para el que la confianza por muestra satura en 1 (heurística v0). */
const N_PLENO = 12;
/** Diferencia mínima amanecer−resto para reportar (evita ruido). */
const DELTA_AMANECER_MIN = 25;
/** Umbral de glucemia alta (mg/dL). */
const UMBRAL_ALTA = 180;
/** Fracción de lecturas altas para considerar una franja "consistentemente alta". */
const PROP_CONSISTENTE = 0.6;
/** Diferencia semanal por debajo de la cual la tendencia es "estable". */
const UMBRAL_ESTABLE = 10;
/** Umbral de hipoglucemia (mg/dL). */
const UMBRAL_HIPO = 70;
/** Cantidad de hipos en la ventana que dispara "recurrentes". */
const HIPOS_MIN = 2;

const MS_DIA = 86_400_000;

// ── Helpers puros ────────────────────────────────────────────────────────────

/** Zona horaria de referencia (rioplatense). Buenos Aires = Montevideo = UTC−3. */
const ZONA = "America/Argentina/Buenos_Aires";
const fmtHora = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONA,
  hour: "2-digit",
  hourCycle: "h23",
});

/**
 * Hora local rioplatense [0,23] de una fecha UTC. Imprescindible: `ocurrido_en`
 * se guarda en UTC y el server corre en UTC; sin esto "amanecer" saldría corrido.
 */
export function horaLocal(fecha: Date): number {
  const h = parseInt(fmtHora.format(fecha), 10);
  return Number.isNaN(h) ? fecha.getUTCHours() : h % 24;
}

function promedio(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function redondear(n: number, dec = 2): number {
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}

/** Confianza por tamaño de muestra: crece con n y satura en 1 (proxy v0). */
function confianzaMuestra(n: number): number {
  return redondear(Math.min(1, n / N_PLENO));
}

/** Lecturas dentro de [ahora − dias, ahora]. */
function enVentana(lecturas: Lectura[], ahora: Date, dias: number): Lectura[] {
  const ahoraMs = ahora.getTime();
  const desde = ahoraMs - dias * MS_DIA;
  return lecturas.filter((l) => {
    const t = l.fecha.getTime();
    return t <= ahoraMs && t >= desde;
  });
}

/** Franja horaria a partir de la hora local. */
function franjaDe(hora: number): FranjaHoraria {
  if (hora < 6) return "madrugada";
  if (hora < 12) return "mañana";
  if (hora < 18) return "tarde";
  return "noche";
}

const ORDEN_FRANJAS: readonly FranjaHoraria[] = [
  "madrugada",
  "mañana",
  "tarde",
  "noche",
];

// ── Patrón 1: amanecer_alto ──────────────────────────────────────────────────
/**
 * Compara el promedio de las lecturas de amanecer (hora local 5–9h) contra el
 * resto del día, ventana 14 días. Reporta solo si el amanecer está ≥25 mg/dL
 * más alto y hay ≥5 lecturas en CADA grupo.
 */
export function amanecerAlto(lecturas: Lectura[], ahora: Date): Patron | null {
  const v = enVentana(lecturas, ahora, VENTANA_DIAS);
  const amanecer = v.filter((l) => {
    const h = horaLocal(l.fecha);
    return h >= 5 && h < 9;
  });
  const resto = v.filter((l) => {
    const h = horaLocal(l.fecha);
    return h < 5 || h >= 9;
  });

  if (amanecer.length < MIN_LECTURAS || resto.length < MIN_LECTURAS) return null;

  const pa = promedio(amanecer.map((l) => l.valor));
  const pr = promedio(resto.map((l) => l.valor));
  const delta = pa - pr;
  if (delta < DELTA_AMANECER_MIN) return null;

  return {
    factor: "amanecer_alto",
    efectoEstimado: redondear(delta),
    nObservaciones: amanecer.length + resto.length,
    confianza: confianzaMuestra(Math.min(amanecer.length, resto.length)),
    detalle: {
      promedioAmanecer: redondear(pa),
      promedioResto: redondear(pr),
    },
  };
}

// ── Patrón 2: franja_problematica ────────────────────────────────────────────
/**
 * Busca la franja horaria (madrugada/mañana/tarde/noche) donde las lecturas
 * superan 180 de forma consistente (≥60%), ventana 14 días, ≥5 lecturas en la
 * franja. Devuelve la peor franja o null.
 */
export function franjaProblematica(
  lecturas: Lectura[],
  ahora: Date
): Patron | null {
  const v = enVentana(lecturas, ahora, VENTANA_DIAS);

  const grupos = new Map<FranjaHoraria, number[]>();
  for (const l of v) {
    const f = franjaDe(horaLocal(l.fecha));
    const arr = grupos.get(f) ?? [];
    arr.push(l.valor);
    grupos.set(f, arr);
  }

  let mejor: {
    franja: FranjaHoraria;
    promedio: number;
    proporcionAlta: number;
    n: number;
  } | null = null;

  for (const franja of ORDEN_FRANJAS) {
    const valores = grupos.get(franja);
    if (!valores || valores.length < MIN_LECTURAS) continue;
    const altas = valores.filter((val) => val > UMBRAL_ALTA).length;
    const proporcionAlta = altas / valores.length;
    if (proporcionAlta < PROP_CONSISTENTE) continue;

    const prom = promedio(valores);
    // Peor franja = mayor proporción de lecturas altas; desempate por promedio.
    if (
      mejor === null ||
      proporcionAlta > mejor.proporcionAlta ||
      (proporcionAlta === mejor.proporcionAlta && prom > mejor.promedio)
    ) {
      mejor = { franja, promedio: prom, proporcionAlta, n: valores.length };
    }
  }

  if (mejor === null) return null;

  return {
    factor: "franja_problematica",
    efectoEstimado: redondear(mejor.promedio),
    nObservaciones: mejor.n,
    confianza: confianzaMuestra(mejor.n),
    detalle: {
      franja: mejor.franja,
      promedio: redondear(mejor.promedio),
      proporcionAlta: redondear(mejor.proporcionAlta),
    },
  };
}

// ── Patrón 3: tendencia_semanal ──────────────────────────────────────────────
/**
 * Compara el promedio de los últimos 7 días contra el de los 7 anteriores.
 * Dirección NEUTRA (baja/sube/estable): el dato no dictamina "mejora/empeora".
 * Requiere ≥5 lecturas en cada semana.
 */
export function tendenciaSemanal(
  lecturas: Lectura[],
  ahora: Date
): Patron | null {
  const ahoraMs = ahora.getTime();
  const corte7 = ahoraMs - 7 * MS_DIA;
  const corte14 = ahoraMs - 14 * MS_DIA;

  const reciente: number[] = [];
  const previa: number[] = [];
  for (const l of lecturas) {
    const t = l.fecha.getTime();
    if (t > corte7 && t <= ahoraMs) reciente.push(l.valor);
    else if (t > corte14 && t <= corte7) previa.push(l.valor);
  }

  if (reciente.length < MIN_LECTURAS || previa.length < MIN_LECTURAS) return null;

  const pReciente = promedio(reciente);
  const pPrevia = promedio(previa);
  const delta = pReciente - pPrevia;

  let direccion: DireccionTendencia;
  if (Math.abs(delta) < UMBRAL_ESTABLE) direccion = "estable";
  else direccion = delta < 0 ? "baja" : "sube";

  return {
    factor: "tendencia_semanal",
    efectoEstimado: redondear(delta),
    nObservaciones: reciente.length + previa.length,
    confianza: confianzaMuestra(Math.min(reciente.length, previa.length)),
    detalle: {
      direccion,
      promedioReciente: redondear(pReciente),
      promedioPrevio: redondear(pPrevia),
      nReciente: reciente.length,
      nPrevio: previa.length,
    },
  };
}

// ── Patrón 4: hipos_recurrentes (excepción al piso de 5) ─────────────────────
/**
 * Cuenta lecturas < 70 en 14 días. 2+ disparan el patrón. NO pasa por el piso
 * de 5 lecturas: 2 hipos son señal aunque haya pocos datos totales (mismo
 * criterio asimétrico que el pre-filtro de emergencia). Este patrón no es "de
 * charla": la comunicación siempre invita a llevarlo al equipo médico.
 */
export function hiposRecurrentes(
  lecturas: Lectura[],
  ahora: Date
): Patron | null {
  const v = enVentana(lecturas, ahora, VENTANA_DIAS);
  const cantidad = v.filter((l) => l.valor < UMBRAL_HIPO).length;
  if (cantidad < HIPOS_MIN) return null;

  return {
    factor: "hipos_recurrentes",
    efectoEstimado: cantidad,
    nObservaciones: cantidad,
    confianza: redondear(Math.min(1, cantidad / (HIPOS_MIN * 2))),
    detalle: { cantidad, ventanaDias: VENTANA_DIAS },
  };
}

// ── Orquestación ─────────────────────────────────────────────────────────────
/**
 * Calcula todos los patrones vigentes del usuario. Orden fijo; se descartan los
 * que no aplican (null). Barato de correr por cada mensaje (sin cron).
 */
export function calcularPatrones(
  lecturas: Lectura[],
  ahora: Date = new Date()
): Patron[] {
  const candidatos = [
    amanecerAlto(lecturas, ahora),
    franjaProblematica(lecturas, ahora),
    tendenciaSemanal(lecturas, ahora),
    hiposRecurrentes(lecturas, ahora),
  ];
  return candidatos.filter((p): p is Patron => p !== null);
}

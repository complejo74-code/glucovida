import { describe, expect, test } from "vitest";
import { suenoVsAmanecer, estresVsGlucemia, calcularCruces } from "@/lib/patrones/cruces";
import { construirContextoPatrones } from "@/lib/patrones/contexto";
import type {
  DetalleEstresGlucemia,
  DetalleSuenoAmanecer,
  Lectura,
  Patron,
  PatronCruzado,
} from "@/lib/patrones/tipos";

/**
 * Contrato de patrones CRUZADOS v0 (paso 8):
 * - Matemática DETERMINÍSTICA, `ahora` inyectado (nada de new Date() interno).
 * - Rigor (factor 41): ≥5 observaciones en CADA grupo Y diferencia ≥20 mg/dL;
 *   si no, el sistema CALLA (null). Un patrón falso es peor que ningún patrón.
 * - Esto detecta CORRELACIÓN, no causalidad. La comunicación es SIEMPRE una
 *   pregunta tentativa, nunca una afirmación causal.
 * - Zona horaria: los días se agrupan en local rioplatense (Buenos Aires, UTC−3).
 */

/** Lectura a una hora LOCAL de Buenos Aires (UTC−3), independiente del TZ del runner. */
function fechaAr(y: number, mesIndex: number, d: number, horaLocal: number, min = 0): Date {
  return new Date(Date.UTC(y, mesIndex, d, horaLocal + 3, min));
}

function lectura(valor: number, fecha: Date): Lectura {
  return { valor, fecha };
}

// Ahora fijo: 5 de julio de 2026, 12:00 hora de Buenos Aires.
const AHORA = fechaAr(2026, 6, 5, 12, 0);

// Diez días locales dentro de la ventana de 14 días, TODOS completos antes del
// mediodía de AHORA (Jun 25 … Jul 4): así los eventos de tarde no caen en el futuro.
const DIAS: ReadonlyArray<[number, number]> = [
  [5, 25],
  [5, 26],
  [5, 27],
  [5, 28],
  [5, 29],
  [5, 30],
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
];

/** Construye lecturas de amanecer (7:00 local) con un valor por día. */
function amaneceres(valores: number[]): Lectura[] {
  return valores.map((v, i) => lectura(v, fechaAr(2026, DIAS[i][0], DIAS[i][1], 7)));
}

/** Construye eventos de sueño (10:00 local) con horas por día. */
function suenos(horas: number[]): Lectura[] {
  return horas.map((h, i) => lectura(h, fechaAr(2026, DIAS[i][0], DIAS[i][1], 10)));
}

/** Construye glucemias diurnas (13:00 local) con un valor por día. */
function glucemiasDiarias(valores: number[]): Lectura[] {
  return valores.map((v, i) => lectura(v, fechaAr(2026, DIAS[i][0], DIAS[i][1], 13)));
}

/** Construye eventos de estrés (16:00 local) con escala por día. */
function estreses(escalas: number[]): Lectura[] {
  return escalas.map((e, i) => lectura(e, fechaAr(2026, DIAS[i][0], DIAS[i][1], 16)));
}

// ────────────────────────────────────────────────────────────────────────────
// sueno_vs_amanecer
// ────────────────────────────────────────────────────────────────────────────
describe("sueno_vs_amanecer", () => {
  test("correlación clara + datos suficientes → reporta la diferencia", () => {
    // 5 noches de poco sueño (4 h) con amanecer alto; 5 de sueño normal (8 h) más bajo.
    const sueno = suenos([4, 4, 4, 4, 4, 8, 8, 8, 8, 8]);
    const glucemias = amaneceres([190, 195, 185, 200, 192, 140, 145, 150, 138, 142]);

    const p = suenoVsAmanecer(glucemias, sueno, AHORA);
    expect(p).not.toBeNull();
    expect(p?.factor).toBe("sueno_vs_amanecer");
    // Diferencia = amanecer poco-sueño (192.4) − sueño-normal (143) ≈ 49.4
    expect(p?.efectoEstimado).toBeCloseTo(49.4, 1);
    const d = p?.detalle as DetalleSuenoAmanecer;
    expect(d.pocoSueno.n).toBe(5);
    expect(d.suenoNormal.n).toBe(5);
    expect(d.pocoSueno.promedio).toBeCloseTo(192.4, 1);
    expect(d.suenoNormal.promedio).toBe(143);
    expect(d.umbralHoras).toBe(6);
    expect(p?.nObservaciones).toBe(10);
  });

  test("correlación pero datos insuficientes (4 noches de poco sueño) → calla", () => {
    const sueno = suenos([4, 4, 4, 4, 8, 8, 8, 8, 8, 8]); // solo 4 de poco sueño
    const glucemias = amaneceres([190, 195, 185, 200, 140, 145, 150, 138, 142, 141]);
    expect(suenoVsAmanecer(glucemias, sueno, AHORA)).toBeNull();
  });

  test("datos suficientes pero diferencia chica (<20 mg/dL) → calla", () => {
    const sueno = suenos([4, 4, 4, 4, 4, 8, 8, 8, 8, 8]);
    const glucemias = amaneceres([150, 152, 148, 151, 149, 145, 143, 146, 144, 142]);
    expect(suenoVsAmanecer(glucemias, sueno, AHORA)).toBeNull();
  });

  test("datos contradictorios (promedios casi iguales) → calla", () => {
    const sueno = suenos([4, 4, 4, 4, 4, 8, 8, 8, 8, 8]);
    // Poco sueño mezcla alto y bajo → promedio ~180; normal también ~180.
    const glucemias = amaneceres([100, 260, 110, 250, 180, 180, 178, 182, 179, 181]);
    expect(suenoVsAmanecer(glucemias, sueno, AHORA)).toBeNull();
  });

  test("noches sin amanecer registrado no cuentan (no hay par día→mañana)", () => {
    // 5 noches de poco sueño pero sus glucemias son de la tarde (no amanecer) → sin pares.
    const sueno = suenos([4, 4, 4, 4, 4, 8, 8, 8, 8, 8]);
    const glucemias = [
      ...[0, 1, 2, 3, 4].map((i) => lectura(190, fechaAr(2026, DIAS[i][0], DIAS[i][1], 15))),
      ...amaneceres([0, 0, 0, 0, 0, 140, 145, 150, 138, 142]).slice(5),
    ];
    expect(suenoVsAmanecer(glucemias, sueno, AHORA)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// estres_vs_glucemia
// ────────────────────────────────────────────────────────────────────────────
describe("estres_vs_glucemia", () => {
  test("correlación clara + datos suficientes → reporta la diferencia", () => {
    // 5 días de estrés alto (8) con glucemia alta; 5 de estrés bajo (2) más baja.
    const estres = estreses([8, 8, 8, 8, 8, 2, 2, 2, 2, 2]);
    const glucemias = glucemiasDiarias([185, 190, 180, 188, 182, 140, 142, 138, 145, 141]);

    const p = estresVsGlucemia(glucemias, estres, AHORA);
    expect(p).not.toBeNull();
    expect(p?.factor).toBe("estres_vs_glucemia");
    // Diferencia = alto (185) − bajo (141.2) ≈ 43.8
    expect(p?.efectoEstimado).toBeCloseTo(43.8, 1);
    const d = p?.detalle as DetalleEstresGlucemia;
    expect(d.estresAlto.n).toBe(5);
    expect(d.estresBajo.n).toBe(5);
    expect(d.estresAlto.promedio).toBe(185);
    expect(d.estresBajo.promedio).toBeCloseTo(141.2, 1);
  });

  test("los días de estrés medio (5–6) se excluyen; no desvían los grupos", () => {
    // Igual que el caso claro pero con 2 días medios (6) de glucemia extrema.
    const estres = estreses([8, 8, 8, 8, 8, 2, 2, 2, 2, 2]);
    const glucemias = glucemiasDiarias([185, 190, 180, 188, 182, 140, 142, 138, 145, 141]);
    // Días medios (escala 6) FUERA de DIAS, con glucemia extrema: no deben entrar.
    const conMedios: Lectura[] = [
      ...estres,
      lectura(6, fechaAr(2026, 5, 22, 16)),
      lectura(6, fechaAr(2026, 5, 23, 16)),
    ];
    const gluMedios: Lectura[] = [
      ...glucemias,
      lectura(400, fechaAr(2026, 5, 22, 13)),
      lectura(400, fechaAr(2026, 5, 23, 13)),
    ];
    const p = estresVsGlucemia(gluMedios, conMedios, AHORA);
    // El día medio (400 mg/dL) NO debe entrar en ningún grupo.
    const d = p?.detalle as DetalleEstresGlucemia;
    expect(d.estresAlto.promedio).toBe(185);
    expect(d.estresBajo.promedio).toBeCloseTo(141.2, 1);
  });

  test("correlación pero datos insuficientes (4 días de estrés alto) → calla", () => {
    const estres = estreses([8, 8, 8, 8, 2, 2, 2, 2, 2, 2]);
    const glucemias = glucemiasDiarias([185, 190, 180, 188, 140, 142, 138, 145, 141, 143]);
    expect(estresVsGlucemia(glucemias, estres, AHORA)).toBeNull();
  });

  test("datos suficientes pero diferencia chica (<20 mg/dL) → calla", () => {
    const estres = estreses([8, 8, 8, 8, 8, 2, 2, 2, 2, 2]);
    const glucemias = glucemiasDiarias([150, 152, 148, 151, 149, 145, 143, 146, 144, 142]);
    expect(estresVsGlucemia(glucemias, estres, AHORA)).toBeNull();
  });

  test("datos contradictorios (promedios casi iguales) → calla", () => {
    const estres = estreses([8, 8, 8, 8, 8, 2, 2, 2, 2, 2]);
    const glucemias = glucemiasDiarias([100, 270, 110, 260, 160, 180, 178, 182, 179, 181]);
    expect(estresVsGlucemia(glucemias, estres, AHORA)).toBeNull();
  });

  test("días de estrés sin glucemia ese día no cuentan", () => {
    const estres = estreses([8, 8, 8, 8, 8, 2, 2, 2, 2, 2]);
    // Solo 4 días altos y 5 bajos TIENEN glucemia (el 5º alto queda en 0/sin par).
    const glucemias = [
      ...glucemiasDiarias([185, 190, 180, 188, 0, 140, 142, 138, 145, 141]).filter(
        (_, i) => i !== 4
      ),
    ];
    expect(estresVsGlucemia(glucemias, estres, AHORA)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// calcularCruces (orquestación)
// ────────────────────────────────────────────────────────────────────────────
describe("calcularCruces", () => {
  test("sin datos → arreglo vacío", () => {
    expect(calcularCruces([], [], [], AHORA)).toEqual([]);
  });

  test("devuelve ambos cruces cuando ambos aplican", () => {
    const sueno = suenos([4, 4, 4, 4, 4, 8, 8, 8, 8, 8]);
    const amanecer = amaneceres([190, 195, 185, 200, 192, 140, 145, 150, 138, 142]);
    const estres = estreses([8, 8, 8, 8, 8, 2, 2, 2, 2, 2]);
    const gluDiaria = glucemiasDiarias([185, 190, 180, 188, 182, 140, 142, 138, 145, 141]);
    const glucemias = [...amanecer, ...gluDiaria];

    const factores = calcularCruces(glucemias, sueno, estres, AHORA).map((c) => c.factor);
    expect(factores).toContain("sueno_vs_amanecer");
    expect(factores).toContain("estres_vs_glucemia");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Comunicación tentativa (nunca causal) + selección unificada (máx. 1 patrón)
// ────────────────────────────────────────────────────────────────────────────
const CRUCE_SUENO: PatronCruzado = {
  factor: "sueno_vs_amanecer",
  efectoEstimado: 49.4,
  nObservaciones: 10,
  confianza: 0.9,
  detalle: {
    pocoSueno: { promedio: 192, n: 5 },
    suenoNormal: { promedio: 143, n: 5 },
    umbralHoras: 6,
  },
};

const CRUCE_ESTRES: PatronCruzado = {
  factor: "estres_vs_glucemia",
  efectoEstimado: 44,
  nObservaciones: 10,
  confianza: 0.5,
  detalle: {
    estresAlto: { promedio: 185, n: 5 },
    estresBajo: { promedio: 141, n: 5 },
  },
};

/** Lenguaje causal PROHIBIDO en cualquier bloque cruzado. */
const LENGUAJE_CAUSAL = /te sube|te baja|te causa|te provoca|causa|provoca|por culpa|hace que/i;

describe("comunicación de cruces (tentativa, jamás causal)", () => {
  test("el bloque cruzado es una pregunta y recomienda al médico/a", () => {
    const texto = construirContextoPatrones([], [CRUCE_SUENO]);
    expect(texto).not.toBe("");
    expect(texto).toContain("¿");
    expect(texto.toLowerCase()).toContain("médic");
  });

  test("nunca usa lenguaje causal, sí lenguaje asociativo", () => {
    const texto = construirContextoPatrones([], [CRUCE_SUENO]).toLowerCase();
    expect(texto).not.toMatch(LENGUAJE_CAUSAL);
    expect(texto).toMatch(/coincid|los días que|las noches que/);
  });

  test("deja explícito que es correlación y no diagnóstico", () => {
    const texto = construirContextoPatrones([], [CRUCE_ESTRES]).toLowerCase();
    expect(texto).toContain("correlación");
    expect(texto).toContain("no es diagnóstico");
  });
});

describe("selección unificada: máximo UN patrón entre simples y cruzados", () => {
  const simpleAmanecer: Patron = {
    factor: "amanecer_alto",
    efectoEstimado: 50,
    nObservaciones: 10,
    confianza: 0.42,
    detalle: { promedioAmanecer: 190, promedioResto: 140 },
  };

  test("gana el cruce si tiene mayor confianza que el simple", () => {
    const texto = construirContextoPatrones([simpleAmanecer], [CRUCE_SUENO]); // 0.42 vs 0.9
    // Aparece el cruce (pregunta) y NO el simple (que no es pregunta tentativa).
    expect(texto).toContain("¿");
    expect(texto.toLowerCase()).toContain("dorm");
    // Un solo bloque conversacional: no aparecen los dos.
    expect(texto.toLowerCase()).not.toContain("resto del día");
  });

  test("gana el simple si tiene mayor confianza que el cruce", () => {
    const simpleFuerte: Patron = { ...simpleAmanecer, confianza: 0.95 };
    const texto = construirContextoPatrones([simpleFuerte], [CRUCE_ESTRES]); // 0.95 vs 0.5
    expect(texto.toLowerCase()).toContain("amanecer");
    // No aparece el bloque de estrés.
    expect(texto.toLowerCase()).not.toContain("estrés");
  });

  test("hipos (seguridad) SIEMPRE aparece, además del único patrón conversacional", () => {
    const hipos: Patron = {
      factor: "hipos_recurrentes",
      efectoEstimado: 2,
      nObservaciones: 2,
      confianza: 0.5,
      detalle: { cantidad: 2, ventanaDias: 14 },
    };
    const texto = construirContextoPatrones([hipos], [CRUCE_SUENO]);
    expect(texto.toLowerCase()).toContain("70 mg/dl"); // bloque de hipos
    expect(texto).toContain("¿"); // bloque cruzado (pregunta tentativa)
  });
});

// ────────────────────────────────────────────────────────────────────────────
// DEMO: patrón cruzado calculado sobre datos sintéticos + comunicación
// ────────────────────────────────────────────────────────────────────────────
describe("DEMO patrón cruzado sobre datos sintéticos", () => {
  test("imprime el cruce calculado y su comunicación tentativa", () => {
    const sueno = suenos([4, 5, 4, 3, 5, 8, 7, 8, 9, 7]);
    const glucemias = amaneceres([188, 196, 184, 205, 191, 141, 146, 149, 137, 143]);

    const cruces = calcularCruces(glucemias, sueno, [], AHORA);
    const comunicacion = construirContextoPatrones([], cruces);

    console.log("\n=== PATRÓN CRUZADO (determinístico) ===\n" + JSON.stringify(cruces, null, 2));
    console.log("\n=== COMUNICACIÓN TENTATIVA (contexto privado) ===\n" + comunicacion + "\n");

    expect(cruces.length).toBe(1);
    expect(cruces[0].factor).toBe("sueno_vs_amanecer");
  });
});

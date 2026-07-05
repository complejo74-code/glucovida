import { describe, expect, test } from "vitest";
import {
  amanecerAlto,
  franjaProblematica,
  tendenciaSemanal,
  hiposRecurrentes,
  calcularPatrones,
} from "@/lib/patrones/calculo";
import {
  seleccionarConversacional,
  construirContextoPatrones,
} from "@/lib/patrones/contexto";
import type { Lectura, Patron } from "@/lib/patrones/tipos";

/**
 * Contrato de patrones v0 (paso 6):
 * - Matemática DETERMINÍSTICA, `ahora` inyectado (nada de new Date() interno).
 * - Rigor (factor 41): ningún patrón conversacional sin ≥5 lecturas por grupo.
 * - hipos_recurrentes es la excepción: 2+ hipos disparan aunque haya pocos datos.
 * - Zona horaria: las horas se leen en local rioplatense (America/Argentina/Buenos_Aires).
 */

/** Construye una lectura a una hora LOCAL de Buenos Aires (UTC−3), TZ-independiente. */
function fechaAr(
  y: number,
  mesIndex: number,
  d: number,
  horaLocal: number,
  min = 0
): Date {
  return new Date(Date.UTC(y, mesIndex, d, horaLocal + 3, min));
}

function lectura(valor: number, fecha: Date): Lectura {
  return { valor, fecha };
}

// Ahora fijo: 5 de julio de 2026, 12:00 hora de Buenos Aires.
const AHORA = fechaAr(2026, 6, 5, 12, 0);

// ────────────────────────────────────────────────────────────────────────────
// amanecer_alto
// ────────────────────────────────────────────────────────────────────────────
describe("amanecer_alto", () => {
  test("datos suficientes y efecto real → reporta la diferencia", () => {
    const lecturas: Lectura[] = [
      // 5 lecturas en amanecer (7:00 local), altas
      lectura(190, fechaAr(2026, 6, 1, 7)),
      lectura(195, fechaAr(2026, 6, 2, 7)),
      lectura(185, fechaAr(2026, 6, 3, 7)),
      lectura(200, fechaAr(2026, 6, 4, 7)),
      lectura(192, fechaAr(2026, 6, 5, 7)),
      // 5 lecturas en el resto del día (14:00 local), más bajas
      lectura(140, fechaAr(2026, 5, 28, 14)),
      lectura(145, fechaAr(2026, 5, 29, 14)),
      lectura(150, fechaAr(2026, 5, 30, 14)),
      lectura(138, fechaAr(2026, 6, 1, 14)),
      lectura(142, fechaAr(2026, 6, 2, 14)),
    ];
    const p = amanecerAlto(lecturas, AHORA);
    expect(p).not.toBeNull();
    expect(p?.factor).toBe("amanecer_alto");
    expect(p?.efectoEstimado).toBeCloseTo(49.4, 5);
    expect(p?.nObservaciones).toBe(10);
    expect(p?.confianza).toBe(0.42);
    expect(p?.detalle).toEqual({ promedioAmanecer: 192.4, promedioResto: 143 });
  });

  test("menos de 5 lecturas en amanecer → null (rigor)", () => {
    const lecturas: Lectura[] = [
      lectura(190, fechaAr(2026, 6, 1, 7)),
      lectura(195, fechaAr(2026, 6, 2, 7)),
      lectura(185, fechaAr(2026, 6, 3, 7)),
      lectura(200, fechaAr(2026, 6, 4, 7)), // solo 4 en amanecer
      lectura(140, fechaAr(2026, 6, 1, 14)),
      lectura(145, fechaAr(2026, 6, 2, 14)),
      lectura(150, fechaAr(2026, 6, 3, 14)),
      lectura(138, fechaAr(2026, 6, 4, 14)),
      lectura(142, fechaAr(2026, 6, 5, 14)),
    ];
    expect(amanecerAlto(lecturas, AHORA)).toBeNull();
  });

  test("diferencia menor al umbral (<25 mg/dL) → null (efecto no real)", () => {
    const lecturas: Lectura[] = [
      lectura(150, fechaAr(2026, 6, 1, 7)),
      lectura(152, fechaAr(2026, 6, 2, 7)),
      lectura(148, fechaAr(2026, 6, 3, 7)),
      lectura(151, fechaAr(2026, 6, 4, 7)),
      lectura(149, fechaAr(2026, 6, 5, 7)),
      lectura(140, fechaAr(2026, 6, 1, 14)),
      lectura(145, fechaAr(2026, 6, 2, 14)),
      lectura(142, fechaAr(2026, 6, 3, 14)),
      lectura(138, fechaAr(2026, 6, 4, 14)),
      lectura(141, fechaAr(2026, 6, 5, 14)),
    ];
    expect(amanecerAlto(lecturas, AHORA)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// franja_problematica
// ────────────────────────────────────────────────────────────────────────────
describe("franja_problematica", () => {
  test("franja de la noche consistentemente >180 → reporta la noche", () => {
    // 21:00 en días anteriores a `ahora` (5-jul 12:00): todas dentro de ventana.
    const lecturas: Lectura[] = [
      lectura(200, fechaAr(2026, 5, 30, 21)),
      lectura(210, fechaAr(2026, 6, 1, 21)),
      lectura(190, fechaAr(2026, 6, 2, 21)),
      lectura(185, fechaAr(2026, 6, 3, 21)),
      lectura(175, fechaAr(2026, 6, 4, 21)), // 4 de 5 > 180 → 0.8
    ];
    const p = franjaProblematica(lecturas, AHORA);
    expect(p).not.toBeNull();
    expect(p?.factor).toBe("franja_problematica");
    expect(p?.nObservaciones).toBe(5);
    expect(p?.confianza).toBe(0.42);
    expect(p?.efectoEstimado).toBe(192);
    expect(p?.detalle).toEqual({
      franja: "noche",
      promedio: 192,
      proporcionAlta: 0.8,
    });
  });

  test("sin consistencia (<60% >180) → null", () => {
    const lecturas: Lectura[] = [
      lectura(200, fechaAr(2026, 5, 30, 21)),
      lectura(185, fechaAr(2026, 6, 1, 21)),
      lectura(150, fechaAr(2026, 6, 2, 21)),
      lectura(140, fechaAr(2026, 6, 3, 21)),
      lectura(160, fechaAr(2026, 6, 4, 21)), // solo 2 de 5 > 180 → 0.4
    ];
    expect(franjaProblematica(lecturas, AHORA)).toBeNull();
  });

  test("menos de 5 lecturas en la franja → null (rigor)", () => {
    const lecturas: Lectura[] = [
      lectura(200, fechaAr(2026, 6, 1, 21)),
      lectura(210, fechaAr(2026, 6, 2, 21)),
      lectura(220, fechaAr(2026, 6, 3, 21)),
      lectura(205, fechaAr(2026, 6, 4, 21)), // 4 lecturas, todas altas
    ];
    expect(franjaProblematica(lecturas, AHORA)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// tendencia_semanal
// ────────────────────────────────────────────────────────────────────────────
describe("tendencia_semanal", () => {
  test("promedio reciente más bajo → dirección 'baja'", () => {
    const lecturas: Lectura[] = [
      // reciente (últimos 7 días), promedio 120
      lectura(120, fechaAr(2026, 6, 1, 10)),
      lectura(118, fechaAr(2026, 6, 2, 10)),
      lectura(122, fechaAr(2026, 6, 3, 10)),
      lectura(119, fechaAr(2026, 6, 4, 10)),
      lectura(121, fechaAr(2026, 6, 5, 10)),
      // previa (7–14 días atrás), promedio 150
      lectura(150, fechaAr(2026, 5, 23, 10)),
      lectura(148, fechaAr(2026, 5, 24, 10)),
      lectura(152, fechaAr(2026, 5, 25, 10)),
      lectura(149, fechaAr(2026, 5, 26, 10)),
      lectura(151, fechaAr(2026, 5, 27, 10)),
    ];
    const p = tendenciaSemanal(lecturas, AHORA);
    expect(p).not.toBeNull();
    expect(p?.factor).toBe("tendencia_semanal");
    expect(p?.efectoEstimado).toBe(-30);
    expect(p?.nObservaciones).toBe(10);
    expect(p?.detalle).toEqual({
      direccion: "baja",
      promedioReciente: 120,
      promedioPrevio: 150,
      nReciente: 5,
      nPrevio: 5,
    });
  });

  test("diferencia pequeña (<10 mg/dL) → dirección 'estable'", () => {
    const lecturas: Lectura[] = [
      lectura(145, fechaAr(2026, 6, 1, 10)),
      lectura(145, fechaAr(2026, 6, 2, 10)),
      lectura(145, fechaAr(2026, 6, 3, 10)),
      lectura(145, fechaAr(2026, 6, 4, 10)),
      lectura(145, fechaAr(2026, 6, 5, 10)),
      lectura(150, fechaAr(2026, 5, 23, 10)),
      lectura(150, fechaAr(2026, 5, 24, 10)),
      lectura(150, fechaAr(2026, 5, 25, 10)),
      lectura(150, fechaAr(2026, 5, 26, 10)),
      lectura(150, fechaAr(2026, 5, 27, 10)),
    ];
    const p = tendenciaSemanal(lecturas, AHORA);
    expect(p?.detalle).toMatchObject({ direccion: "estable" });
  });

  test("menos de 5 lecturas en una semana → null (rigor)", () => {
    const lecturas: Lectura[] = [
      lectura(120, fechaAr(2026, 6, 1, 10)),
      lectura(118, fechaAr(2026, 6, 2, 10)),
      lectura(122, fechaAr(2026, 6, 3, 10)), // solo 3 recientes
      lectura(150, fechaAr(2026, 5, 23, 10)),
      lectura(148, fechaAr(2026, 5, 24, 10)),
      lectura(152, fechaAr(2026, 5, 25, 10)),
      lectura(149, fechaAr(2026, 5, 26, 10)),
      lectura(151, fechaAr(2026, 5, 27, 10)),
    ];
    expect(tendenciaSemanal(lecturas, AHORA)).toBeNull();
  });

  test("borde de ventana 7d: lectura exactamente en ahora−7d cuenta como previa", () => {
    const lecturas: Lectura[] = [
      lectura(120, fechaAr(2026, 6, 1, 10)),
      lectura(120, fechaAr(2026, 6, 2, 10)),
      lectura(120, fechaAr(2026, 6, 3, 10)),
      lectura(120, fechaAr(2026, 6, 4, 10)),
      lectura(120, fechaAr(2026, 6, 5, 10)), // 5 recientes
      lectura(150, fechaAr(2026, 5, 23, 10)),
      lectura(150, fechaAr(2026, 5, 24, 10)),
      lectura(150, fechaAr(2026, 5, 25, 10)),
      lectura(150, fechaAr(2026, 5, 26, 10)), // 4 previas claras
      lectura(150, fechaAr(2026, 5, 28, 12)), // exactamente ahora−7d → previa (la 5ª)
    ];
    const p = tendenciaSemanal(lecturas, AHORA);
    expect(p).not.toBeNull();
    expect(p?.detalle).toMatchObject({ nReciente: 5, nPrevio: 5, direccion: "baja" });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// hipos_recurrentes (excepción al piso de 5)
// ────────────────────────────────────────────────────────────────────────────
describe("hipos_recurrentes", () => {
  test("2 hipos en 14 días disparan aunque haya pocos datos totales", () => {
    const lecturas: Lectura[] = [
      lectura(65, fechaAr(2026, 6, 1, 8)),
      lectura(60, fechaAr(2026, 6, 3, 16)),
    ];
    const p = hiposRecurrentes(lecturas, AHORA);
    expect(p).not.toBeNull();
    expect(p?.factor).toBe("hipos_recurrentes");
    expect(p?.efectoEstimado).toBe(2);
    expect(p?.nObservaciones).toBe(2);
    expect(p?.confianza).toBe(0.5);
    expect(p?.detalle).toEqual({ cantidad: 2, ventanaDias: 14 });
  });

  test("1 sola hipo → null", () => {
    const lecturas: Lectura[] = [
      lectura(65, fechaAr(2026, 6, 1, 8)),
      lectura(140, fechaAr(2026, 6, 3, 16)),
    ];
    expect(hiposRecurrentes(lecturas, AHORA)).toBeNull();
  });

  test("borde de ventana 14d: hipo más vieja que 14 días no cuenta", () => {
    const lecturas: Lectura[] = [
      lectura(65, fechaAr(2026, 6, 1, 8)), // dentro de ventana
      lectura(60, fechaAr(2026, 5, 20, 8)), // 20/jun < 21/jun (ahora−14d) → fuera
    ];
    expect(hiposRecurrentes(lecturas, AHORA)).toBeNull();
  });

  test("más hipos → más confianza (satura en 1)", () => {
    const lecturas: Lectura[] = [
      lectura(65, fechaAr(2026, 6, 1, 8)),
      lectura(60, fechaAr(2026, 6, 2, 8)),
      lectura(55, fechaAr(2026, 6, 3, 8)),
      lectura(68, fechaAr(2026, 6, 4, 8)),
    ];
    const p = hiposRecurrentes(lecturas, AHORA);
    expect(p?.efectoEstimado).toBe(4);
    expect(p?.confianza).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// calcularPatrones (integración)
// ────────────────────────────────────────────────────────────────────────────
describe("calcularPatrones", () => {
  test("dataset vacío → sin patrones", () => {
    expect(calcularPatrones([], AHORA)).toEqual([]);
  });

  test("combina amanecer_alto + hipos_recurrentes cuando ambos aplican", () => {
    const lecturas: Lectura[] = [
      lectura(190, fechaAr(2026, 6, 1, 7)),
      lectura(195, fechaAr(2026, 6, 2, 7)),
      lectura(185, fechaAr(2026, 6, 3, 7)),
      lectura(200, fechaAr(2026, 6, 4, 7)),
      lectura(192, fechaAr(2026, 6, 5, 7)),
      lectura(140, fechaAr(2026, 5, 28, 14)),
      lectura(145, fechaAr(2026, 5, 29, 14)),
      lectura(150, fechaAr(2026, 5, 30, 14)),
      lectura(138, fechaAr(2026, 6, 1, 14)),
      lectura(142, fechaAr(2026, 6, 2, 14)),
      lectura(65, fechaAr(2026, 6, 2, 3)),
      lectura(60, fechaAr(2026, 6, 4, 3)),
    ];
    const factores = calcularPatrones(lecturas, AHORA).map((p) => p.factor);
    expect(factores).toContain("amanecer_alto");
    expect(factores).toContain("hipos_recurrentes");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// contexto.ts — selección y comunicación
// ────────────────────────────────────────────────────────────────────────────
function patron(parcial: Partial<Patron> & Pick<Patron, "factor">): Patron {
  return {
    efectoEstimado: 0,
    nObservaciones: 5,
    confianza: 0.5,
    detalle: { cantidad: 0, ventanaDias: 14 },
    ...parcial,
  } as Patron;
}

describe("seleccionarConversacional", () => {
  test("elige el conversacional de mayor confianza, ignora hipos", () => {
    const patrones: Patron[] = [
      patron({
        factor: "amanecer_alto",
        confianza: 0.42,
        detalle: { promedioAmanecer: 190, promedioResto: 140 },
      }),
      patron({
        factor: "franja_problematica",
        confianza: 0.9,
        detalle: { franja: "noche", promedio: 195, proporcionAlta: 0.8 },
      }),
      patron({
        factor: "hipos_recurrentes",
        confianza: 1,
        detalle: { cantidad: 3, ventanaDias: 14 },
      }),
    ];
    expect(seleccionarConversacional(patrones)?.factor).toBe("franja_problematica");
  });

  test("una tendencia 'estable' no es material conversacional", () => {
    const patrones: Patron[] = [
      patron({
        factor: "tendencia_semanal",
        confianza: 0.9,
        detalle: {
          direccion: "estable",
          promedioReciente: 145,
          promedioPrevio: 150,
          nReciente: 5,
          nPrevio: 5,
        },
      }),
    ];
    expect(seleccionarConversacional(patrones)).toBeNull();
  });
});

describe("construirContextoPatrones", () => {
  test("sin patrones → cadena vacía", () => {
    expect(construirContextoPatrones([])).toBe("");
  });

  test("hipos_recurrentes SIEMPRE se comunica y recomienda al médico", () => {
    const texto = construirContextoPatrones([
      patron({
        factor: "hipos_recurrentes",
        efectoEstimado: 2,
        confianza: 0.5,
        detalle: { cantidad: 2, ventanaDias: 14 },
      }),
    ]);
    expect(texto).not.toBe("");
    expect(texto.toLowerCase()).toContain("médic");
  });

  test("máximo UN patrón conversacional aunque haya varios", () => {
    const texto = construirContextoPatrones([
      patron({
        factor: "amanecer_alto",
        confianza: 0.42,
        detalle: { promedioAmanecer: 190, promedioResto: 140 },
      }),
      patron({
        factor: "franja_problematica",
        confianza: 0.9,
        detalle: { franja: "noche", promedio: 195, proporcionAlta: 0.8 },
      }),
    ]);
    // El de mayor confianza (franja/noche) aparece; el otro (amanecer) no.
    expect(texto.toLowerCase()).toContain("noche");
    expect(texto.toLowerCase()).not.toContain("amanecer");
  });

  test("hipos + conversacional: aparecen ambos bloques (seguridad + 1 observación)", () => {
    const texto = construirContextoPatrones([
      patron({
        factor: "hipos_recurrentes",
        efectoEstimado: 2,
        confianza: 0.5,
        detalle: { cantidad: 2, ventanaDias: 14 },
      }),
      patron({
        factor: "franja_problematica",
        confianza: 0.9,
        detalle: { franja: "noche", promedio: 195, proporcionAlta: 0.8 },
      }),
    ]);
    expect(texto.toLowerCase()).toContain("médic"); // bloque hipos
    expect(texto.toLowerCase()).toContain("noche"); // bloque conversacional
  });

  test("guardrails de comunicación presentes (suave, no diagnóstico)", () => {
    const texto = construirContextoPatrones([
      patron({
        factor: "amanecer_alto",
        confianza: 0.42,
        detalle: { promedioAmanecer: 192, promedioResto: 143 },
      }),
    ]);
    const lower = texto.toLowerCase();
    expect(lower).toContain("no es diagnóstico");
    expect(lower).toContain("máximo");
  });
});

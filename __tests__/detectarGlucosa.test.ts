import { describe, expect, test } from "vitest";
import { detectarGlucosa, preFiltroSeguridad } from "@/lib/agents/seguridad";

/**
 * Contrato de detectarGlucosa (paso 5.5 — endurecimiento):
 * - Solo guarda si hay contexto glucémico real cerca del número.
 * - Rango plausible 30–600 mg/dL.
 * - Descarta números pegados a unidades no glucémicas (hs, años, pesos,
 *   gramos, minutos, $) y formatos de hora/fecha.
 * - Ante la duda → null. Un dato faltante es mejor que un dato falso.
 */

describe("detectarGlucosa — casos positivos (debe guardar)", () => {
  test('"amanecí en 190" → 190', () => {
    expect(detectarGlucosa("amanecí en 190")).toBe(190);
  });

  test('"estoy en 62" → 62', () => {
    expect(detectarGlucosa("estoy en 62")).toBe(62);
  });

  test('"me desperté con 180" → 180', () => {
    expect(detectarGlucosa("me desperté con 180")).toBe(180);
  });

  test('"me medí y tenía 145" → 145', () => {
    expect(detectarGlucosa("me medí y tenía 145")).toBe(145);
  });

  test('unidad explícita: "tengo 250 mg/dl" → 250', () => {
    expect(detectarGlucosa("tengo 250 mg/dl")).toBe(250);
  });

  test('unidad sin barra: "110 mgdl" → 110', () => {
    expect(detectarGlucosa("110 mgdl")).toBe(110);
  });

  test('"mi glucemia es 110" → 110', () => {
    expect(detectarGlucosa("mi glucemia es 110")).toBe(110);
  });

  test('"la glucosa me dio 95" → 95', () => {
    expect(detectarGlucosa("la glucosa me dio 95")).toBe(95);
  });

  test('"tengo el azúcar en 300" → 300', () => {
    expect(detectarGlucosa("tengo el azúcar en 300")).toBe(300);
  });

  test('número antes de la palabra clave: "190 de glucemia" → 190', () => {
    expect(detectarGlucosa("me dio 190 de glucemia")).toBe(190);
  });

  test("mayúsculas y acentos: \"Amanecí en 210\" → 210", () => {
    expect(detectarGlucosa("Amanecí en 210")).toBe(210);
  });
});

describe("detectarGlucosa — casos negativos (NO debe guardar)", () => {
  test('"nos vemos a las 190hs" → null', () => {
    expect(detectarGlucosa("nos vemos a las 190hs")).toBeNull();
  });

  test('"gasté 150 pesos" → null', () => {
    expect(detectarGlucosa("gasté 150 pesos")).toBeNull();
  });

  test('"comí 80 gramos de pan" → null', () => {
    expect(detectarGlucosa("comí 80 gramos de pan")).toBeNull();
  });

  test('"el bondi 152" → null', () => {
    expect(detectarGlucosa("el bondi 152")).toBeNull();
  });

  test('hora con dos puntos: "desayuné a las 8:30" → null', () => {
    expect(detectarGlucosa("desayuné a las 8:30")).toBeNull();
  });

  test('fecha: "el turno es el 15/07" → null', () => {
    expect(detectarGlucosa("el turno es el 15/07")).toBeNull();
  });

  test('edad: "tengo 45 años" → null', () => {
    expect(detectarGlucosa("tengo 45 años")).toBeNull();
  });

  test('plata con símbolo: "me salió $200" → null', () => {
    expect(detectarGlucosa("me salió $200")).toBeNull();
  });

  test('minutos: "caminé 40 minutos" → null', () => {
    expect(detectarGlucosa("caminé 40 minutos")).toBeNull();
  });

  test('horas escritas: "duermo 8 horas" → null', () => {
    expect(detectarGlucosa("duermo 8 horas")).toBeNull();
  });

  test('lugar, no glucemia: "estoy en la calle 62" → null', () => {
    expect(detectarGlucosa("estoy en la calle 62")).toBeNull();
  });

  test('número suelto sin contexto: "pensé en 100" → null', () => {
    expect(detectarGlucosa("pensé en 100")).toBeNull();
  });

  test('fuera de rango alto: "amanecí en 700" → null', () => {
    expect(detectarGlucosa("amanecí en 700")).toBeNull();
  });

  test('fuera de rango bajo: "estoy en 25" → null', () => {
    expect(detectarGlucosa("estoy en 25")).toBeNull();
  });

  test("texto sin números → null", () => {
    expect(detectarGlucosa("me desperté con hambre")).toBeNull();
  });

  test("string vacío → null", () => {
    expect(detectarGlucosa("")).toBeNull();
  });
});

describe("preFiltroSeguridad — integración con la detección endurecida", () => {
  test('"estoy en 62" sigue disparando emergencia por glucosa baja', () => {
    expect(preFiltroSeguridad("estoy en 62")).toEqual({
      esEmergencia: true,
      motivo: "glucosa_baja",
    });
  });

  test('"nos vemos a las 45hs" NO dispara emergencia', () => {
    expect(preFiltroSeguridad("nos vemos a las 45hs")).toEqual({
      esEmergencia: false,
      motivo: null,
    });
  });

  test('"amanecí en 190" no es emergencia (alta pero no hipo)', () => {
    expect(preFiltroSeguridad("amanecí en 190")).toEqual({
      esEmergencia: false,
      motivo: null,
    });
  });

  // El pre-filtro de emergencia es MÁS sensible que la persistencia:
  // un falso negativo acá es una hipo sin protocolo 15/15.
  test('"me dio 52" dispara emergencia aunque NO se persista como dato', () => {
    expect(detectarGlucosa("me dio 52")).toBeNull();
    expect(preFiltroSeguridad("me dio 52")).toEqual({
      esEmergencia: true,
      motivo: "glucosa_baja",
    });
  });

  test('"mi glucemia es de 25" dispara emergencia (hipo severa, bajo el piso de guardado)', () => {
    expect(preFiltroSeguridad("mi glucemia es de 25")).toEqual({
      esEmergencia: true,
      motivo: "glucosa_baja",
    });
  });

  test('"el sensor me marcó 60" dispara emergencia', () => {
    expect(preFiltroSeguridad("el sensor me marcó 60")).toEqual({
      esEmergencia: true,
      motivo: "glucosa_baja",
    });
  });

  test('"me dio 52 pesos" NO dispara emergencia (plata, no glucemia)', () => {
    expect(preFiltroSeguridad("me dio 52 pesos")).toEqual({
      esEmergencia: false,
      motivo: null,
    });
  });

  test('"nací en el 55" NO dispara emergencia', () => {
    expect(preFiltroSeguridad("nací en el 55")).toEqual({
      esEmergencia: false,
      motivo: null,
    });
  });
});

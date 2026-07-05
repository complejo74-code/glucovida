import { describe, expect, test } from "vitest";
import { construirSystemPrompt } from "@/lib/agents/orquestador";
import { REGLAS_SEGURIDAD, INSTRUCCION_EMERGENCIA } from "@/lib/agents/seguridad";

/**
 * Invariantes de seguridad de construirSystemPrompt (paso 6):
 * - REGLAS_SEGURIDAD SIEMPRE va primero, en todos los caminos.
 * - El contexto de patrones se inyecta solo fuera de emergencia (gate
 *   estructural, no dependiente del caller).
 */

const BLOQUE_PATRONES = "[CONTEXTO PRIVADO — patrón observado, NO es diagnóstico] xyz";

describe("construirSystemPrompt — invariantes de seguridad", () => {
  test("REGLAS_SEGURIDAD siempre va primero", () => {
    const prompt = construirSystemPrompt({
      agentes: [],
      emergencia: false,
      historial: "",
      patrones: "",
    });
    expect(prompt.startsWith(REGLAS_SEGURIDAD)).toBe(true);
  });

  test("sin emergencia, el bloque de patrones se inyecta después de seguridad", () => {
    const prompt = construirSystemPrompt({
      agentes: [],
      emergencia: false,
      historial: "",
      patrones: BLOQUE_PATRONES,
    });
    expect(prompt.startsWith(REGLAS_SEGURIDAD)).toBe(true);
    expect(prompt).toContain(BLOQUE_PATRONES);
    // Seguridad antes que patrones.
    expect(prompt.indexOf(REGLAS_SEGURIDAD)).toBeLessThan(
      prompt.indexOf(BLOQUE_PATRONES)
    );
  });

  test("en emergencia, los patrones NUNCA se inyectan aunque se pasen", () => {
    const prompt = construirSystemPrompt({
      agentes: ["nutricion"],
      emergencia: true,
      historial: "",
      patrones: BLOQUE_PATRONES,
    });
    expect(prompt.startsWith(REGLAS_SEGURIDAD)).toBe(true);
    expect(prompt).toContain(INSTRUCCION_EMERGENCIA);
    expect(prompt).not.toContain(BLOQUE_PATRONES);
  });

  test("compatibilidad: sin el parámetro patrones sigue funcionando", () => {
    const prompt = construirSystemPrompt({
      agentes: [],
      emergencia: false,
      historial: "",
    });
    expect(prompt).toBe(REGLAS_SEGURIDAD);
  });
});

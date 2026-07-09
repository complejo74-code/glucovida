import { describe, expect, test } from "vitest";
import { construirContextoPerfil } from "@/lib/perfil/contexto";
import type { InsulinaPerfil, PerfilUsuario } from "@/lib/perfil/tipos";

const ANIO_ACTUAL = 2026;

const VACIO: PerfilUsuario = {
  tipoDiabetes: null,
  anioNacimiento: null,
  menstrua: null,
};

describe("construirContextoPerfil", () => {
  test("perfil vacío y sin insulinas → sin bloque (salteó todo, no bloquea)", () => {
    expect(construirContextoPerfil(VACIO, [], ANIO_ACTUAL)).toBe("");
  });

  test("incluye tipo de diabetes con su descripción larga", () => {
    const bloque = construirContextoPerfil(
      { ...VACIO, tipoDiabetes: "DM1" },
      [],
      ANIO_ACTUAL
    );
    expect(bloque).toContain("diabetes tipo 1");
    expect(bloque).toContain("[CONTEXTO PRIVADO");
  });

  test("calcula edad a partir del año de nacimiento", () => {
    const bloque = construirContextoPerfil(
      { ...VACIO, anioNacimiento: 1990 },
      [],
      ANIO_ACTUAL
    );
    expect(bloque).toContain("36 años");
  });

  test("año futuro o inválido no produce edad negativa", () => {
    const bloque = construirContextoPerfil(
      { ...VACIO, anioNacimiento: 2100 },
      [],
      ANIO_ACTUAL
    );
    expect(bloque).toBe(""); // sin edad válida y nada más → sin bloque
  });

  test("lista las insulinas con marca cuando existe", () => {
    const insulinas: InsulinaPerfil[] = [
      { clase: "basal", marca: "Lantus" },
      { clase: "rapida", marca: null },
    ];
    const bloque = construirContextoPerfil(VACIO, insulinas, ANIO_ACTUAL);
    expect(bloque).toContain("Lantus");
    expect(bloque).toContain("basal");
    expect(bloque).toContain("rápida");
  });

  test("el bloque reitera que los guardrails no cambian (no prescribir dosis)", () => {
    const bloque = construirContextoPerfil(
      { ...VACIO, tipoDiabetes: "DM2" },
      [],
      ANIO_ACTUAL
    );
    expect(bloque.toLowerCase()).toContain("dosis");
    expect(bloque.toLowerCase()).toContain("guardrails");
  });

  test("menstrua NO se surfacea en el prompt todavía (sin subagente hormonal)", () => {
    const bloque = construirContextoPerfil(
      { tipoDiabetes: "DM1", anioNacimiento: null, menstrua: true },
      [],
      ANIO_ACTUAL
    );
    // El dato se persiste en la DB, pero el bloque no lo menciona.
    expect(bloque.toLowerCase()).not.toContain("menstr");
    expect(bloque.toLowerCase()).not.toContain("ciclo");
  });
});

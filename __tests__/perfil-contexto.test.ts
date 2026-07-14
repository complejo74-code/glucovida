import { describe, expect, test } from "vitest";
import { construirContextoPerfil } from "@/lib/perfil/contexto";
import type { InsulinaPerfil, PerfilUsuario } from "@/lib/perfil/tipos";

const ANIO_ACTUAL = 2026;

const VACIO: PerfilUsuario = {
  nombre: null,
  tipoDiabetes: null,
  anioNacimiento: null,
  sexo: null,
  pesoKg: null,
  alturaCm: null,
  menstrua: null,
};

describe("construirContextoPerfil", () => {
  test("perfil vacío y sin insulinas → sin bloque (salteó todo, no bloquea)", () => {
    expect(construirContextoPerfil(VACIO, [], ANIO_ACTUAL)).toBe("");
  });

  test("incluye el nombre cuando existe", () => {
    const bloque = construirContextoPerfil(
      { ...VACIO, nombre: "Sofi" },
      [],
      ANIO_ACTUAL
    );
    expect(bloque).toContain("Sofi");
    expect(bloque).toContain("[CONTEXTO PRIVADO");
  });

  test("nombre en blanco (solo espacios) no genera bloque", () => {
    expect(construirContextoPerfil({ ...VACIO, nombre: "   " }, [], ANIO_ACTUAL)).toBe(
      ""
    );
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

  test("surfacea sexo solo si es masculino/femenino", () => {
    const masc = construirContextoPerfil(
      { ...VACIO, sexo: "masculino" },
      [],
      ANIO_ACTUAL
    );
    expect(masc.toLowerCase()).toContain("masculino");

    // 'prefiero_no_decir' NO aporta contexto: no debe surfacearse.
    const oculto = construirContextoPerfil(
      { ...VACIO, sexo: "prefiero_no_decir" },
      [],
      ANIO_ACTUAL
    );
    expect(oculto).toBe("");
  });

  test("incluye peso, altura e IMC calculado", () => {
    const bloque = construirContextoPerfil(
      { ...VACIO, pesoKg: 70, alturaCm: 170 },
      [],
      ANIO_ACTUAL
    );
    expect(bloque).toContain("70 kg");
    expect(bloque).toContain("170 cm");
    expect(bloque).toContain("IMC 24.2"); // 70 / 1.7^2 = 24.22
  });

  test("el bloque prohíbe explícitamente comentar el peso de forma evaluativa", () => {
    const bloque = construirContextoPerfil(
      { ...VACIO, pesoKg: 95, alturaCm: 165 },
      [],
      ANIO_ACTUAL
    );
    const lower = bloque.toLowerCase();
    expect(lower).toContain("contexto interno");
    expect(lower).toContain("bajar de peso"); // aparece como prohibición
    expect(lower).toContain("evaluativa");
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

  test("menstrua NO se surfacea en el prompt (sin subagente hormonal)", () => {
    const bloque = construirContextoPerfil(
      { ...VACIO, nombre: "Ana", menstrua: true },
      [],
      ANIO_ACTUAL
    );
    // El dato se persiste en la DB, pero el bloque no lo menciona.
    expect(bloque.toLowerCase()).not.toContain("menstr");
    expect(bloque.toLowerCase()).not.toContain("ciclo");
  });
});

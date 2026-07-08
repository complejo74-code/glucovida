import { describe, expect, test } from "vitest";
import {
  detectarSueno,
  detectarEstres,
  detectarComida,
  detectarEjercicio,
  detectarInsulina,
  detectarEventos,
} from "@/lib/agents/deteccion";
import { detectarGlucosa } from "@/lib/agents/seguridad";

/**
 * Contrato de los detectores conversacionales (paso 7):
 * - Misma filosofía que detectarGlucosa: contexto obligatorio, exclusiones
 *   duras, y ante la duda NO guardar. Un dato faltante es mejor que uno falso.
 * - Funciones puras: mismo input → mismo output, sin efectos.
 * - Un mensaje puede generar múltiples eventos.
 * - INSULINA: solo registra lo que el usuario cuenta que hizo. Jamás dispara
 *   ante una PREGUNTA de dosis y jamás produce nada prescriptivo.
 */

// ── SUEÑO ────────────────────────────────────────────────────────────────────
describe("detectarSueno", () => {
  test('"dormí 5 horas" → sueno, 5 h', () => {
    const e = detectarSueno("dormí 5 horas");
    expect(e?.tipo).toBe("sueno");
    expect(e?.valorNum).toBe(5);
  });

  test('"anoche dormí 7 hs" → sueno, 7 h', () => {
    expect(detectarSueno("anoche dormí 7 hs")?.valorNum).toBe(7);
  });

  test('"dormí mal" → sueno sin horas', () => {
    const e = detectarSueno("dormí mal");
    expect(e?.tipo).toBe("sueno");
    expect(e?.valorNum).toBeNull();
  });

  test('"no pegué un ojo en toda la noche" → sueno sin horas', () => {
    const e = detectarSueno("no pegué un ojo en toda la noche");
    expect(e?.tipo).toBe("sueno");
    expect(e?.valorNum).toBeNull();
  });

  test('"me acosté a las 3" → sueno, pero NO toma 3 como horas dormidas', () => {
    const e = detectarSueno("me acosté a las 3");
    expect(e?.tipo).toBe("sueno");
    expect(e?.valorNum).toBeNull();
  });

  test('"tuve insomnio toda la noche" → sueno sin horas', () => {
    expect(detectarSueno("tuve insomnio toda la noche")?.tipo).toBe("sueno");
  });

  test('sin contexto de sueño: "hola, ¿cómo andás?" → null', () => {
    expect(detectarSueno("hola, ¿cómo andás?")).toBeNull();
  });

  test('otra variable: "comí pizza" → null', () => {
    expect(detectarSueno("comí pizza")).toBeNull();
  });

  test('otra variable: "salí a caminar" → null', () => {
    expect(detectarSueno("salí a caminar")).toBeNull();
  });
});

// ── ESTRÉS ───────────────────────────────────────────────────────────────────
describe("detectarEstres", () => {
  test('"estoy re estresado" → estres, escala alta (8)', () => {
    const e = detectarEstres("estoy re estresado");
    expect(e?.tipo).toBe("estres");
    expect(e?.valorNum).toBe(8);
  });

  test('"estoy ansioso" → estres, escala media (6)', () => {
    expect(detectarEstres("estoy ansioso")?.valorNum).toBe(6);
  });

  test('"el laburo me tiene mal" → estres, escala media (6)', () => {
    expect(detectarEstres("el laburo me tiene mal")?.valorNum).toBe(6);
  });

  test('"día tranquilo hoy" → estres, escala baja (2)', () => {
    const e = detectarEstres("día tranquilo hoy");
    expect(e?.tipo).toBe("estres");
    expect(e?.valorNum).toBe(2);
  });

  test('"hoy anduve relajado" → estres, escala baja (2)', () => {
    expect(detectarEstres("hoy anduve relajado")?.valorNum).toBe(2);
  });

  test('escala explícita: "estrés 9 sobre 10" → 9', () => {
    expect(detectarEstres("estrés 9 sobre 10")?.valorNum).toBe(9);
  });

  test('tranquilidad hacia otro, no estado propio: "quedate tranquilo que ya voy" → null', () => {
    expect(detectarEstres("quedate tranquilo que ya voy")).toBeNull();
  });

  // Regresión (code-review paso 7): "siempre" termina en "re"; no debe colarse
  // como el intensificador "re tranqui".
  test('sufijo "re", no intensificador: "quedate siempre tranquilo" → null', () => {
    expect(detectarEstres("quedate siempre tranquilo")).toBeNull();
  });

  // Regresión (code-review paso 7): "sin estrés" es lo OPUESTO a estrés medio.
  test('negación: "hoy sin estrés" → estres, escala baja (2)', () => {
    expect(detectarEstres("hoy sin estrés")?.valorNum).toBe(2);
  });

  test('otra variable: "comí una ensalada" → null', () => {
    expect(detectarEstres("comí una ensalada")).toBeNull();
  });

  test('otra variable: "me puse la insulina" → null', () => {
    expect(detectarEstres("me puse la insulina")).toBeNull();
  });
});

// ── COMIDA ───────────────────────────────────────────────────────────────────
describe("detectarComida", () => {
  test('"comí pizza" → comida', () => {
    const e = detectarComida("comí pizza");
    expect(e?.tipo).toBe("comida");
    expect(e?.valorTexto).toBe("comí pizza");
  });

  test('"almorcé milanesa con puré" → comida', () => {
    expect(detectarComida("almorcé milanesa con puré")?.tipo).toBe("comida");
  });

  test('"desayuné tostadas" → comida', () => {
    expect(detectarComida("desayuné tostadas")?.tipo).toBe("comida");
  });

  test('"cené una ensalada" → comida', () => {
    expect(detectarComida("cené una ensalada")?.tipo).toBe("comida");
  });

  test('"me morfé dos empanadas" → comida', () => {
    expect(detectarComida("me morfé dos empanadas")?.tipo).toBe("comida");
  });

  test('carbs explícitos: "comí 45g de carbos" → estimacion_carbs 45', () => {
    const e = detectarComida("comí 45g de carbos");
    expect(e?.tipo).toBe("comida");
    expect(e?.metadatos?.estimacion_carbs).toBe(45);
  });

  test('sin carbs explícitos: "comí pizza" → sin estimacion_carbs', () => {
    expect(detectarComida("comí pizza")?.metadatos?.estimacion_carbs).toBeUndefined();
  });

  test('"como" conjunción, no verbo de comer: "como te decía ayer" → null', () => {
    expect(detectarComida("como te decía ayer")).toBeNull();
  });

  test('intención futura, no registro: "voy a comer algo más tarde" → null', () => {
    expect(detectarComida("voy a comer algo más tarde")).toBeNull();
  });

  test('otra variable: "dormí 6 horas" → null', () => {
    expect(detectarComida("dormí 6 horas")).toBeNull();
  });
});

// ── EJERCICIO ────────────────────────────────────────────────────────────────
describe("detectarEjercicio", () => {
  test('"salí a caminar" → ejercicio sin minutos', () => {
    const e = detectarEjercicio("salí a caminar");
    expect(e?.tipo).toBe("ejercicio");
    expect(e?.valorNum).toBeNull();
  });

  test('"hice gym 1 hora" → ejercicio, 60 min', () => {
    expect(detectarEjercicio("hice gym 1 hora")?.valorNum).toBe(60);
  });

  test('"caminé 40 minutos" → ejercicio, 40 min', () => {
    expect(detectarEjercicio("caminé 40 minutos")?.valorNum).toBe(40);
  });

  test('"fui al gimnasio un rato" → ejercicio sin minutos', () => {
    expect(detectarEjercicio("fui al gimnasio un rato")?.tipo).toBe("ejercicio");
  });

  test('"corrí 5 km" → ejercicio, NO toma 5 como minutos', () => {
    const e = detectarEjercicio("corrí 5 km");
    expect(e?.tipo).toBe("ejercicio");
    expect(e?.valorNum).toBeNull();
  });

  test('sedentario: "no me moví en todo el día" → ejercicio, 0 min', () => {
    const e = detectarEjercicio("no me moví en todo el día");
    expect(e?.tipo).toBe("ejercicio");
    expect(e?.valorNum).toBe(0);
  });

  test('otra variable: "comí pizza" → null', () => {
    expect(detectarEjercicio("comí pizza")).toBeNull();
  });

  test('otra variable: "estoy re estresado" → null', () => {
    expect(detectarEjercicio("estoy re estresado")).toBeNull();
  });

  test('otra variable: "dormí 8 horas" → null', () => {
    expect(detectarEjercicio("dormí 8 horas")).toBeNull();
  });
});

// ── INSULINA ─────────────────────────────────────────────────────────────────
// La captura de insulina es SOLO registro. Nunca ante una pregunta de dosis,
// nunca prescriptiva. valorNum queda en null a propósito (cero semántica de dosis).
describe("detectarInsulina", () => {
  test('"me puse 4 de rápida" → insulina (solo registro, sin valorNum)', () => {
    const e = detectarInsulina("me puse 4 de rápida");
    expect(e?.tipo).toBe("insulina");
    expect(e?.valorNum).toBeNull();
    expect(e?.valorTexto).toBe("me puse 4 de rápida");
  });

  test('"me apliqué la basal" → insulina', () => {
    expect(detectarInsulina("me apliqué la basal")?.tipo).toBe("insulina");
  });

  test('"me inyecté la lenta" → insulina', () => {
    expect(detectarInsulina("me inyecté la lenta")?.tipo).toBe("insulina");
  });

  test('"ya me di la lantus" → insulina', () => {
    expect(detectarInsulina("ya me di la lantus")?.tipo).toBe("insulina");
  });

  test('"me pinché la insulina antes de comer" → insulina', () => {
    expect(detectarInsulina("me pinché la insulina antes de comer")?.tipo).toBe(
      "insulina"
    );
  });

  test('"me puse la NPH de la noche" → insulina', () => {
    expect(detectarInsulina("me puse la NPH de la noche")?.tipo).toBe("insulina");
  });

  test('PREGUNTA de dosis NO se registra: "¿cuánta insulina me pongo?" → null', () => {
    expect(detectarInsulina("¿cuánta insulina me pongo?")).toBeNull();
  });

  test('PREGUNTA de dosis NO se registra: "¿cuántas unidades de rápida me corresponden para 60g?" → null', () => {
    expect(
      detectarInsulina("¿cuántas unidades de rápida me corresponden para 60g?")
    ).toBeNull();
  });

  test('intención futura, no registro: "tengo que ponerme la basal más tarde" → null', () => {
    expect(detectarInsulina("tengo que ponerme la basal más tarde")).toBeNull();
  });

  test('otra variable: "comí pizza" → null', () => {
    expect(detectarInsulina("comí pizza")).toBeNull();
  });

  // Regresión (code-review paso 7): "rápida"/"lenta" como adjetivos comunes,
  // no como tipo de insulina, NO deben registrar un evento de insulina.
  test('adjetivo, no insulina: "me apliqué la crema rápidamente" → null', () => {
    expect(detectarInsulina("me apliqué la crema rápidamente")).toBeNull();
  });

  test('adjetivo, no insulina: "me puse la campera, la tarde estuvo lenta" → null', () => {
    expect(
      detectarInsulina("me puse la campera, la tarde estuvo lenta")
    ).toBeNull();
  });
});

// ── AGREGADOR / MÚLTIPLES EVENTOS ────────────────────────────────────────────
describe("detectarEventos — múltiples eventos por mensaje", () => {
  test('"dormí 5 horas y amanecí en 190": el detector de variables da sueño, y glucosa da 190 (DOS eventos)', () => {
    const eventos = detectarEventos("dormí 5 horas y amanecí en 190");
    expect(eventos).toHaveLength(1);
    expect(eventos[0].tipo).toBe("sueno");
    expect(eventos[0].valorNum).toBe(5);
    // La glucemia se detecta en su propio carril (seguridad + persistencia):
    expect(detectarGlucosa("dormí 5 horas y amanecí en 190")).toBe(190);
  });

  test('mensaje con tres variables: "dormí mal, comí pizza y me puse 4 de rápida"', () => {
    const tipos = detectarEventos(
      "dormí mal, comí pizza y me puse 4 de rápida"
    ).map((e) => e.tipo);
    expect(tipos).toContain("sueno");
    expect(tipos).toContain("comida");
    expect(tipos).toContain("insulina");
    expect(tipos).toHaveLength(3);
  });

  test('mensaje sin variables: "hola, ¿cómo andás?" → []', () => {
    expect(detectarEventos("hola, ¿cómo andás?")).toEqual([]);
  });

  test("string vacío → []", () => {
    expect(detectarEventos("")).toEqual([]);
  });
});

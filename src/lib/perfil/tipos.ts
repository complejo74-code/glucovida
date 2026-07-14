/**
 * Tipos y constantes del perfil (paso 9). Compartidos entre la UI (onboarding /
 * perfil) y el formateador de contexto, para que las etiquetas no se dupliquen.
 */

export type TipoDiabetes =
  | "DM1"
  | "DM2"
  | "LADA"
  | "DMG"
  | "prediabetes"
  | "otro";

export type ClaseInsulina = "rapida" | "basal" | "lenta" | "mixta";

export type Sexo = "masculino" | "femenino" | "prefiero_no_decir";

/** Perfil que se lee de `usuario` para personalizar (subconjunto relevante). */
export interface PerfilUsuario {
  /** Cómo quiere que Gluco la/lo llame. Requerido en la UI, nullable en DB. */
  nombre: string | null;
  tipoDiabetes: TipoDiabetes | null;
  anioNacimiento: number | null;
  sexo: Sexo | null;
  pesoKg: number | null;
  alturaCm: number | null;
  /**
   * nullable a propósito: null = "prefiero no decir" o sin responder. El
   * onboarding ya NO lo pregunta (paso 9.5), pero la columna se conserva para el
   * futuro subagente hormonal; sigue SIN surfacearse en el contexto.
   */
  menstrua: boolean | null;
}

/** Una insulina que la persona declaró usar. */
export interface InsulinaPerfil {
  clase: ClaseInsulina;
  marca: string | null;
}

/** Opciones de tipo de diabetes para los botones del onboarding/perfil. */
export const OPCIONES_TIPO_DIABETES: ReadonlyArray<{
  valor: TipoDiabetes;
  etiqueta: string;
  /** etiqueta larga, para el bloque de contexto del prompt. */
  descripcion: string;
}> = [
  { valor: "DM1", etiqueta: "Tipo 1", descripcion: "diabetes tipo 1" },
  { valor: "DM2", etiqueta: "Tipo 2", descripcion: "diabetes tipo 2" },
  { valor: "LADA", etiqueta: "LADA (1.5)", descripcion: "LADA / diabetes tipo 1.5" },
  { valor: "DMG", etiqueta: "Gestacional", descripcion: "diabetes gestacional" },
  { valor: "prediabetes", etiqueta: "Prediabetes", descripcion: "prediabetes" },
  { valor: "otro", etiqueta: "Otro", descripcion: "otro tipo (sin especificar)" },
];

/** Opciones de clase de insulina para el onboarding/perfil. */
export const OPCIONES_CLASE_INSULINA: ReadonlyArray<{
  valor: ClaseInsulina;
  etiqueta: string;
  ayuda: string;
}> = [
  { valor: "rapida", etiqueta: "Rápida / ultrarrápida", ayuda: "cubre las comidas" },
  { valor: "basal", etiqueta: "Basal", ayuda: "cubre el día, horario fijo" },
  { valor: "lenta", etiqueta: "Lenta / NPH", ayuda: "acción prolongada" },
  { valor: "mixta", etiqueta: "Mixta", ayuda: "combina rápida y lenta" },
];

/**
 * Marcas reales del mercado argentino, cada una con su clase. Reemplaza el texto
 * libre por una lista taxativa (paso 9.5). Fuera de esta lista, la UI ofrece
 * "Otra" (texto libre) y "No sé" (marca null). Las mixtas se cargan por "Otra"
 * en el onboarding; en /perfil se pueden elegir explícitamente.
 */
export const MARCAS_INSULINA: ReadonlyArray<{
  marca: string;
  clase: ClaseInsulina;
}> = [
  // Rápidas / ultrarrápidas
  { marca: "Humalog", clase: "rapida" },
  { marca: "NovoRapid", clase: "rapida" },
  { marca: "Apidra", clase: "rapida" },
  { marca: "Fiasp", clase: "rapida" },
  // Basales / lentas
  { marca: "Lantus", clase: "basal" },
  { marca: "Toujeo", clase: "basal" },
  { marca: "Tresiba", clase: "basal" },
  { marca: "Levemir", clase: "basal" },
  { marca: "NPH", clase: "lenta" },
  // Mixtas
  { marca: "NovoMix", clase: "mixta" },
  { marca: "Humalog Mix", clase: "mixta" },
];

/** Marcas del slot "rápida" del onboarding. */
export const MARCAS_RAPIDAS = MARCAS_INSULINA.filter((m) => m.clase === "rapida");

/** Marcas del slot "basal / lenta" del onboarding (basales + NPH). */
export const MARCAS_BASAL_LENTA = MARCAS_INSULINA.filter(
  (m) => m.clase === "basal" || m.clase === "lenta"
);

/** Marcas de una clase dada (para el dropdown de /perfil). */
export function marcasDeClase(clase: ClaseInsulina) {
  return MARCAS_INSULINA.filter((m) => m.clase === clase);
}

/** clase real de una marca conocida; null si es libre/desconocida. */
export function claseDeMarca(marca: string): ClaseInsulina | null {
  const m = MARCAS_INSULINA.find(
    (x) => x.marca.toLowerCase() === marca.trim().toLowerCase()
  );
  return m ? m.clase : null;
}

/** Opciones de sexo para el onboarding/perfil. */
export const OPCIONES_SEXO: ReadonlyArray<{
  valor: Sexo;
  etiqueta: string;
  /** Cómo se nombra en el contexto del prompt (solo masculino/femenino). */
  descripcion: string;
}> = [
  { valor: "masculino", etiqueta: "Masculino", descripcion: "masculino" },
  { valor: "femenino", etiqueta: "Femenino", descripcion: "femenino" },
  { valor: "prefiero_no_decir", etiqueta: "Prefiero no decir", descripcion: "" },
];

/**
 * IMC redondeado a 1 decimal, o null si falta un dato o es inválido. Es contexto
 * interno; NUNCA material de comentario evaluativo (ver construirContextoPerfil).
 */
export function calcularImc(
  pesoKg: number | null,
  alturaCm: number | null
): number | null {
  if (pesoKg === null || alturaCm === null) return null;
  if (pesoKg <= 0 || alturaCm <= 0) return null;
  const metros = alturaCm / 100;
  const imc = pesoKg / (metros * metros);
  if (!Number.isFinite(imc)) return null;
  return Math.round(imc * 10) / 10;
}

export function esTipoDiabetes(valor: unknown): valor is TipoDiabetes {
  return (
    typeof valor === "string" &&
    OPCIONES_TIPO_DIABETES.some((o) => o.valor === valor)
  );
}

export function esClaseInsulina(valor: unknown): valor is ClaseInsulina {
  return (
    typeof valor === "string" &&
    OPCIONES_CLASE_INSULINA.some((o) => o.valor === valor)
  );
}

export function esSexo(valor: unknown): valor is Sexo {
  return (
    typeof valor === "string" && OPCIONES_SEXO.some((o) => o.valor === valor)
  );
}

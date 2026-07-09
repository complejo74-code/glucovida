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

/** Perfil que se lee de `usuario` para personalizar (subconjunto relevante). */
export interface PerfilUsuario {
  tipoDiabetes: TipoDiabetes | null;
  anioNacimiento: number | null;
  /** nullable a propósito: null = "prefiero no decir" o sin responder. */
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

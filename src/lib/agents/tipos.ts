/**
 * Tipos compartidos del sistema de agentes — v1
 */

export type AgenteId = "nutricion" | "insulina" | "emocional";

export interface Subagente {
  id: AgenteId;
  /** Descripción corta que usa el clasificador para decidir el ruteo. */
  descripcion: string;
  /** Bloque de especialidad que se suma al system prompt (nunca reemplaza seguridad). */
  especialidad: string;
}

/** Resultado del ruteo, para observabilidad. Nunca se envía al cliente. */
export interface ResultadoRuteo {
  agentes: AgenteId[];
  /** true si el pre-filtro de seguridad tomó el control (sin clasificación). */
  emergencia: boolean;
  /** "clasificador" | "prefiltro" | "fallback" (clasificación falló o sin match) */
  via: "clasificador" | "prefiltro" | "fallback";
}

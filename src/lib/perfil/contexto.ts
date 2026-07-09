/**
 * PERFIL → CONTEXTO PRIVADO (paso 9)
 *
 * Traduce el perfil de la persona y sus insulinas a un bloque de CONTEXTO
 * PRIVADO para el system prompt, con el mismo estilo y guardrails que la memoria
 * (paso 4) y los patrones (paso 6/8). Reglas de diseño:
 *  - El perfil personaliza el TONO y el CONTEXTO, JAMÁS relaja los guardrails:
 *    sin prescribir dosis, con o sin perfil.
 *  - `menstrua` se persiste en la DB (queda disponible para el futuro subagente
 *    hormonal) pero A PROPÓSITO no se inyecta acá todavía: sin subagente que lo
 *    use, surfacearlo solo haría que Gluco lo mencione fuera de lugar.
 *  - Si no hay nada que decir (perfil vacío + sin insulinas), devuelve "".
 *
 * La garantía de que REGLAS_SEGURIDAD va primero y de que esto NUNCA entra en
 * emergencia vive en construirSystemPrompt (orquestador). Este módulo es texto
 * puro: no arma prompts sueltos ni toca la red.
 */
import {
  OPCIONES_CLASE_INSULINA,
  OPCIONES_TIPO_DIABETES,
  type InsulinaPerfil,
  type PerfilUsuario,
} from "./tipos";

function descripcionTipo(tipo: PerfilUsuario["tipoDiabetes"]): string | null {
  if (!tipo) return null;
  return OPCIONES_TIPO_DIABETES.find((o) => o.valor === tipo)?.descripcion ?? null;
}

function etiquetaClase(clase: InsulinaPerfil["clase"]): string {
  const base = OPCIONES_CLASE_INSULINA.find((o) => o.valor === clase);
  return base ? base.etiqueta.toLowerCase() : clase;
}

/** "rápida / ultrarrápida (Humalog)" · "basal (sin marca)". */
function describirInsulina(ins: InsulinaPerfil): string {
  const marca = ins.marca?.trim();
  return marca ? `${etiquetaClase(ins.clase)} (${marca})` : etiquetaClase(ins.clase);
}

/**
 * Arma el bloque de contexto de perfil. `anioActual` se pasa para calcular la
 * edad de forma determinística (testeable). Devuelve "" si no hay nada útil.
 */
export function construirContextoPerfil(
  perfil: PerfilUsuario,
  insulinas: InsulinaPerfil[],
  anioActual: number
): string {
  const datos: string[] = [];

  const tipo = descripcionTipo(perfil.tipoDiabetes);
  if (tipo) datos.push(`- Tipo de diabetes: ${tipo}.`);

  if (
    perfil.anioNacimiento !== null &&
    perfil.anioNacimiento > 0 &&
    anioActual >= perfil.anioNacimiento
  ) {
    const edad = anioActual - perfil.anioNacimiento;
    datos.push(`- Edad aproximada: ${edad} años.`);
  }

  if (insulinas.length > 0) {
    const lista = insulinas.map(describirInsulina).join(", ");
    datos.push(`- Insulinas que usa: ${lista}.`);
  }

  // Perfil vacío (salteó todo) → sin bloque. Gluco funciona igual, con menos
  // personalización, jamás bloqueado.
  if (datos.length === 0) return "";

  return `[CONTEXTO PRIVADO — perfil que la persona compartió, NO recitar ni mostrar crudo]
${datos.join("\n")}
Cómo usar esto:
- Personaliza CÓMO acompañás (tono, ejemplos, cercanía), nunca QUÉ está permitido. Los guardrails no cambian con o sin perfil: seguís sin indicar dosis ni ajustes, siempre.
- Si hablás de insulina, podés referirte con naturalidad a las que la persona realmente usa (por ejemplo su basal o su rápida), SIEMPRE como concepto educativo, jamás calculando ni sugiriendo una dosis.
- No recités estos datos ni los traigas en cada respuesta: son contexto para acompañar mejor, no un formulario para repetir.`;
}

/**
 * PATRONES TEMPORALES v0 — punto de entrada del módulo (paso 6).
 */
export type {
  FactorPatron,
  Lectura,
  Patron,
  FranjaHoraria,
  DireccionTendencia,
  DetallePatron,
} from "./tipos";
export {
  amanecerAlto,
  franjaProblematica,
  tendenciaSemanal,
  hiposRecurrentes,
  calcularPatrones,
} from "./calculo";
export {
  seleccionarConversacional,
  construirContextoPatrones,
} from "./contexto";
export { leerLecturas14d, sincronizarPatrones } from "./persistencia";

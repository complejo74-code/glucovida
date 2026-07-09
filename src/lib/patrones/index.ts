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
  FactorCruce,
  PatronCruzado,
  GrupoComparado,
  DetalleCruce,
  DetalleSuenoAmanecer,
  DetalleEstresGlucemia,
} from "./tipos";
export {
  amanecerAlto,
  franjaProblematica,
  tendenciaSemanal,
  hiposRecurrentes,
  calcularPatrones,
} from "./calculo";
export { suenoVsAmanecer, estresVsGlucemia, calcularCruces } from "./cruces";
export {
  seleccionarConversacional,
  seleccionarMencion,
  construirContextoPatrones,
} from "./contexto";
export { leerLecturas14d, sincronizarPatrones } from "./persistencia";

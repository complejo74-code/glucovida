/**
 * GATE DE ONBOARDING (paso 9) — lógica pura, testeable sin red.
 *
 * Decide si un usuario autenticado debe ser redirigido a /onboarding.
 * FAILSAFE INNEGOCIABLE: el estado se representa como boolean | null, donde
 * `null` = "no se pudo determinar" (error de red/Supabase). En ese caso el gate
 * FALLA ABIERTO: deja pasar. Un problema de infraestructura jamás puede
 * convertirse en una pared que deja al usuario afuera de su propia app.
 *
 * - onboardingCompleto === false → redirige a /onboarding (salvo rutas exentas).
 * - onboardingCompleto === true  → deja pasar.
 * - onboardingCompleto === null  → deja pasar (fail-open).
 */

/**
 * Rutas donde NUNCA redirigimos a onboarding: /onboarding (evita loop), /login
 * y /auth (flujo de sesión), y /api (un fetch no debe recibir un redirect a
 * HTML: rompería el res.json() del cliente).
 */
const RUTAS_EXENTAS = ["/onboarding", "/login", "/auth", "/api"];

function esRutaExenta(pathname: string): boolean {
  return RUTAS_EXENTAS.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
}

/**
 * ¿Hay que redirigir a /onboarding? Solo cuando sabemos con certeza que está
 * incompleto (=== false) y la ruta no está exenta. `true` y `null` dejan pasar.
 */
export function requiereOnboarding(
  pathname: string,
  onboardingCompleto: boolean | null
): boolean {
  if (onboardingCompleto !== false) return false; // true o null (fail-open) → pasa
  if (esRutaExenta(pathname)) return false;
  return true;
}

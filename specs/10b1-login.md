═══════════════════════════════════════════════════════════
SPEC — PASO 10B-1: REDISEÑO DE LA PANTALLA DE LOGIN
═══════════════════════════════════════════════════════════

OBJETIVO
Rediseñar /login usando la infraestructura del 10A (tokens, Nunito, shadcn),
siguiendo docs/BRANDING.md al pie de la letra. Es la primera pantalla que
alguien ve — tiene que sentirse cálida, no clínica.

REQUISITOS

R1. Fondo: gradiente celeste→blanco (linear-gradient con primary-air y white,
    nunca oscuro), mucho aire alrededor del formulario.
R2. Logo/nombre "GlucoVida" arriba, con la gota o ícono si existe, tipografía
    Nunito 800/900.
R3. Copy cálido en vez de clínico:
    - Título: algo como "Bienvenido a tu lugar" o similar en tono del branding,
      NO "Iniciar sesión" seco.
    - Tabs o toggle "Ingresar / Registrarme" con radio de pill (999px).
R4. Inputs (email, contraseña) usando el componente Input de shadcn ya
    tokenizado, border-radius consistente con el sistema (no 28px como cards,
    usar un radio intermedio cómodo para inputs, defini y documentá cuál).
R5. Botón primario de login/registro: gradiente celeste, pill, hover con la
    sombra celeste definida en tokens (0 15px 35px rgba(34,167,230,0.25)).
R6. Estados de error usando el tono de voz del branding, NUNCA mensajes crudos
    de Supabase. Ejemplos: credenciales inválidas → algo cálido, no "Invalid
    login credentials". Usar la tabla de tono de docs/BRANDING.md como base.
R7. Mantener TODA la lógica existente intacta: Server Actions de login/registro,
    validaciones, redirects, el flujo de confirmación de email. Este paso es
    SOLO visual — cero cambios de lógica o de auth.
R8. Responsive: se ve bien en mobile (viewport angosto), que es el uso real.

EDGE CASES
- Si Supabase devuelve un error no contemplado en la tabla de tono, usar un
  fallback cálido genérico, nunca mostrar el error crudo.
- El loading state del botón (mientras autentica) debe tener feedback visual
  (no quedar "colgado" sin indicación).

DEFINICIÓN DE DONE (verificable)
[ ] /login usa el gradiente celeste→blanco de fondo
[ ] Tipografía Nunito visible en título y labels
[ ] Inputs y botón usan los componentes shadcn tokenizados (no CSS suelto)
[ ] Botón primario con gradiente + pill + sombra celeste en hover
[ ] Ningún mensaje de error crudo de Supabase llega al usuario
[ ] El login y el registro siguen funcionando exactamente igual que antes
    (mismo comportamiento, solo cambia la presentación)
[ ] Se ve bien en mobile (probado en viewport angosto)
[ ] Tests siguen verdes; next build limpio

═══════════════════════════════════════════════════════════

GUARDRAILS DEL LOOP:
- Cero cambios en la lógica de autenticación, Server Actions o redirects.
  Si "mejorar el diseño" te tienta a tocar la lógica, no lo hagas — reportalo
  como sugerencia aparte.
- No toques archivos de seguridad ni de otros flujos (chat, patrones, perfil).
- No aflojes tests.
- Corré next build antes de darlo por cerrado (ya sabemos que tsc/eslint no
  alcanzan solos).
- FRENÁ antes de commitear. Mostrame capturas o descripción de cómo quedó
  antes de que yo apruebe.

Corré el loop hasta que la definición de done pase completa. Frená ahí,
SIN commitear — quiero ver cómo quedó antes de aprobar.

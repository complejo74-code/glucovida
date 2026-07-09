# Perfil y onboarding (paso 9)

Captura el contexto que **personaliza a todos los subagentes** sin tocar jamás
los guardrails. El perfil cambia el **tono y el contexto** de Gluco; nunca lo
que está permitido. Sin prescribir dosis, con o sin perfil.

## Qué se guarda

- **`usuario`** (ampliada por `003_perfil.sql`): `tipo_diabetes` (ahora con
  `'otro'`), `anio_nacimiento` (edad sin fecha exacta), `menstrua` (nullable),
  `onboarding_completo`.
- **`insulina_usuario`** (tabla nueva): varias por usuario, `clase` +
  `marca` + `activa`. RLS con las 4 políticas (`auth.uid() = usuario_id`).

Todo bajo el cliente de sesión (RLS). Nada usa `service_role`.

## Onboarding (`/onboarding`)

Wizard de 4 pasos, uno por pantalla, mobile-first y cálido (no una ficha de
guardia). Cada paso explica **por qué** se pregunta — la transparencia genera
confianza.

1. Tipo de diabetes (botones, no texto libre).
2. Año de nacimiento (edad aproximada, sin fecha exacta).
3. ¿Menstruás? → **Sí / No / Prefiero no decir**. "Prefiero no decir" tiene el
   mismo peso visual que responder y deja `menstrua = null`: saltear la pregunta
   más íntima debe sentirse tan natural como contestarla.
4. Insulinas (clase + marca, varias, o "no uso").

**Todo es salteable.** Nunca se bloquea el uso: quien no quiere responder algo
sigue igual, Gluco funciona con menos personalización. Al terminar (o saltear
todo), `onboarding_completo = true` y va al chat.

### Cierre resiliente

`guardarOnboarding` setea `onboarding_completo=true` **siempre**. Si el UPDATE
del perfil falla, se reintenta **solo** el cierre: así el gate no rebota a la
persona de vuelta a `/onboarding` en loop. El onboarding no puede ser una pared.

## Gate (`middleware.ts` + `src/lib/perfil/gate.ts`)

Si `onboarding_completo = false`, el usuario autenticado es redirigido a
`/onboarding` (cubre la navegación directa a `/chat`). La decisión vive en la
función **pura** `requiereOnboarding(pathname, onboardingCompleto)`, testeable
sin red.

**FAILSAFE (innegociable):** el estado es `boolean | null`, donde `null` = "no se
pudo determinar" (error de red/Supabase). En ese caso el gate **falla ABIERTO**:
deja pasar a `/chat`. Un problema de infraestructura jamás puede convertirse en
una pared que deja a la persona afuera de su propia app. Solo un `false`
explícito redirige; `true` y `null` dejan pasar.

Rutas exentas (nunca redirigen a onboarding): `/onboarding` (evita loop),
`/login`, `/auth` y `/api` (un `fetch` no debe recibir un redirect a HTML).

## Personalización del prompt

`buildPerfilContext` (`/api/chat`, RLS) lee el perfil + insulinas activas y arma
un bloque de **CONTEXTO PRIVADO** con la misma disciplina que la memoria (paso 4)
y los patrones (paso 6/8). `construirSystemPrompt` lo inyecta con el parámetro
`perfil`, **después de seguridad y especialidades**.

- **Gate estructural: nunca en emergencia.** El protocolo 15/15 es **ciego al
  perfil**: en una hipo la respuesta es una sola para todos. El perfil
  personaliza fuera de la emergencia. Doble gate (en `route.ts` y en
  `construirSystemPrompt`), como patrones y variables.
- El subagente insulina puede referirse a las insulinas reales de la persona
  (ej. su basal), **siempre educativo, jamás calculando dosis**.
- **`menstrua` no se surfacea todavía.** Se persiste y queda disponible para el
  futuro **subagente hormonal** (no construido en este paso). Inyectarlo ahora,
  sin un subagente que lo use, solo haría que Gluco lo mencione fuera de lugar.
- Si la persona salteó todo, el bloque es `""` y Gluco funciona igual.

## Perfil editable (`/perfil`)

Las cosas cambian (nueva insulina, etc.). Server Component que carga con RLS +
form cliente para editar tipo/año/menstrua y agregar/quitar insulinas. No toca
`onboarding_completo`. Accesible desde el header del chat.

## Tests

- `__tests__/perfil-contexto.test.ts` — formateo del bloque: perfil vacío → `""`,
  edad, insulinas con/sin marca, reiteración de guardrails, `menstrua` no
  surfaceada.
- `__tests__/perfil-gate.test.ts` — incluye el **fail-open** ante `null` y las
  rutas exentas.
- `__tests__/orquestador.test.ts` — perfil tras seguridad, **nunca en
  emergencia**, no pisa las especialidades.

## Migración

`supabase/migrations/003_perfil.sql` es idempotente y NO destructiva
(`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` + recreate, `CREATE
TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` + create). **La aplica el dueño de
la DB manualmente.**

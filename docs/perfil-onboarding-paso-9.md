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

---

# Perfil ampliado (paso 9.5)

Afina el onboarding para que el contexto personalice mejor **el registro** con
que Gluco acompaña (un adolescente, un adulto y una persona mayor necesitan
tonos distintos), sin tocar el diseño visual (eso es un paso aparte con el
branding) y **sin relajar jamás los guardrails**.

## Qué cambió

- **Nombre (requerido).** Primer paso del onboarding: "¿Cómo querés que te
  llame?". Es lo único obligatorio. En DB `nombre` es **nullable** (agregarlo
  `NOT NULL` sobre filas existentes rompería la no-destructividad); la
  obligatoriedad se hace en la UI. Gluco lo usa con naturalidad, sin abusar.
- **Sexo.** Reemplaza a la pregunta de menstruación en el wizard:
  `masculino` / `femenino` / `prefiero no decir`. Se surfacea al contexto **solo
  si es masculino/femenino** (el resto no aporta tono). **Menstruá ya no se
  pregunta** (la columna se conserva para el futuro subagente hormonal).
- **Peso y altura.** `peso_kg` (numeric) + `altura_cm` (int), ambos con `CHECK`
  de rango sano y nullable. Del par se deriva el **IMC**.
- **Insulinas taxativas.** El texto libre de marca pasa a una **lista real del
  mercado argentino** agrupada por clase (rápidas: Humalog/NovoRapid/Apidra/Fiasp
  · basales-lentas: Lantus/Toujeo/Tresiba/Levemir/NPH · mixtas:
  NovoMix/Humalog Mix), siempre con **"Otra"** (texto libre) y **"No sé"**. El
  onboarding pide la **rápida** y la **basal/lenta por separado** (dos slots), y
  las mixtas se cargan por "Otra". En `/perfil` se elige clase → marca (dropdown
  por clase, incluye mixtas). Catálogo en `src/lib/perfil/tipos.ts`.

## Onboarding (ahora 6 pasos)

Nombre (**requerido**) → tipo de diabetes → año → sexo → peso/altura →
insulinas (dos slots). Cada campo explica **por qué** en una línea. Todo
salteable **menos el nombre**.

## Uso en el contexto privado

`construirContextoPerfil` inyecta **nombre, edad, sexo, peso, altura e IMC**
(además de tipo e insulinas), con el mismo gate de siempre: **después de
seguridad, nunca en emergencia**. Guardrails reforzados en el bloque:

- **El peso y el IMC son contexto interno, JAMÁS material de comentario
  evaluativo.** Nada de "deberías bajar de peso", nada de dietas para adelgazar;
  si la persona no trae el tema del peso, Gluco tampoco.
- El **nombre** se usa con naturalidad, sin recitarlo ni repetirlo.
- Innegociable: **sin dosis, siempre**, con o sin perfil.

## Seguridad (code review del 9.5)

RLS: las columnas nuevas viven en `usuario`, cubiertas por su policy
`auth.uid() = id` — **no hizo falta ninguna policy nueva**. Todo con cliente de
sesión, cero `service_role`. Doble gate de emergencia intacto. Corrección
aplicada: "prefiero no decir" guarda `sexo='prefiero_no_decir'` (no `null`), para
que onboarding y `/perfil` registren la misma intención.

## Migración

`supabase/migrations/004_perfil_ampliado.sql`, idempotente y NO destructiva
(`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` + recreate). Conserva la
columna `menstrua`. **La aplica el dueño de la DB manualmente.**

# Paso 5.5 — Endurecimiento y limpieza

Cierra los 3 pendientes del code review del paso 5. No agrega features.

## 1. `detectarGlucosa` estricta (`src/lib/agents/seguridad.ts`)

**Problema:** la versión anterior podía guardar como glucemia números que no lo
eran (horas, edades, plata, cantidades), contaminando la memoria médica.

**Solución:** se evalúa cada número del mensaje con tres capas, en orden:

1. **Exclusiones** — se descarta el número si:
   - tiene formato de hora (`8:30`) o fecha (`15/07`);
   - lo sigue una unidad no glucémica: `hs`, `hora(s)`, `años`, `pesos`,
     `dólares`, `gramos`, `kg`, `minutos`, `días`, `%`, etc.;
   - lo precede `$`, `número`, `a las`, `línea`, `bondi`, etc.
2. **Contexto glucémico obligatorio** — solo se acepta si hay:
   - unidad explícita después (`mg/dl`, `mgdl`), o
   - palabra glucémica cerca antes (≤45 caracteres): `glucosa`, `glucemia`,
     `azúcar`, `me medí`, `medición`, `sensor`, `dexcom`, `freestyle`, o
   - frase corporal **inmediatamente** antes del número: `amanecí en/con`,
     `me desperté con`, `estoy en`, `quedé en` (sin palabras en el medio —
     "estoy en 62" sí, "estoy en la calle 62" no), o
   - palabra glucémica después: `190 de glucemia`.
3. **Rango plausible** — `[30, 600]` mg/dL.

Ante la duda → `null`. En salud, un dato faltante es mejor que un dato falso.

**Nota de seguridad:** `preFiltroSeguridad` depende de esta función para
detectar hipoglucemias (<70). Los tests verifican que "estoy en 62" sigue
disparando la emergencia con la detección endurecida.

### Doble umbral: persistir ≠ alertar

El code review detectó que endurecer la detección le quitaba sensibilidad al
pre-filtro de emergencia ("me dio 52" dejaba de disparar el 15/15). El costo
es asimétrico: para **persistir**, un falso positivo contamina la memoria
médica; para **alertar**, un falso negativo es una hipo sin protocolo.

Solución: `detectarHipoPosible` — detección laxa usada SOLO por
`preFiltroSeguridad`, nunca para guardar datos:

- Mismas exclusiones duras (horas, fechas, plata, unidades no glucémicas).
- Contexto más laxo: frases de medición ("me dio", "me marcó", "bajé a")
  o palabra glucémica en cualquier parte del mensaje.
- Rango [20, 69]: los glucómetros leen desde ~20; "mi glucemia es de 25"
  dispara emergencia aunque esté bajo el piso de guardado (30).

## 2. Autenticación estricta (`src/app/api/chat/route.ts`)

`POST /api/chat` verifica la sesión como **primera** operación. Sin usuario
autenticado responde `401` antes de leer el body, clasificar o llamar a
cualquier LLM. Verificado en vivo: `curl` sin cookies → `401`.

## 3. Observabilidad con RLS

`registrarObservabilidad` ahora recibe el cliente **con sesión** del usuario
(anon key + cookies). El insert en `evento` pasa por la política
`evento_insert_own` (`WITH CHECK auth.uid() = usuario_id`). No hizo falta
migración SQL: la política ya existía desde el paso 3.

`createAdminClient` (service_role) quedó **sin usos** en el flujo del chat.
El helper sigue existiendo en `src/lib/supabase/server.ts` — no se eliminó
porque el proyecto exige autorización explícita para borrar código.

## 4. Tests

- Runner: **Vitest** (`npm test`), config en `vitest.config.ts` con alias `@`.
- Suite: `__tests__/detectarGlucosa.test.ts` — 30 tests (11 positivos,
  16 negativos, 3 de integración con `preFiltroSeguridad`).
- Metodología: TDD — los tests se escribieron primero y fallaron (4 rojos:
  2 falsos positivos y 2 casos legítimos perdidos) antes de reescribir.

## Backlog conocido (decisión consciente, no bloqueante)

- `"glucemia:145"` (sin espacio después de `:`) no se detecta: `esHoraOFecha`
  descarta números precedidos por `:`. Con espacio (`"glucemia: 145"`)
  funciona. Pendiente de refinamiento futuro.
- Cerrado en esta misma iteración: `createAdminClient` eliminado de
  `server.ts` (sin usos tras la migración a RLS) y `docs/superpowers/`
  agregado a `.gitignore`. "me bajó a 55 el azúcar" sí alerta — verificado
  con test de regresión.

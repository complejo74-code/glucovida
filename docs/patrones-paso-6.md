# Paso 6 — Patrones temporales v0

Detección **determinística** de patrones sobre las glucemias que el usuario ya
tiene registradas. Matemática pura (nada de LLM para calcular); el LLM solo
comunica. Filosofía: un patrón falso es peor que ningún patrón. La memoria
contiene, no vigila.

## 1. Módulo `src/lib/patrones/`

| Archivo | Responsabilidad |
|---------|-----------------|
| `tipos.ts` | `Lectura`, `Patron`, `FactorPatron`, detalles por patrón |
| `calculo.ts` | La matemática determinística de los 4 patrones (sin LLM) |
| `contexto.ts` | Elige UN patrón y arma el bloque `[CONTEXTO PRIVADO …]` |
| `persistencia.ts` | Lee `evento` / sincroniza `patron`, siempre con RLS |
| `index.ts` | Exports |

Cada función de cálculo recibe `ahora` de forma explícita (determinismo y
testeabilidad: nada de `new Date()` interno).

### Los cuatro patrones (ventana 14 días salvo tendencia)

- **`amanecer_alto`** — promedio de lecturas con hora local 5–9 h vs. el resto
  del día. Reporta solo si el amanecer está **≥25 mg/dL más alto** (efecto real,
  no ruido).
- **`franja_problematica`** — franja horaria (madrugada/mañana/tarde/noche)
  donde **≥60%** de las lecturas superan 180 mg/dL. Devuelve la peor franja.
- **`tendencia_semanal`** — promedio de los últimos 7 días vs. los 7 anteriores.
  Dirección **neutra**: `baja` / `sube` / `estable`. A propósito NO decimos
  "mejora/empeora": eso sería un veredicto clínico en el dato. El matiz cálido
  lo pone Gluco al comunicar, no la tabla.
- **`hipos_recurrentes`** — 2+ lecturas <70 en 14 días. No es un patrón "de
  charla": dispara una invitación firme y cálida a llevarlo al equipo médico.

## 2. Rigor estadístico (factor 41, innegociable)

- `MIN_LECTURAS = 5`: ningún patrón conversacional se reporta sin **≥5 lecturas
  en cada grupo que compara** (5 en amanecer *y* 5 en el resto; 5 en cada
  semana). Con menos datos → `null` → Gluco no dice nada.
- Cada patrón lleva `n_observaciones` y `confianza ∈ [0,1]`. La confianza es un
  **proxy de robustez por tamaño de muestra** (satura en n=12); es una heurística
  v0 explícita, **no** un p-value.
- **Excepción `hipos_recurrentes`:** salta el piso de 5. 2 hipos son señal
  aunque haya pocos datos totales — mismo criterio asimétrico que el pre-filtro
  de emergencia del paso 5.5 (`detectarHipoPosible`).

### Zona horaria

`ocurrido_en` se guarda en UTC y el server corre en UTC. Las horas ("5–9 h",
franjas) se leen en **hora local rioplatense** (`America/Argentina/Buenos_Aires`)
vía `Intl`. Sin esto, "amanecer" saldría corrido 3 horas. **Backlog:** hoy la
zona es una constante; con usuarios fuera de Argentina debe salir del perfil.

## 3. Tabla `patron` (`supabase/migrations/002_patrones.sql`)

Columnas: `id`, `usuario_id`, `factor`, `efecto_estimado`, `n_observaciones`,
`confianza`, `detalle jsonb`, `actualizado_en`. `UNIQUE (usuario_id, factor)` →
recalcular es un **upsert idempotente** (una fila por tipo de patrón por
usuario). Se recalcula al procesar cada mensaje; sin cron (los datos son pocos y
el cálculo es barato).

**RLS — espejo de `evento`, con las 4 políticas** (`select`/`insert`/`update`/
`delete`), todas `auth.uid() = usuario_id`. Hacen falta `update` (upsert) y
`delete` (borrar patrones que dejaron de aplicar). El índice del `UNIQUE`
también sirve las lecturas por `usuario_id`; no hay índice extra.

`sincronizarPatrones` hace **upsert de los activos** y **delete de los
inactivos**, siempre con el cliente con sesión (RLS). Nada usa `service_role`.

## 4. Comunicación (regla de diseño de salud)

`construirContextoPatrones` arma un bloque privado que se inyecta en el system
prompt, igual que la memoria del paso 4:

- **Como máximo UN patrón conversacional** por conversación — el de mayor
  confianza (desempate por prioridad fija). Una tendencia `estable` no es
  material conversacional (no hay nada que observar).
- Planteado como **pregunta u observación suave** ("¿notaste que…?"). Jamás
  diagnóstico, jamás nombre clínico, jamás alarma o vigilancia.
- **`hipos_recurrentes` siempre se comunica** (con calidez, sin asustar)
  recomendando charlarlo con el médico/a.

### Garantías estructurales en el prompt (`orquestador.ts`)

- `REGLAS_SEGURIDAD` sigue yendo **primero** en todos los caminos; los patrones
  se agregan al final, después de la memoria.
- **Gate de emergencia estructural:** `construirSystemPrompt` **nunca** inyecta
  patrones cuando `emergencia === true`, sin depender de que el caller pase
  `patrones=""`. No se diluye el 15/15 con patrones.
- En el route, el cálculo/persistencia de patrones corre **después** de la
  observabilidad (para incluir la lectura recién guardada) y **solo si no hay
  emergencia**. Cualquier error va a `try/catch` y nunca rompe la respuesta.

## 5. Tests

- `__tests__/patrones.test.ts` (23) — toda la matemática con datos sintéticos y
  `ahora` inyectado: datos suficientes/insuficientes, umbral de efecto, bordes
  de ventana (7 d y 14 d), zona horaria, el caso `hipos_recurrentes` (incluida
  su excepción al piso de 5) y el selector conversacional (un solo patrón,
  hipos siempre, estable no).
- `__tests__/orquestador.test.ts` (4) — invariantes del prompt: seguridad
  primero, patrones inyectados fuera de emergencia, patrones **nunca** en
  emergencia.
- Metodología TDD: los tests de la matemática se escribieron primero.

## 6. Code review

Verificado: (a) RLS completa y acotada en `patron`; (b) aislamiento entre
usuarios doblemente reforzado (filtro `usuario_id` + RLS en lectura, upsert y
delete) — ningún patrón cruza de usuario; (c) guardrails intactos en todos los
caminos. Correcciones aplicadas en el review: gate de emergencia movido dentro
de `construirSystemPrompt` (estructural) e índice redundante `idx_patron_usuario`
eliminado.

## Backlog conocido (no bloqueante)

- Zona horaria fija en rioplatense; debe salir del perfil del usuario cuando
  haya usuarios fuera de Argentina.
- Recálculo en cada mensaje (2 round-trips extra a la DB). Aceptable para v0;
  candidato a debounce/cron cuando el volumen de datos crezca.

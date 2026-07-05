# Changelog — GlucoVida (chat web)

Todos los cambios notables de este proyecto se documentan acá.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [Paso 6] — 2026-07-05 — Patrones temporales v0

### Agregado
- Módulo `src/lib/patrones/` con detección **determinística** (sin LLM para la matemática) de 4 patrones sobre las glucemias del usuario: `amanecer_alto` (5–9 h local vs. resto, ≥25 mg/dL), `franja_problematica` (franja con ≥60% de lecturas >180), `tendencia_semanal` (7 d vs. 7 d, dirección neutra baja/sube/estable) y `hipos_recurrentes` (2+ <70 en 14 días).
- Rigor estadístico (factor 41): ningún patrón conversacional se reporta sin ≥5 lecturas por grupo. Cada patrón lleva `n_observaciones` y `confianza` (proxy por tamaño de muestra, no es un p-value). `hipos_recurrentes` es la excepción: salta el piso de 5 (2 hipos son señal aunque haya pocos datos).
- Horas leídas en hora local rioplatense (`America/Argentina/Buenos_Aires`) vía `Intl`, porque `ocurrido_en` está en UTC.
- Migración `002_patrones.sql`: tabla `patron` (`factor`, `efecto_estimado`, `n_observaciones`, `confianza`, `detalle jsonb`, `actualizado_en`) con `UNIQUE (usuario_id, factor)` y **RLS espejo de `evento`** con las 4 políticas (select/insert/update/delete, todas `auth.uid() = usuario_id`).
- Los patrones se recalculan (upsert idempotente) al procesar cada mensaje y se inyectan al system prompt como contexto privado: como máximo UN patrón conversacional (observación suave, nunca diagnóstico), y `hipos_recurrentes` siempre comunicado recomendando al médico.
- Tests: `__tests__/patrones.test.ts` (23) para toda la matemática y `__tests__/orquestador.test.ts` (4) para los invariantes del prompt. Total 64 tests.
- Documentación en `docs/patrones-paso-6.md` y `DB_SCHEMA.md`.

### Cambiado
- `construirSystemPrompt` acepta un parámetro `patrones` que se inyecta después de la memoria, siempre con `REGLAS_SEGURIDAD` primero. **Gate estructural de emergencia:** nunca inyecta patrones cuando `emergencia === true` (no depende del caller). `src/lib/agents/orquestador.ts`.
- `/api/chat` calcula, persiste (RLS) e inyecta patrones después de la observabilidad y solo fuera de emergencia; cualquier error va a `try/catch` y nunca rompe la respuesta.
- Tabla `patron` tipada en `src/lib/supabase/types.ts`.

### Notas del code review
- Aislamiento entre usuarios doblemente reforzado (filtro `usuario_id` + RLS en lectura, upsert y delete): ningún patrón cruza de usuario.
- Correcciones aplicadas: gate de emergencia movido dentro de `construirSystemPrompt`; índice redundante `idx_patron_usuario` eliminado (lo cubre el índice del `UNIQUE`).

## [Paso 5.5] — 2026-07-05 — Endurecimiento y limpieza

### Cambiado
- `detectarGlucosa` reescrita con criterio estricto: contexto glucémico obligatorio cerca del número, rango plausible 30–600 mg/dL, exclusión de horas/fechas/unidades no glucémicas (hs, años, pesos, gramos, minutos, $). Ante la duda, no guarda (`src/lib/agents/seguridad.ts`).
- `/api/chat` exige sesión válida: sin usuario autenticado responde `401` antes de procesar el body o llamar a cualquier LLM.
- Observabilidad del ruteo migrada del admin client (service_role) al cliente con sesión del usuario — el insert en `evento` ahora pasa por RLS (`evento_insert_own`). Nada en el flujo del chat usa service_role.

### Agregado
- `detectarHipoPosible`: detección laxa de hipoglucemia [20–69] usada SOLO por el pre-filtro de emergencia (nunca persiste datos) — doble umbral persistir/alertar surgido del code review.
- Vitest como test runner (`npm test`) y suite de 37 tests unitarios de `detectarGlucosa` y `preFiltroSeguridad` con casos positivos y negativos, incluyendo "me bajó a 55 el azúcar" → alerta (`__tests__/detectarGlucosa.test.ts`).

### Eliminado
- `createAdminClient` (service_role) de `src/lib/supabase/server.ts`: quedó sin usos tras migrar la observabilidad a RLS. La historia queda en git si algún día se necesita conscientemente.
- `docs/superpowers/` ignorado en git (planes internos de trabajo, no documentación del producto).
- Este CHANGELOG, con entradas retroactivas de los pasos 1 a 5.
- Documentación del endurecimiento en `docs/endurecimiento-paso-5-5.md`.

## [Paso 5] — 2026-07-05 — Orquestador con subagentes
- Orquestador con 3 subagentes (nutrición, insulina, emocional), pre-filtro determinístico de emergencias, clasificación con Haiku y observabilidad del ruteo (`a1071ee`).

## [Paso 4] — 2026-07-05 — Memoria conversacional
- Gluco lee el historial de glucemia del usuario con RLS y lo usa como contexto (`81d9796`).

## [Paso 3] — Persistencia con RLS
- Migración SQL: tablas `usuario` y `evento` con RLS completo y trigger de alta de usuario (`c70ece5`).
- Detección automática de glucosa en el chat y guardado en `evento` (`a435b1f`).
- Página de inicio redirige a `/chat` o `/login` según sesión (`6ee5961`).

## [Paso 2] — Login y sesión
- Pantalla de login/registro con Server Actions y confirmación de email (`00438cf`).
- Middleware de sesión Supabase y protección de la ruta `/chat` (`49bc07e`).
- Botón de logout en el header del chat (`e25541f`).

## [Paso 1] — Chat seguro
- Chat "Gluco" con Claude, reglas de seguridad innegociables (nunca dosis de insulina, protocolo 15/15, derivación a urgencias) y tono rioplatense empático.

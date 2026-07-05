# Changelog — GlucoVida (chat web)

Todos los cambios notables de este proyecto se documentan acá.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [Paso 5.5] — 2026-07-05 — Endurecimiento y limpieza

### Cambiado
- `detectarGlucosa` reescrita con criterio estricto: contexto glucémico obligatorio cerca del número, rango plausible 30–600 mg/dL, exclusión de horas/fechas/unidades no glucémicas (hs, años, pesos, gramos, minutos, $). Ante la duda, no guarda (`src/lib/agents/seguridad.ts`).
- `/api/chat` exige sesión válida: sin usuario autenticado responde `401` antes de procesar el body o llamar a cualquier LLM.
- Observabilidad del ruteo migrada del admin client (service_role) al cliente con sesión del usuario — el insert en `evento` ahora pasa por RLS (`evento_insert_own`). Nada en el flujo del chat usa service_role.

### Agregado
- `detectarHipoPosible`: detección laxa de hipoglucemia [20–69] usada SOLO por el pre-filtro de emergencia (nunca persiste datos) — doble umbral persistir/alertar surgido del code review.
- Vitest como test runner (`npm test`) y suite de 35 tests unitarios de `detectarGlucosa` y `preFiltroSeguridad` con casos positivos y negativos (`__tests__/detectarGlucosa.test.ts`).
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

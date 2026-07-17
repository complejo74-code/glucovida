# Build Coverage: Paso 10B-3 — Rediseño de la pantalla de chat

## Requirements
1. **R1 — Mismo lenguaje visual (tokens, Nunito, fix de contraste 10B-2)** — Done — `src/app/chat/page.tsx` — Fondo `bg-gradient-section`, Nunito (global vía layout), todo tokenizado. El bubble del usuario reusa el token del CTA (`bg-gradient-primary` + `text-primary-foreground` oscuro), es decir el gradiente **con** el ajuste AA del 10B-2, no el gradiente crudo.
2. **R2 — Burbujas (usuario derecha celeste, Gluco izquierda suave), radio propio documentado** — Done — `src/app/chat/page.tsx` + `tailwind.config.ts` + `docs/BRANDING.md §6` — Usuario a la derecha (`bg-gradient-primary`), Gluco a la izquierda (`bg-primary-air`). Token nuevo `rounded-bubble` (20px) con "colita" a 6px del lado del emisor; documentado en BRANDING §6.
3. **R3 — Chip de glucemia con colores semánticos, AA, no solo color** — Done — `estadoGlucosa`/`ChipGlucemia` en `src/app/chat/page.tsx`; excepción en `docs/BRANDING.md §3` — `danger`/`success`/`warning` según rango, texto oscuro sobre color/10 (AA), + ícono + texto factual + `sr-only`. Decisión del usuario: R3 literal (los 3 colores).
4. **R4 — Indicador "escribiendo" con animación sutil, no spinner** — Done — `src/app/chat/page.tsx` + `tailwind.config.ts` — Tres puntos con `animate-typing-dot` (blink escalonado por `[animation-delay]`), `sr-only` "Gluco está escribiendo…". Se anula con `prefers-reduced-motion` (globals.css existente).
5. **R5 — Input tokenizado shadcn + botón enviar circular** — Done — `src/app/chat/page.tsx` — Textarea con las mismas clases token que `Input`; botón `Button size="icon"` (44px, `rounded-pill` → círculo) con ícono lucide `Send`.
6. **R6 — Header sutil (Gluco + estado conexión), sin métricas** — Done — `src/app/chat/page.tsx` — 🩵 + "Gluco" + punto success + "En línea". Sin dashboard/métricas. Perfil/Salir como ghost.
7. **R7 — aria-live en contenedor de mensajes** — Done — `<main role="log" aria-live="polite" aria-relevant="additions">` — Anuncia mensajes nuevos y el "escribiendo" sin interrumpir (polite).
8. **R8 — Estado vacío cálido con chips de arranque** — Done — `src/app/chat/page.tsx` — Texto de bienvenida + 3 chips (`CHIPS_ARRANQUE`) visibles mientras `messages.length === 1`; al tocar envían.
9. **R9 — CERO cambios de lógica** — Done — `src/app/chat/page.tsx` — `fetch("/api/chat")`, body `{ messages }`, `catch` de error y manejo de estado idénticos. Único agregado: parámetro opcional `texto` en `sendMessage` (trigger, no lógica). `/api/chat`, orquestador, detectores, memoria, patrones **sin tocar**. `detectarGlucosa` se importa (solo lectura) sin modificarse.
10. **R10 — Responsive mobile-first, teclado no tapa el input** — Done — `src/app/chat/page.tsx` — `min-h-dvh` + `main flex-1 overflow-y-auto` + composer con `pb: env(safe-area-inset-bottom)`. Autoscroll suave en `[messages, loading]`.

## Edge Cases
- **Error de conexión con tono cálido** — Done — `catch` conserva el mensaje existente "Ups, tuve un problema de conexión. ¿Podés intentar de nuevo?" (ya on-brand; parte de la lógica de error que R9 pide no tocar).
- **Historial largo: scroll al último sin saltos bruscos** — Done — `bottomRef.scrollIntoView({ behavior: "smooth" })` en cada cambio de `messages`/`loading`.
- **Chip consistente en mensajes viejos vs. nuevos** — Done — el chip se recalcula por render con `detectarGlucosa` sobre cada mensaje de usuario, así todo el historial se ve igual (no solo los recién enviados).

## Definition of Done
- [x] Burbujas con lenguaje visual consistente con login/onboarding
- [x] Chip de glucemia con contraste AA + no depende solo del color
- [x] Indicador de "escribiendo" con animación sutil, no spinner
- [x] Input y botón de enviar tokenizados, ícono circular
- [x] `aria-live` en el contenedor de mensajes
- [x] Estado vacío cálido con chips de arranque
- [x] CERO cambios en `/api/chat`, orquestador, detección o memoria
- [x] Teclado mobile no tapa el input (viewport dinámico: `min-h-dvh` + safe-area)
- [x] Tests verdes (vitest 161/161); `next build` limpio

## Notes
- **Decisión del usuario (R3):** se eligió "R3 literal" — los tres colores semánticos para el chip (danger/success/warning). Choca a propósito con BRANDING §3 (que reserva esos colores para estados de app); se documentó como **excepción única y consciente** en §3, manteniéndose fiel al §9 en el lenguaje (nunca "bueno/malo", siempre rango factual).
- **`detectarGlucosa` client-side:** para el chip sin cambiar la API (que solo devuelve `{ reply }`), se reusa el detector **puro** en el cliente, display-only. No modifica ninguna lógica de servidor.
- **Rangos del chip:** `<70` baja, `70–180` en rango, `>180` alta (ADA-ish). El umbral `<70` coincide con el de hipoglucemia del pre-filtro de seguridad.
- **Reviews del loop:** los subagentes `Code Reviewer` y `Accessibility Auditor` se despacharon pero murieron por un error de límite de sesión (falla de infra, no del código), así que las dos revisiones se hicieron **inline**. Code review: sin hallazgos de correctness; R9 verificado (ningún call site pasa un evento a `sendMessage`, así que el parámetro opcional es seguro; body/catch idénticos). Accessibility: contraste AA verificado por cálculo (chip ~15:1 texto oscuro sobre color/10; burbuja usuario 4.99–6.58:1; Gluco ~14:1; "En línea" 5.45:1; muted del estado vacío ≥4.53:1 en el peor punto del gradiente, consistente con lo aprobado en 10B-2); todos los targets táctiles ≥44px (send/chips/Perfil/Salir/textarea); `role="log"`+`aria-live` verificados. **Fixes aplicados:** (1) el título "Gluco" pasó de `<p>` a `<h1>` (heading/landmark); (2) el `role="log"` se movió a un `<div>` interno para conservar `<main>` como landmark (antes el role sobreescribía el landmark).
- Out of scope no tocado: no se agregó persistencia de historial ni streaming; el copy del error se dejó como estaba (R9).

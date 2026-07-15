# Build Coverage: Rediseño del Onboarding (10B-2)

## Requirements

1. **R1 — Mismo lenguaje visual que /login** (fondo celeste→blanco, card blanca
   28px, Nunito, botones pill con gradiente) — Done — `src/app/onboarding/page.tsx` —
   Contenedor `bg-gradient-section`, card `rounded-card border-border shadow-card-hover`,
   Nunito global, botones vía shadcn `Button` (pill + `bg-gradient-primary`). Mismos
   tokens/componentes que `src/app/login/page.tsx`.
2. **R2 — Indicador de progreso de 6 pasos, suave (no burocrático)** — Done —
   `page.tsx` (bloque `role="progressbar"`) — 6 segmentos `flex-1` celestes
   (`bg-gradient-primary` cumplidos / `bg-primary-air` pendientes), sin número frío
   visible; el "3/6" queda solo en `aria-label` para lectores de pantalla.
3. **R3 — Transición entre pasos (fade + slight slide), no salto brusco** — Done —
   `tailwind.config.ts` (keyframes `fade-slide-in`/`float`) + `page.tsx` (`<div key={paso}
   className="animate-fade-slide-in">`). El `key={paso}` remonta y re-anima cada paso.
4. **R4 — "Por qué preguntamos esto" con jerarquía visual clara** — Done — `page.tsx`
   (`Pregunta`) — título `text-xl font-extrabold`, porqué debajo en `text-sm text-muted`
   pegado al campo. Presente en los 6 pasos.
5. **R5 — "Prefiero seguir" con la misma prioridad visual que "Continuar" (salvo
   nombre)** — Done — `page.tsx` (`AccionesPaso`) — pares de dos botones `outline`
   idénticos (mismo `size="lg"`, mismo contraste, `flex-1`), diferenciados solo por
   etiqueta. Nombre (paso 0) es el único sin saltar. Sexo usa "Prefiero no decir" como
   card de igual peso; tipo diabetes tiene su "Prefiero seguir" outline de ancho completo.
6. **R6 — Tipo de diabetes con botones-card, no select** — Done — `page.tsx`
   (`PasoTipo` + `OpcionCard`) — grilla 2 columnas de cards `min-h-14`, estado activo con
   borde primary + `bg-primary-air`.
7. **R7 — Insulinas: dos slots diferenciados + Select tokenizado** — Done — `page.tsx`
   (`PasoInsulinas` + `SlotSelector`) — cada slot en su sub-tarjeta (`border` + `bg-primary-air/40`),
   dropdown = shadcn `Select` (`@/components/ui/select`).
8. **R8 — Pantalla de cierre cálida antes del chat** — Done — `page.tsx` (rama
   `paso === TOTAL_PASOS`) — "Listo, {nombre}" + "Gluco ya te está esperando" + botón
   "Entrar a Gluco". `guardarOnboarding` (que redirige a /chat) se invoca desde este
   botón, no antes.
9. **R9 — CERO cambios en Server Actions, gate de middleware o persistencia** — Done —
   `src/app/onboarding/actions.ts`, `middleware.ts` y `src/lib/perfil/gate.ts` sin tocar.
   `slotAInsulina`, `SLOT_VACIO`, y el payload de `guardarOnboarding` idénticos. Único
   cambio de secuencia: la pantalla de cierre se interpone ANTES de la misma llamada
   (ver Notas).
10. **R10 — Responsive mobile-first** — Done — `page.tsx` — `max-w-md`, columnas
    fluidas (`flex-1`, `grid-cols-2`), `px-4`, touch targets ≥44px (`size-lg` = `min-h-12`;
    cards `min-h-14`).

## Edge Cases

- **Navegar hacia atrás refleja el progreso correcto** — Done — el `progressbar` se
  deriva de `paso`; `retroceder()` baja `paso` y los segmentos se recalculan. Cierre
  (paso 6) también tiene "← Volver".
- **Campos salteados se ven "salteados", no como error** — Done — no hay estilos de
  error en ningún input; un campo vacío revisitado muestra placeholder neutro + el
  botón "Prefiero seguir" siempre presente. El único "gate" (Continuar deshabilitado en
  nombre/año) es un estado calmo, no rojo.

## Definition of Done

- [x] Fondo y card consistentes con /login
- [x] Indicador de progreso de 6 pasos, visualmente suave
- [x] Transiciones entre pasos con animación
- [x] "Por qué preguntamos esto" visible y con jerarquía clara en cada paso
- [x] "Prefiero seguir" con la misma prioridad visual que "Continuar" (salvo nombre)
- [x] Tipo de diabetes con botones-card, no select
- [x] Insulinas con dos slots diferenciados y Select tokenizado
- [x] Pantalla de cierre cálida antes de ir al chat
- [x] CERO cambios en Server Actions, gate de middleware o persistencia
- [x] Tests siguen verdes (161/161) y `next build` limpio
- [x] Se ve bien en mobile — validado por walkthrough escrito paso a paso +
  artifact de contraste (la extensión de Chrome no conectó; el usuario aceptó
  esa alternativa en lugar de screenshots del navegador)
- [x] Accesibilidad WCAG 2.1 AA — `design:accessibility-review` re-auditado tras
  los fixes: contraste (botón 4.99–6.58:1 con celeste de marca + texto oscuro,
  bordes 3.18:1, anillo 3.58:1, progreso 4.38–5.35:1, dropdown 14.9:1), zonas
  táctiles ≥44px y paridad "Continuar"/"Prefiero seguir" pasan. Foco al cambiar
  de paso, `aria-hidden`/`aria-describedby` y pista de rango agregados.

## Notes

- **Decisión de interpretación en R5:** "misma prioridad visual" se implementó como dos
  botones `outline` idénticos (contraste 16:1 texto sobre blanco), no como
  primary+outline (que sería una jerarquía). Esto también facilita el
  design:accessibility-review ("igual de accesibles, no solo igual de vistosos"). El
  gradiente de marca (R1) queda en: botón "Continuar" del paso nombre, botón "Entrar a
  Gluco" del cierre, y los segmentos de progreso.
- **Decisión en R8 vs R9:** para no tocar `guardarOnboarding` (que hace `redirect('/chat')`
  server-side, lo que impide mostrar una pantalla cliente después), la pantalla de cierre
  se inserta ANTES de la llamada: `avanzar()` en el último paso ahora va a `paso === 6`
  (cierre) en vez de llamar `finalizar()` directo; el botón del cierre llama `finalizar()`
  → misma `guardarOnboarding` intacta → mismo redirect. Persistencia y efecto idénticos.
- **Infra añadida (aditiva, tokenizada):** keyframes `fade-slide-in`/`float` en
  `tailwind.config.ts` y guard `@media (prefers-reduced-motion: reduce)` en
  `src/app/globals.css`. No afecta otras pantallas salvo por el respeto global a reduced-motion.
- **Archivo temporal:** `src/app/preview-onb/page.tsx` es una ruta de preview SOLO para
  sacar screenshots (re-exporta el onboarding sin el gate de auth). Se borra antes de
  commitear; no debe entrar al diff final.

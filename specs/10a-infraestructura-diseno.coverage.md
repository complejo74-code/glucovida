# Build Coverage: PASO 10A — Infraestructura de diseño

## Requirements

1. **R1 — Crear docs/BRANDING.md con el sistema de diseño completo** — Done — `docs/BRANDING.md` — Contiene los 9 apartados: Esencia (¿acompañado o monitoreado?), Modo (light puro), Paleta (11 colores en tabla), Gradientes (celeste→blanco), Tipografía (Nunito 400/600/700/800/900, lh 1.1/1.75), Radios (28/999/50%), Sombras celestes (card + botón), Espaciado (aire) y Tono de voz (con las 4 reescrituras textuales de la spec).
2. **R2 — Extender tailwind.config con TODOS los tokens** — Done — `tailwind.config.ts` — 11 colores (primary/-strong/-soft/-air, white, text, muted, border, success, warning, danger), 3 radios (card 28px, pill 999px, circle 50%), 2 sombras celestes, 2 gradientes y fontFamily. Verificado en el CSS compilado: `bg-gradient-primary` → `linear-gradient(#22a7e6,#1d90c7)`, `shadow-btn-hover` → `0 15px 35px #22a7e640` (α .25), `shadow-card-hover` → `0 25px 50px #22a7e614` (α .08), `999px`, `28px`, `#22a7e6`.
3. **R3 — Cargar Nunito con next/font** — Done — `src/app/layout.tsx` — `Nunito` de `next/font/google` con `variable: "--font-nunito"` y weights 400/600/700/800/900. `body` usa `var(--font-nunito)` en `globals.css` → se ve en toda la app (incluidas las pantallas de estilos inline, que heredan del body). Verificado: `Nunito` self-hosted en el CSS de prod, sin Geist residual.
4. **R4 — Instalar y configurar shadcn/ui con NUESTROS tokens** — Done — `components.json`, `src/lib/utils.ts`, `src/components/ui/{button,input,card,select,badge,skeleton}.tsx` — Deps de shadcn instaladas (cva, clsx, tailwind-merge, radix-slot, radix-select, lucide). Los 6 componentes base usan tokens de marca (no defaults). `Button` primary = `bg-gradient-primary` + `rounded-pill`, verificado en el CSS compilado.
5. **R5 — NO rediseñar ninguna pantalla** — Done — Ningún archivo de `src/app/**/page.tsx` ni de pantallas fue tocado. Solo se cambió infraestructura compartida (`layout.tsx` fuente, `globals.css` tokens). Las 4 pantallas compilan y prerenderizan OK en el build.

## Edge Cases

- **shadcn pisa estilos existentes → nada roto** — Done — Los componentes `ui/*` son archivos nuevos, no importados por ninguna pantalla; las pantallas usan estilos inline, así que no hay override posible. `next build` genera las 10 rutas sin error.
- **Tailwind ya tiene colores con esos nombres → no duplicar, extender limpio** — Done — El config base no tenía tokens de marca; se extendió en `theme.extend` sin colisiones. `globals.css` conserva `--background`/`--foreground` como estaban (solo se ajustó el dark→light).

## Definition of Done

- [x] docs/BRANDING.md existe y contiene todos los ítems de R1
- [x] tailwind.config tiene los 11 colores, los 3 radios y las 2 sombras
- [x] Nunito carga vía next/font y se ve en la app
- [x] shadcn instalado; un `<Button>` primario renderiza con gradiente y pill
- [x] Ninguna pantalla existente se rompió (login, onboarding, chat, perfil) — build compila y prerenderiza las 4
- [x] Todos los tests siguen verdes (tsc 0 errores, eslint 0 errores, vitest 161/161)
- [x] Ninguna pantalla fue rediseñada

## Notes

- **Tailwind v4, no v3:** el repo usa Tailwind v4 (config vía CSS, sin `tailwind.config.js` previo). Para satisfacer R2/DONE ("tailwind.config tiene los tokens") literalmente, se creó `tailwind.config.ts` y se lo cargó con `@config "../../tailwind.config.ts";` en `globals.css` — mecanismo oficial de v4 para configs JS/TS. Los tokens quedan en un solo archivo, como pide "todo vía token".
- **shadcn configurado manualmente (no `npx shadcn init`):** se instalaron las deps y se agregaron los componentes con nuestros tokens, en vez de correr el init interactivo. Motivo: el init habría reescrito el `globals.css` ya branded y usa el sistema de CSS-variables por defecto — justo lo que R4 pide evitar ("NUESTROS tokens, no los defaults"). `components.json` queda válido para futuros `shadcn add`.
- **Dark mode removido de globals.css:** el `@media (prefers-color-scheme: dark)` que traía el boilerplate contradecía "LIGHT MODE PURO" (R1/BRANDING §2); se eliminó. Es infraestructura de tokens, no rediseño.
- **Cambios menores no solicitados pero alineados:** `layout.tsx` metadata pasó de "Create Next App" (placeholder) a "GlucoVida"; el body ahora renderiza en Nunito en vez de Arial (esto es R3, no un rediseño). Ninguna estructura, color ni layout de pantalla cambió.
- **Warnings del build (pre-existentes, no introducidos acá):** aviso de múltiples lockfiles (`C:\Users\usuario\package-lock.json`) y aviso de perf por parsear el `.ts` config como ESM. Ninguno rompe el build ni es del scope de este paso.
- **No se tocó ningún archivo de seguridad** (`seguridad.ts`, pre-filtro de hipo, guardrails de no-prescripción). Paso puramente visual, como manda el guardrail.

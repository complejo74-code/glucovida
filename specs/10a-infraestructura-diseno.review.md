# Review: PASO 10A — Infraestructura de diseño

## Verdict: PASS

## Requirements

1. "Crear docs/BRANDING.md con el sistema de diseño completo" — **Met** — `docs/BRANDING.md` existe. Grep confirmó los 9 apartados y sus ítems textuales exactos: la pregunta de esencia ("acompañado, o monitoreado"), "LIGHT MODE PURO", los 11 hex de la paleta, ambos gradientes literales (`linear-gradient(180deg, #22A7E6, #1D90C7)` y el de sección), Nunito con weights "400 / 600 / 700 / 800 / 900", line-heights 1.1/1.75, radios 28px/999px/50%, las 2 sombras celestes literales, y las 4 reescrituras de tono ("Veamos qué pasó", "Tu glucosa está moviéndose", "Algo no salió como esperábamos", "Te extrañamos") + rioplatense ("vos") + "JAMÁS" juzgar.
2. "Extender tailwind.config con TODOS los tokens" — **Met** — `tailwind.config.ts` define los 11 colores, 3 radios, 2 sombras, 2 gradientes y fontFamily. Verificado no en el fuente sino en el **CSS compilado** (`.next/static/.../2y9y5rgmkt4_f.css`): `.bg-gradient-primary{background-image:linear-gradient(#22a7e6,#1d90c7)}`, `.shadow-btn-hover` → `0 15px 35px #22a7e640` (α .25), `.shadow-card-hover` → `0 25px 50px #22a7e614` (α .08), `border-radius:999px`, `border-radius:28px`, `#22a7e6`. Cargado vía `@config` en `globals.css` (mecanismo oficial de Tailwind v4).
3. "Cargar Nunito con next/font" — **Met** — `src/app/layout.tsx` importa `Nunito` de `next/font/google` con `variable`+weights; `globals.css` aplica `var(--font-nunito)` al body. Verificado: `Nunito` self-hosted presente en el CSS de prod, `--font-nunito` en el SSR, y cero referencias a Geist en `src/`. No hay `<link>` suelto.
4. "Instalar y configurar shadcn/ui con NUESTROS tokens; Button primario con gradiente y pill" — **Met** — Deps en `package.json` (cva, clsx, tailwind-merge, radix-slot, radix-select, lucide). 6 componentes en `src/components/ui/`. `button.tsx`: base con `rounded-pill`, variant `primary` con `bg-gradient-primary`, y `defaultVariants.variant = "primary"` → un `<Button>` sin props sale gradiente + pill. Ambas clases confirmadas en el CSS compilado.
5. "NO rediseñar ninguna pantalla" — **Met** — `git status` muestra que ningún `page.tsx`, `PerfilForm.tsx` ni `actions.ts` fue tocado. Solo cambió infraestructura compartida (`layout.tsx`, `globals.css`) + archivos nuevos. Las pantallas usan estilos inline y siguen intactas.

## Edge Cases

- "Si shadcn pisa estilos existentes y rompe una pantalla, debe seguir funcionando" — **Met** — Los componentes `ui/*` son archivos nuevos no importados por ninguna pantalla; las pantallas usan estilos inline (imposible override). `next build` compila y prerenderiza las 10 rutas sin error.
- "Si Tailwind ya tiene colores con esos nombres, no duplicar" — **Met** — El config base no tenía tokens de marca; se extendió en `theme.extend` sin colisiones. `globals.css` conservó `--background`/`--foreground`.

## Definition of Done

- [x] docs/BRANDING.md existe y contiene todos los ítems de R1 — grep de 29 ítems textuales, todos OK
- [x] tailwind.config tiene los 11 colores, los 3 radios y las 2 sombras — verificado en CSS compilado
- [x] Nunito carga vía next/font y se ve en la app — self-hosted en prod, body la usa
- [x] shadcn instalado; un `<Button>` primario renderiza con gradiente y pill — deps + CSS confirman
- [x] Ninguna pantalla existente se rompió — build prerenderiza login/onboarding/chat/perfil OK
- [x] Todos los tests siguen verdes — tsc 0 errores, eslint 0 errores, vitest 161/161
- [x] Ninguna pantalla fue rediseñada — git status: cero cambios en pantallas

## Summary
PASS limpio: los 5 requisitos, los 2 edge cases y los 7 ítems de la definición de done están Met, verificados contra el CSS compilado y el build real, no solo leyendo el fuente.

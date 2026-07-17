# Build Coverage: Paso 10B-4 — Rediseño de la pantalla de perfil

Único archivo tocado: `src/app/perfil/PerfilForm.tsx` (reescrito).
`page.tsx` y `actions.ts` (Server Actions / persistencia / RLS) **sin tocar** (R7).

## Requirements
1. **R1 — Mismo lenguaje visual** — Done — `PerfilForm.tsx` — `bg-gradient-section`
   de fondo, `rounded-card border border-border bg-white shadow-card-hover` para
   las dos cards, Nunito (global vía layout), inputs/botones/select shadcn
   tokenizados. Encabezado 🩵 + título `font-black` idéntico al onboarding.
2. **R2 — Secciones por bloque, separadores suaves** — Done — `Bloque` +
   `Separador` (`border-t border-border`). Bloques: "Sobre vos" (nombre, tipo,
   año, sexo), "Tu cuerpo" (peso, altura), "Tus insulinas" (card aparte). Títulos
   `text-base font-extrabold` con ayuda `muted` — cálidos, no gritones.
3. **R3 — Insulinas: dos slots con dropdowns del onboarding** — Done —
   `SlotInsulina` reusa el patrón del onboarding (sub-card aire + shadcn Select
   con `MARCAS_RAPIDAS` / `MARCAS_BASAL_LENTA` + "No sé" + "Otra"). Agregar /
   desactivar / cambiar resueltos con las **Server Actions existentes**
   (`agregarInsulina` / `eliminarInsulina`): cambiar = eliminar+agregar,
   desactivar = eliminar.
4. **R4 — Guardar con gradiente + pill + feedback** — Done — `<Button size="lg">`
   (variant primary → `bg-gradient-primary` + `rounded-pill`). Toast cálido
   `role="status"` "Listo, guardado 💙" al éxito; también en cambios de insulina.
5. **R5 — Peso/altura sin IMC ni juicio** — Done — dos `Input` numéricos con
   label; ayuda del bloque "Nunca para juzgar tu cuerpo". Cero `calcularImc`, cero
   indicador evaluativo. (El helper `calcularImc` de tipos.ts no se usa en la UI.)
6. **R6 — Volver al chat** — Done — `<Button asChild variant="ghost">` con
   `<Link href="/chat">← Volver al chat</Link>` arriba de todo.
7. **R7 — CERO cambios de lógica** — Done — `actions.ts` y `page.tsx` intactos.
   El try/catch del cliente solo agrega feedback; el payload y las acciones no
   cambian. El reparto en slots es orquestación de cliente sobre acciones existentes.
8. **R8 — Responsive mobile-first** — Done — `max-w-md` centrado, `min-h-dvh`,
   grids/flex que colapsan; todo pensado para mobile primero.

## Edge Cases
- **Guardado falla → error cálido** — Done — catch muestra toast `role="alert"`
  "Algo no salió como esperábamos. ¿Probamos de nuevo?" (cubre fallas observables:
  red / acción que lanza; ver Nota sobre el swallow de errores de DB).
- **Sin insulinas → estado vacío invitador** — Done — cuando `insulinas.length===0`
  se muestra "Todavía no cargaste tus insulinas — elegí abajo…". Los dos slots
  quedan siempre visibles como mecanismo para agregar.

## Definition of Done
- [x] Fondo, card, inputs y botones consistentes con login/onboarding/chat
- [x] Campos agrupados en bloques con separadores suaves
- [x] Insulinas con dropdowns de marcas y opción agregar/desactivar/cambiar
- [x] Feedback visual de guardado exitoso (no silencioso)
- [x] Peso/altura sin IMC visible ni comentario evaluativo
- [x] Navegación de vuelta al chat
- [x] CERO cambios en Server Actions ni persistencia
- [x] Tests verdes (vitest 161/161); `next build` limpio; tsc + eslint sin errores nuevos
- [x] Mobile-first

## Notas / decisiones
- **Modelo de slots vs. lista previa:** el `/perfil` viejo usaba lista libre
  (agregar/quitar N insulinas). El spec (R2/R3) pide los DOS slots del onboarding.
  Se adopta el modelo de dos slots, pero lo que no encaja (una mixta, o una 2ª del
  mismo tipo cargada antes) NO se oculta: cae en "Otras que tenés cargadas" con
  botón de quitar → **no se pierde ni se esconde ningún dato** (R7).
- **Error de DB silencioso (R7):** `actualizarPerfil` captura sus propios errores
  de Supabase y devuelve `void` (no lanza). Para respetar "CERO cambios en Server
  Actions" NO se modificó su firma. Consecuencia: el toast de éxito puede
  mostrarse aunque un error de DB haya sido tragado por la acción; el toast de
  error solo cubre fallas que la acción propaga (red / invocación). Si se quiere
  feedback fiel al 100%, el follow-up mínimo es que las acciones devuelvan `{ ok }`
  — queda fuera de este paso por el guardrail R7.
- **Cambiar = eliminar + agregar:** si `agregar` fallara tras un `eliminar`
  exitoso, habría pérdida del slot (riesgo de fallo parcial, raro; mismo riesgo
  latente que ya tenía el flujo). Se muestra toast de error.
</content>

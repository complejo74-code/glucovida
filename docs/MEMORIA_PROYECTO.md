# MEMORIA_PROYECTO — GlucoVida

> **Memoria viva** del proyecto entre sesiones. Distinto del `CHANGELOG.md`
> (historial inmutable, entrada por paso): este documento es el **estado
> presente** y el **porqué** de las decisiones, y se **reescribe**.
>
> **Cómo usarlo:**
> 1. **Al empezar cada sesión nueva → leer esto primero.** Antes que el código.
> 2. **Al terminar cada sesión de trabajo → actualizarlo.** Que refleje el
>    estado real al cierre, no el de hace tres pasos.
> 3. Se commitea normal (no es historial, es orientación).
>
> _Última actualización: 2026-07-16 — cierre del paso 10B-4 (rediseño COMPLETO)._

---

## ⚠️ Antes que nada: el stack real

El `CLAUDE.md` global describe **React Native + Expo + Gemini**. **Eso no es
este repo.** El proyecto real es:

- **Next.js 16 (App Router) + TypeScript** — es una **app web de chat** ("Gluco"),
  no una app móvil.
- **Supabase** (Auth, Postgres, RLS).
- **Anthropic SDK** (Claude) para el chat; Haiku para clasificación de ruteo.
- **Tests con Vitest** (`npm test`), no Jest.

**Guiarse SIEMPRE por el código real, nunca por el stack del CLAUDE.md global.**

Mapa rápido:

```
src/app/            → páginas + api/chat/route.ts
src/lib/agents/     → orquestador + subagentes (seguridad/nutrición/insulina/emocional)
                      + seguridad.ts (detección glucosa/hipo) + deteccion.ts (variables)
src/lib/patrones/   → patrones temporales (paso 6) y cruzados (paso 8), determinísticos
src/lib/perfil/     → catálogo de insulinas, tipos, contexto de perfil (paso 9/9.5)
src/components/ui/  → shadcn tokenizado con el sistema del branding (paso 10A)
supabase/migrations/→ SQL en orden (las corre el usuario, ver Convenciones)
docs/               → un doc por paso + BRANDING.md (fuente de verdad visual)
```

---

## Estado actual

**Paso 10B-4 cerrado** (2026-07-16). Build de producción limpio, **Vitest
161/161**. **El rediseño visual del paso 10 está COMPLETO**: login ✅, onboarding
✅, chat ✅, perfil ✅. Ya no queda ninguna pantalla con el diseño viejo.

El proyecto viene de una tanda de **rediseño visual** (paso 10) montada sobre una
base funcional ya sólida (pasos 1–9.5: chat seguro, auth, persistencia con RLS,
memoria conversacional, orquestador con subagentes, patrones temporales y
cruzados, captura conversacional de variables, perfil + onboarding).

### El rediseño (paso 10), estado por pantalla

| Sub-paso | Qué | Estado |
|----------|-----|--------|
| **10A** | Infraestructura de diseño: `docs/BRANDING.md`, tokens en `tailwind.config.ts`, Nunito, shadcn tokenizado | ✅ cerrado |
| **10B-1** | Rediseño de `/login` | ✅ cerrado |
| **10B-2** | Rediseño de `/onboarding` (6 pasos) + endurecimiento de accesibilidad a **WCAG 2.1 AA** | ✅ cerrado |
| **10B-3** | Rediseño de `/chat` (burbujas, chip de glucemia, "escribiendo", input tokenizado, aria-live, estado vacío) | ✅ cerrado |
| **10B-4** | Rediseño de `/perfil` (cards 28px, bloques, dos slots de insulina, toast de guardado, sin IMC) | ✅ cerrado |

**El rediseño del paso 10 está COMPLETO.** Las cuatro pantallas del asistente
conversacional (login, onboarding, chat, perfil) ya usan el sistema del 10A.
No queda ninguna pantalla con el diseño viejo.

> Regla que se mantuvo en todo el paso 10: **el rediseño fue puramente visual.**
> No se tocó `actions.ts`, `middleware.ts`, `gate.ts`, seguridad, chat (lógica),
> patrones ni perfil (lógica). Solo presentación.

### Nota del 10B-4 — insulinas en `/perfil` con el modelo de dos slots
El `/perfil` viejo tenía una **lista libre** (agregar N insulinas de cualquier
clase, incluida "mixta" explícita). El 10B-4 lo pasó a los **dos slots** del
onboarding (rápida / basal-lenta), que es lo aprobado. Consecuencia decidida con
el dueño: ya **no se crea** una `mixta` explícita desde `/perfil` (las premezclas
van por "Otra", como en el onboarding). Lo ya guardado como `mixta` (o duplicado)
**no se pierde ni se oculta**: cae en el bloque **"Otras que tenés cargadas"**,
donde se puede ver y quitar. `agregar`/`eliminar` son las Server Actions de
siempre; cambiar de marca es `eliminar` + `agregar` (orquestación de cliente).

---

## Decisiones de diseño clave (el porqué)

Estas no son preferencias sueltas: son la identidad del producto. No revertir sin
una razón fuerte y explícita.

### Celeste con texto oscuro, no azul profundo con texto blanco
El CTA lleva el **celeste de marca** (`#22A7E6 → #1D90C7`) con **texto oscuro
`#0F172A`** encima. Dos razones que se refuerzan:
- **Identidad:** GlucoVida es *acompañamiento*, no una app clínica. El celeste
  claro que degrada a blanco (nunca a fondo oscuro) transmite luz y calma; un
  azul profundo se siente a dashboard médico. La pregunta que decide **todo** en
  el branding: *¿esto hace sentir acompañado o monitoreado?* (`docs/BRANDING.md §1`).
- **Accesibilidad (10B-2):** el texto blanco sobre ese celeste daba 2.71–3.58:1
  → **fallaba AA**. El texto oscuro da 4.99–6.58:1 → **pasa**. Se cambió el token
  `primary.foreground` de blanco a `#0F172A` **conservando el celeste** de marca.
  No se oscureció la marca para ganar contraste; se oscureció el texto.

### El peso nunca se comenta de forma evaluativa
Peso/altura/IMC entran al contexto **solo como dato interno** para el modelo, con
un **guardrail explícito** en `construirContextoPerfil` que prohíbe todo
comentario evaluativo ("nunca deberías bajar de peso", nada de dietas para
adelgazar). Hay un **test que lo fija**. Es coherente con la regla de oro del tono:
**jamás juzgar** — ni la glucosa, ni el cuerpo. Se acompaña, no se sentencia.

### El chip de glucemia es la única excepción al "los colores no juzgan"
BRANDING §3 reserva `success`/`warning`/`danger` para estados de **la app**, nunca
para calificar una glucosa. El **chip del chat (10B-3)** es la **única excepción
consciente**: usa los tres colores como señal de rango (`danger`=baja <70,
`success`=en rango 70–180, `warning`=alta >180). Se decidió con el dueño (opción
"R3 literal") y está documentada en BRANDING §3. Se mantiene fiel al §9 en el
**lenguaje** ("Baja/En rango/Alta", jamás "bueno/malo") y **el color nunca va
solo**: siempre con ícono + texto + `sr-only` (daltonismo). El detector
`detectarGlucosa` se **reusa client-side solo para mostrar** el chip; no cambia
nada de la lógica del servidor (la API sigue devolviendo solo `{ reply }`).

### El protocolo 15/15 es ciego al perfil
En **emergencia** (hipoglucemia detectada) **no se inyecta perfil, ni patrones,
ni variables**. La respuesta del 15/15 es **idéntica para todos**. El perfil
personaliza *tono y contexto*, **nunca los guardrails**. Hay un **doble gate de
emergencia** (en `route.ts` y dentro del orquestador / `construirSystemPrompt`),
de modo que no depende de que el caller se acuerde de filtrar. Tests lo fijan.

### Solo el nombre es obligatorio en el onboarding
Todo el onboarding es **salteable** ("Prefiero seguir" con la **misma prioridad
visual** que "Continuar"), **menos el nombre**. Por qué:
- El onboarding **nunca bloquea el uso de la app** — pedir mucho de entrada
  ahuyenta; la app tiene que servir aunque no completes nada.
- El **nombre** es la única excepción porque es lo que permite hablarle a la
  persona por su nombre, con naturalidad — el gesto mínimo de acompañamiento.
  `guardarOnboarding` setea `onboarding_completo = true` **siempre**, incluso
  salteando todo lo demás.

---

## Convenciones de trabajo

### Loop spec → build → review
Cada feature/paso sigue el ciclo:
1. **Spec** en `specs/<nombre>.md` (qué se construye, requisitos, definición de
   hecho).
2. **Build** contra la spec — exactamente lo que dice, nada de refactors de más.
3. **Review** requisito por requisito + coverage en `specs/<nombre>.coverage.md`;
   se aplica `code-review` (y `accessibility-review` cuando toca UI) sobre el diff.

Trabajo **paso por paso**: el dueño pide explicación de cada punto **antes** de
ejecutar y frena al final del paso para validar el flujo él mismo. Ante
ambigüedad → **preguntar, no asumir**.

### Guardrails de seguridad — NUNCA se tocan sin autorización explícita
Es una app de salud (diabetes). Estos invariantes están y hay que **preservarlos**:
- El system prompt **siempre** arranca con `REGLAS_SEGURIDAD`.
- **Nunca prescribir dosis de insulina** — la captura de insulina es
  estrictamente informativa (`valor_num = null`, cero semántica de dosis).
- En **emergencia** no se inyecta perfil/patrones/variables (15/15 ciego, ver arriba).
- Todo con **cliente de sesión + RLS**, **cero `service_role`** en el flujo del chat.
- Los **failsafes fallan ABIERTO**: un error de infra (Supabase caído, red) nunca
  debe trabar al usuario fuera de su app (ej. el gate de onboarding en
  `middleware.ts` redirige a `/chat` si el SELECT falla).

Tocar cualquiera de estos requiere autorización explícita del dueño. **Nunca
eliminar código sin pedirlo.**

### Quién corre las migraciones SQL → SIEMPRE el usuario, nunca vos
- Las migraciones las aplica **él, a mano**, en el SQL Editor de Supabase.
- El trabajo del asistente es dejar el archivo `supabase/migrations/NNN_*.sql`
  **listo, idempotente y no destructivo**, y **avisar cuándo correrlo**.
- **Nunca tocar su DB** directo (nada de MCP `apply_migration`, `execute_sql` de
  escritura, etc. sin que lo pida explícitamente).

### Commits
Van **directo a `master`** (no branches/PRs) — es la convención del repo, cada
paso es un commit directo. Commitear/pushear **solo cuando lo pide**. Actualizar
`CHANGELOG.md` (y `DB_SCHEMA.md` si cambió la BD) en cada paso.

---

## Pendientes conocidos

- **Zona horaria fija rioplatense.** Los patrones leen las horas en
  `America/Argentina/Buenos_Aires` (vía `Intl`) porque `ocurrido_en` se guarda en
  UTC. Está **hardcodeado**: cualquier usuario fuera de ese huso vería sus
  franjas horarias corridas. Pendiente de decisión cuando haya usuarios de otras
  zonas.
- **Wildcard de Supabase para previews.** Falta configurar el dominio/redirect
  wildcard en Supabase Auth para que los **deploy previews** (URLs efímeras)
  puedan confirmar email / loguear sin romper el link de confirmación. Hoy el
  origen real de la app se deriva a mano (commit `6bbbc86`); el wildcard lo
  resolvería de raíz.
- **Cookies de sesión en los `redirect` del middleware (baja).** Los `redirect`
  de `middleware.ts` no copian las cookies de sesión refrescadas de
  `supabaseResponse` (patrón pre-existente del repo). Ante rotación de token se
  puede perder la cookie nueva. Detectado en el review del paso 9, sin resolver
  todavía.
- **Error de DB silencioso en `actualizarPerfil` (pendiente técnico del 10B-4).**
  `actualizarPerfil` (y `agregarInsulina` / `eliminarInsulina`) **tragan** sus
  errores de Supabase (`console.error` + `return void`), así que el cliente no
  puede distinguir éxito de fallo de DB: el **toast de éxito** de `/perfil` puede
  mostrarse aunque el `UPDATE` haya fallado (el toast de error solo cubre fallas
  que la acción **propaga**: red / invocación). Se dejó así **a propósito** por el
  guardrail R7 del 10B-4 (cero cambios en Server Actions durante el rediseño). El
  **fix** es un **micro-paso aparte**, después del rediseño: que las acciones
  devuelvan `{ ok: boolean }` y que el toast se decida con eso. Bajo riesgo, pero
  conviene para no dar "guardado" en falso en una app de salud.
- **`menstrua`** se persiste pero a propósito **no se surfacea** en el contexto:
  queda reservada para un futuro subagente hormonal que todavía no existe.

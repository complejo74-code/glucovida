# Changelog — GlucoVida (chat web)

Todos los cambios notables de este proyecto se documentan acá.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [Paso 10B-5] — 2026-07-17 — Feedback fiel de guardado en /perfil

> Micro-paso de **manejo de resultado**, no de rediseño: cierra el pendiente
> técnico anotado en el 10B-4 — `actualizarPerfil` (y `agregarInsulina` /
> `eliminarInsulina`) **tragaban** el error de Supabase y devolvían `void`, así
> que el toast de éxito de `/perfil` podía mostrarse aunque el `UPDATE`/`INSERT`
> hubiera fallado. En una app de salud eso es dar "guardado" en falso. **RLS y
> persistencia sin cambios** (spec 10B-5 R4): mismo payload, misma escritura,
> mismo `.eq`. Solo cambia **cómo se reporta** el resultado.

### Cambiado
- **`src/app/perfil/actions.ts`** — las tres Server Actions ahora devuelven un
  resultado explícito `ResultadoGuardado = { ok: true } | { ok: false; error: string }`
  en vez de `void` (R1). Capturan el `error` real de Supabase (no solo fallas de
  red/invocación), lo loguean en el **servidor** (`console.error`) y devuelven un
  mensaje **cálido** apto para UI — el detalle técnico de Supabase **nunca** viaja
  al cliente (R3). `agregarInsulina` con clase inválida también devuelve `{ ok:false }`
  en vez de un `return` silencioso.
- **`src/app/perfil/PerfilForm.tsx`** — `guardar()` y `aplicarSlot()` deciden el
  toast con el resultado **real** de cada escritura: "Listo, guardado 💙" **solo**
  si `ok=true`; si `ok=false`, toast de error cálido (R2). El `catch` queda como
  fallback para fallas que la acción ni siquiera pudo devolver (red / acción que
  lanza).

### Agregado
- **Guardado parcial diferenciado (edge case).** Cambiar una insulina = eliminar
  la anterior + agregar la nueva. Si el borrado sale bien pero el alta falla, el
  usuario ve un mensaje **distinto** del fallo total ("Quitamos la anterior pero
  no pudimos guardar la nueva. Volvé a elegirla, por favor.") — tiene que saber
  que quedó **sin** la insulina que tenía, no un OK genérico que oculte la falla.
  Reintentar corre de nuevo **sin recargar** la página.
- **`__tests__/perfil-actions.test.ts`** (7 casos, R5): mockean el cliente de
  Supabase y verifican que ante un `error` de DB las acciones devuelven
  `{ ok: false }` (no éxito silencioso) y que el mensaje para la UI es **cálido**,
  nunca el crudo de Supabase (RLS, duplicate key, permission denied).
- Spec en `specs/10b5-feedback-guardado.md`.

### Verificación
- Definición de done completa. `tsc --noEmit` ✓, `next build` limpio, **vitest
  168/168** ✓ (161 previos + 7 nuevos). `code-review` (high) sobre el diff **sin
  hallazgos**. Antes/después demostrado ejecutando las actions reales contra un
  Supabase que simula error (RLS / duplicate key / falla parcial): el toast de
  éxito ya **no** aparece ante un fallo de DB.
- **Ningún archivo de seguridad ni de RLS/persistencia tocado**: `middleware.ts`,
  `gate.ts`, seguridad, chat, onboarding y login sin cambios; la lógica de qué se
  guarda en `usuario` / `insulina_usuario` es idéntica.

## [Paso 10B-4] — 2026-07-16 — Rediseño de la pantalla de perfil

> Paso **puramente visual**: rediseña `/perfil` con el sistema del 10A/10B-1/2/3
> (tokens, Nunito, shadcn, cards 28px, accesibilidad AA). **Cierra el rediseño
> del paso 10** — era la última pantalla sin pasar por el sistema visual.
> **Cero cambios de lógica** (spec 10B-4 R7): las Server Actions de guardado
> (`actualizarPerfil`, `agregarInsulina`, `eliminarInsulina`), la persistencia
> en `usuario` / `insulina_usuario` y la RLS quedan **intactas**. Solo cambia la
> capa visual sobre lo que ya funciona. **Único archivo de código tocado:**
> `src/app/perfil/PerfilForm.tsx` (`page.tsx` y `actions.ts` sin cambios).

### Cambiado
- **`src/app/perfil/PerfilForm.tsx`** reescrita con Tailwind + shadcn — **eliminados todos los inline styles** (antes el archivo era 100% estilos inline). Fondo `bg-gradient-section`, encabezado cálido con 🩵 y título `font-black` como el onboarding, **dos cards 28px** (`rounded-card` + `shadow-card-hover`). Campos agrupados en bloques con separadores suaves (R2): *Sobre vos* (nombre · tipo de diabetes · año · sexo) y *Tu cuerpo* (peso · altura), más una card aparte para insulinas.
- **Insulinas en dos slots** (rápida / basal-lenta) como el onboarding (R3): sub-tarjetas celestes diferenciadas con el **shadcn `Select` de marcas** (`MARCAS_RAPIDAS` / `MARCAS_BASAL_LENTA` + "No sé" + "Otra"). **Agregar / cambiar / desactivar** se resuelven **sobre las Server Actions existentes** (cambiar = `eliminar` + `agregar`; desactivar = `eliminar`) — orquestación de cliente, sin tocar las acciones. Reemplaza la vieja lista libre.
- **Peso y altura** como campos editables normales (R5): **sin IMC visible, sin comentario, sin indicador evaluativo**. Ayuda del bloque: *"Nunca para juzgar tu cuerpo."* Coherente con el guardrail de `construirContextoPerfil` ya testeado.

### Agregado
- **Feedback de guardado no silencioso (R4):** toast cálido ("Listo, guardado 💙" / error "Algo no salió como esperábamos. ¿Probamos de nuevo?") en una **región viva persistente** (`role="status"` + `aria-live="polite"` siempre en el DOM, para anuncio fiable en lectores de pantalla). El botón "Guardar cambios" sale con **gradiente + pill** (`Button` primary).
- **Navegación de vuelta al chat (R6):** link "← Volver al chat" (`Link` dentro de `Button` ghost) arriba de todo.
- **Estados vacíos (edge cases):** sin insulinas → invitación cálida ("Todavía no cargaste tus insulinas — elegí abajo…"); insulinas que no encajan en los dos slots (una **mixta** vieja, o una 2ª del mismo tipo) → aparecen en **"Otras que tenés cargadas"** con botón de quitar, **sin ocultar ni perder ningún dato** (decisión aprobada por el dueño).
- **Accesibilidad:** `<label htmlFor>` en cada input; `<fieldset>/<legend>` en los grupos toggle de tipo/sexo (`aria-pressed`); `aria-label` en selects, "Otra" y el botón de quitar; targets ≥44px (`min-h-11`, `size="icon"`); contraste AA reusando los tokens ya aprobados (10A/10B-2).
- Spec y coverage en `specs/10b4-perfil.md` y `specs/10b4-perfil.coverage.md`.

### Verificación
- R1–R8 y edge cases cubiertos. `tsc` ✓, `eslint` sin errores nuevos, `next build` limpio, **vitest 161/161** ✓. `code-review` (high) sobre el diff (sin hallazgos de correctness; se limpió una aserción `as string`) y `accessibility-review` sobre `/perfil` (labels, targets táctiles, contraste; fix de la región viva del toast).
- **Ningún archivo de seguridad ni de lógica tocado**: `actions.ts`, `page.tsx`, `middleware.ts`, `gate.ts`, seguridad, chat y patrones sin cambios.
- **Pendiente técnico anotado** (`MEMORIA_PROYECTO.md`): `actualizarPerfil` traga sus errores de DB y devuelve `void`, así que el toast de éxito puede mostrarse ante un error de DB silencioso. Se dejó **por el guardrail R7** (cero cambios en Server Actions); el fix es que las acciones devuelvan `{ ok }` — micro-paso aparte después del rediseño.

## [Paso 10B-3] — 2026-07-15 — Rediseño de la pantalla de chat

> Paso **puramente visual + accesibilidad**: rediseña `/chat` con el sistema del
> 10A/10B-1/10B-2 (tokens, Nunito, shadcn, el fix de contraste del CTA).
> **Cero cambios de lógica** (spec 10B-3 R9): la llamada a `/api/chat`, el manejo
> de errores, el orquestador, los detectores, la memoria y los patrones quedan
> **intactos**. Solo cambia la capa visual sobre lo que ya funciona.

### Cambiado
- **`src/app/chat/page.tsx`** reescrita con Tailwind + tokens — **eliminados todos los inline styles** (antes el archivo era 100% estilos inline). Fondo `bg-gradient-section`, header sutil (🩵 + "Gluco" + estado "En línea", sin métricas: no es un dashboard, R6), disclaimer médico cálido siempre presente. La llamada a `/api/chat` y el `catch` del error de conexión son **los mismos**; `sendMessage` solo suma un parámetro opcional `texto` para los chips de arranque (no toca el servidor).
- **Burbujas (R2):** usuario a la derecha con el token del CTA (`bg-gradient-primary` + `text-primary-foreground` oscuro, el fix AA del 10B-2 — no se reintrodujo el gradiente sin ajustar); Gluco a la izquierda en `bg-primary-air` suave. Radio propio de burbuja `rounded-bubble` (20px) con la "colita" a 6px del lado del emisor.
- **Composer (R5):** textarea con el mismo estilo tokenizado que los `Input` de login/onboarding (`rounded-input`, `border-border-strong`, ring `primary-strong`); botón de enviar como **ícono circular celeste** (`Button size="icon"`, lucide `Send`, 44px). Enter envía, Shift+Enter salto de línea.

### Agregado
- **Chip de glucemia (R3):** cuando la persona reporta un valor, aparece un chip con los colores semánticos (`danger`=baja <70 · `success`=en rango 70–180 · `warning`=alta >180). **No depende solo del color**: siempre lleva ícono (🔻/✅/🔺) + texto factual ("Baja/En rango/Alta") + `sr-only` con el contexto completo (daltonismo, WCAG 1.4.1). Texto oscuro sobre el color al 10% → **AA**; el color vive en borde e ícono. Se recalcula por render con el detector **puro** `detectarGlucosa` (display-only, sin tocar la lógica), así el chip es **consistente en todo el historial** (viejos y nuevos). Documentado como **excepción única y consciente** al §3 del branding.
- **Indicador "Gluco está escribiendo" (R4):** tres puntos con blink escalonado (`animate-typing-dot` + delays), **no un spinner genérico**. Con `sr-only` "Gluco está escribiendo…" dentro de la región `aria-live`.
- **Accesibilidad conversacional (R7):** contenedor de mensajes con `role="log"` + `aria-live="polite"` + `aria-relevant="additions"` → los mensajes nuevos y el "escribiendo" se anuncian sin interrumpir a quien está tipeando.
- **Estado vacío cálido (R8):** mientras solo está el saludo, un texto de bienvenida + **3 chips de arranque** ("Quiero anotar una glucemia", "Tengo una duda", "Contame algo útil para hoy") que envían con un toque (misma lógica que escribir).
- **Responsive mobile-first (R10):** `min-h-dvh` + área de mensajes `flex-1 overflow-y-auto` + composer con `pb` de `env(safe-area-inset-bottom)` → el teclado del celular no tapa el input ni el último mensaje. Autoscroll suave al último mensaje / al indicador.
- **`tailwind.config.ts`:** token de radio `rounded-bubble` (20px) y animación `typing-dot` (keyframe con blink, se anula con `prefers-reduced-motion`). Documentados en `docs/BRANDING.md §6` (burbuja) y `§3` (excepción del chip).
- Spec y coverage en `specs/10b3-chat.md` y `specs/10b3-chat.coverage.md`.

### Verificación
- R1–R10 y edge cases (error de conexión cálido, historial largo con autoscroll, chip consistente en todo el historial) cubiertos. `next build` limpio, **vitest** ✓. `engineering:code-review` sobre el diff y `design:accessibility-review` sobre `/chat` (contraste del chip, aria-live, zona táctil del botón de enviar).
- **Ningún archivo de seguridad ni otro flujo tocado**: `/api/chat/route.ts`, `seguridad.ts`, `deteccion.ts`, `orquestador.ts`, patrones, perfil y `middleware.ts` sin cambios. `detectarGlucosa` se **reusa** (import de solo lectura), no se modifica.

## [Paso 10B-2] — 2026-07-15 — Rediseño del onboarding (6 pasos) + accesibilidad AA

> Paso **puramente visual + accesibilidad**: rediseña `/onboarding` con el
> sistema del 10A/10B-1 y endurece el contraste/foco del sistema de diseño a
> WCAG 2.1 AA. **Cero cambios de lógica**: Server Actions (`actions.ts`), gate
> de middleware y persistencia (`usuario`, `insulina_usuario`) sin tocar. El
> guardado, el salteo y el redirect a `/chat` funcionan exactamente igual.

### Cambiado
- **`src/app/onboarding/page.tsx`** reescrita con Tailwind + shadcn — **eliminados todos los inline styles**. Fondo `bg-gradient-section`, card 28px con sombra celeste, header cálido y 🩵 flotante como `/login`. Progreso de 6 pasos en segmentos suaves (no un "%"). Transición fade+slide entre pasos (`animate-fade-slide-in`, remonta con `key={paso}`). Cada paso mantiene su "por qué preguntamos esto" con jerarquía clara. **"Prefiero seguir" con la misma prioridad visual que "Continuar"** (dos botones outline idénticos). Tipo de diabetes con botones-card (no `<select>`). Insulinas en dos slots diferenciados con shadcn `Select` tokenizado. **Pantalla de cierre cálida** ("Listo, {nombre} · Gluco ya te está esperando") antes del chat: la misma `guardarOnboarding` intacta se llama desde su botón.
- **Accesibilidad (sistema de diseño, afecta también `/login`):**
  - **`primary.foreground`** pasa de `#FFFFFF` a `#0F172A`: el texto de los CTA va oscuro sobre el celeste de marca — 4.99–6.58:1 (antes blanco daba 2.71–3.58:1, fallaba AA). El gradiente **conserva el celeste** `#22A7E6→#1D90C7`.
  - **Bordes de controles** (`input`, `select`, botón `outline`, cards de opción) usan el nuevo token `border.strong` `#7A94A6` (3.18:1) en vez del decorativo `#E6EEF5` (1.17:1). Los bordes decorativos (cards, panel del dropdown, separadores) quedan claros.
  - **Anillo de foco** `ring-primary` → `ring-primary-strong` (`#1D90C7`, 3.58:1); la card de opción gana anillo de foco visible.
  - **Foco al cambiar de paso**: `useEffect` sobre `paso` mueve el foco al encabezado del paso / título del cierre (antes el foco caía al `<body>` y los lectores de pantalla no anunciaban el cambio).
  - Item resaltado del dropdown: `focus:text-primary-strong` → `focus:text-text` (2.98:1 → 14.9:1). 🩵 decorativos con `aria-hidden`; nombre/año con `aria-describedby` al "por qué"; año con pista de rango visible.

### Agregado
- **`tailwind.config.ts`**: keyframes/animaciones `fade-slide-in` y `float`; token de color `border.strong` (#7A94A6); gradiente `gradient-strong` (`#17739F→#12658C`, 4.38–5.35:1) para el relleno de la barra de progreso (donde el celeste claro no llega a 3:1 vs. el track).
- **`src/app/globals.css`**: guard `@media (prefers-reduced-motion: reduce)` que anula animaciones/transiciones.
- Spec y coverage en `specs/10b2-onboarding.md` y `specs/10b2-onboarding.coverage.md`.

### Verificación
- R1–R10 y edge cases cubiertos. `engineering:code-review` (high) sobre el diff: sin hallazgos de correctness. `design:accessibility-review` sobre las 6 pantallas: contraste, zonas táctiles (≥44px) y paridad "Continuar"/"Prefiero seguir" **pasan** AA (re-auditado tras los fixes). `next build` limpio, **vitest 161/161** ✓.
- **Ningún archivo de seguridad ni otro flujo tocado**: `actions.ts`, `middleware.ts`, `gate.ts`, chat, patrones y perfil sin cambios. `/login` solo recibe los cambios de token de accesibilidad (celeste intacto).

## [Paso 10B-1] — 2026-07-14 — Rediseño de la pantalla de login

> Paso **puramente visual**: rediseña `/login` con la infraestructura del 10A
> (tokens, Nunito, shadcn) siguiendo `docs/BRANDING.md`. **Cero cambios de
> lógica de auth** (`actions.ts` sin tocar); el flujo de login/registro y
> confirmación de email funciona exactamente igual, solo cambia la presentación.

### Cambiado
- **`src/app/login/page.tsx`** reescrita con Tailwind + componentes shadcn — **eliminados todos los inline styles** (antes el archivo era 100% estilos inline). Fondo con gradiente celeste→blanco (`bg-gradient-section`), marca "GlucoVida" en Nunito 900, card con radio 28px y sombra celeste. Toggle "Ingresar / Registrarme" en cápsula pill (999px) con el activo en gradiente celeste. Encabezado cálido que cambia según el modo ("Qué bueno verte de nuevo" / "Bienvenido a tu lugar"). Inputs y botón vía shadcn tokenizado; botón primario con gradiente + pill + sombra celeste al hover.
- **Loading state** en el submit (`useFormStatus`): spinner + "Ingresando…" / "Creando tu cuenta…" y botón deshabilitado mientras autentica. Solo refleja el estado `pending` de la Server Action — no toca la lógica.
- **Copy de errores** con el tono del branding, nunca crudo de Supabase: credenciales → "Ese email o esa contraseña no coinciden. ¿Probamos de nuevo?"; registro → "No pudimos crear tu cuenta con ese email. ¿Probás con otro?"; fallback → "Algo no salió como esperábamos. ¿Probamos de nuevo?". Arquitectura intacta: las Server Actions redirigen con códigos fijos y la page los traduce.

### Agregado
- **Token de radio `rounded-input` (14px)** en `tailwind.config.ts` — radio intermedio cómodo para campos de texto (ni sharp ni pill total). Documentado en `docs/BRANDING.md §6`. `src/components/ui/input.tsx` pasa de `rounded-pill` a `rounded-input` (el login es su único consumidor).
- Spec en `specs/10b1-login.md`.

### Verificación
- R1–R8 y edge cases (fallback de error, loading state) cubiertos. `next build` limpio, `tsc` ✓, `eslint` ✓, **vitest 161/161** ✓ — ningún test aflojado.
- **Ninguna otra pantalla ni flujo tocado**: solo `/login` visual. `actions.ts`, seguridad, chat, patrones y perfil sin cambios.

## [Paso 10A] — 2026-07-14 — Infraestructura de diseño (tokens, Nunito, shadcn)

> Paso **puramente visual**: deja lista la base de diseño para el rediseño de pantallas del 10B. **No se rediseñó ninguna pantalla** y **no se tocó ningún archivo de seguridad** (`seguridad.ts`, pre-filtro de hipoglucemia ni guardrails de no-prescripción).

### Agregado
- **`docs/BRANDING.md`** — fuente de verdad visual de GlucoVida. Documenta la esencia ("¿acompañado o monitoreado?"), **LIGHT MODE PURO** (sin dark mode, nunca), la paleta de 11 colores, los gradientes (celeste → blanco siempre), Nunito, radios (card 28px / pill 999px / circle 50%), sombras celestes (nunca negras), espaciado con aire y el tono de voz rioplatense con la tabla de reemplazos (jamás juzgar un valor de glucosa).
- **`tailwind.config.ts`** (Tailwind v4, cargado vía `@config` desde `globals.css`) con **todos** los tokens del branding: 11 colores, 3 radios, 2 sombras celestes, 2 gradientes, familia Nunito y line-heights (título 1.1 / body 1.75). Nada hardcodeado: todo vía token.
- **shadcn/ui con nuestros tokens** (no los defaults): `Button`, `Input`, `Card`, `Select`, `Badge`, `Skeleton` en `src/components/ui/`. El `<Button>` primario sale con **gradiente celeste** (`bg-gradient-primary`) y **radio pill** (`rounded-pill`), touch target ≥ 44px. `components.json` y helper `cn()` en `src/lib/utils.ts`.
- Dependencias: `@radix-ui/react-slot`, `@radix-ui/react-select`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`.

### Cambiado
- **`src/app/layout.tsx`**: Nunito vía `next/font` (self-hosted, weights 400/600/700/800/900, sin `<link>` suelto), `lang="es"`, `<body class="font-sans">`, metadata de GlucoVida (reemplaza el placeholder de create-next-app).
- **`src/app/globals.css`**: `@config` al tailwind.config, **eliminado el bloque `@media (prefers-color-scheme: dark)`** (light mode puro), `--foreground` a `#0F172A`, fuente base Nunito.

### Verificación
- **R1–R5 cerrados** y build de producción limpio (`next build` ✓, 10 páginas generadas). `tsc` ✓, `eslint` ✓, **vitest 161/161** ✓ — ningún test borrado ni aflojado.
- **Ninguna pantalla existente rota**: solo se tocaron superficies compartidas (layout + globals); ningún `page.tsx` fue modificado.
- Edge cases: shadcn se extendió limpio sin pisar estilos; se sumó `primary-foreground` (`#FFFFFF`) como token para el texto sobre celeste, sin duplicar colores existentes.

## [Paso 9.5] — 2026-07-14 — Perfil ampliado (nombre, sexo, peso/altura, insulinas taxativas)

### Agregado
- **Migración `004_perfil_ampliado.sql`** (idempotente, NO destructiva). Amplía `usuario`: `nombre text` (requerido en la UI, **nullable en DB**), `sexo text` `CHECK (NULL OR IN ('masculino','femenino','prefiero_no_decir'))`, `peso_kg numeric` `CHECK (NULL OR 20..400)`, `altura_cm int` `CHECK (NULL OR 50..250)`. El RLS existente de `usuario` (`auth.uid() = id`) ya cubre las columnas nuevas — **sin policy nueva**. Conserva la columna `menstrua`.
- **Catálogo de insulinas real** (`src/lib/perfil/tipos.ts`): `MARCAS_INSULINA` del mercado argentino agrupadas por clase (rápidas: Humalog/NovoRapid/Apidra/Fiasp · basales-lentas: Lantus/Toujeo/Tresiba/Levemir/NPH · mixtas: NovoMix/Humalog Mix), con helpers `MARCAS_RAPIDAS`, `MARCAS_BASAL_LENTA`, `marcasDeClase`, `claseDeMarca`. Reemplaza el texto libre por dropdown, siempre con **"Otra"** (texto libre) y **"No sé"**. `calcularImc(peso, altura)` y tipo `Sexo` + `esSexo`.
- **Peso/IMC como contexto interno con guardrail explícito**: el bloque de `construirContextoPerfil` prohíbe todo comentario evaluativo del peso ("nunca deberías bajar de peso", "contexto interno", sin dietas para adelgazar). Test que lo fija.

### Cambiado
- **Onboarding `/onboarding`** ahora 6 pasos: **nombre (requerido, no salteable)** → tipo → año → **sexo** (reemplaza a "¿menstruás?") → **peso/altura** → **insulinas en dos slots** (rápida y basal/lenta por separado, dropdown de marcas + "Otra"/"No sé"; las mixtas van por "Otra"). Cada campo explica **por qué** en una línea.
- **`menstrua` ya no se pregunta** (ni en onboarding ni en `/perfil`); la columna se conserva para el futuro subagente hormonal y sigue sin surfacearse.
- **`construirContextoPerfil`** inyecta ahora **nombre, edad, sexo, peso, altura e IMC** (además de tipo e insulinas), con el mismo gate: después de seguridad, **nunca en emergencia**. `sexo` solo se surfacea si es `masculino`/`femenino`. Nombre usado con naturalidad, sin abusar.
- **`/perfil`** edita todos los campos nuevos; alta de insulina con clase → marca (dropdown por clase + "Otra"/"No sé").
- `buildPerfilContext` (`/api/chat`) y las Server Actions de onboarding/perfil leen y sanean los campos nuevos (rango de peso/altura, `nombre` recortado a 40, RLS en cada escritura). `types.ts` (Supabase) ampliado a mano con las columnas nuevas.

### Notas del code review
- Verificado: (a) **RLS** — columnas nuevas cubiertas por la policy existente de `usuario`, cero `service_role`, todo con cliente de sesión; (b) **guardrails intactos** — doble gate de emergencia (route.ts + orquestador), sin dosis; (c) **peso nunca evaluativo** — guardrail fijo en el bloque + test.
- Descartado en verificación: (1) `numeric` NO vuelve como string en este stack (el codebase ya hace aritmética directa sobre `valor_num`), así que el peso llega bien al contexto; (2) el gate de emergencia sigue firme tras sumar campos.
- Corrección aplicada: "prefiero no decir" en el onboarding guarda `sexo='prefiero_no_decir'` (antes lo colapsaba a `null`), para que onboarding y `/perfil` registren la misma intención. `descripcionSexo` igual lo mantiene fuera del contexto.
- Tests: `perfil-contexto.test.ts` ampliado (nombre, sexo solo masc/fem, peso+altura+IMC, guardrail de peso). Total **161 tests**.

## [Paso 9] — 2026-07-09 — Perfil y onboarding

### Agregado
- **Migración `003_perfil.sql`** (idempotente, NO destructiva). Amplía `usuario`: `anio_nacimiento int` (edad sin fecha exacta, menos sensible), `menstrua boolean` **nullable** (cubre "prefiero no decir"), `onboarding_completo boolean NOT NULL DEFAULT false`, y agrega `'otro'` al `CHECK` de `tipo_diabetes`. El RLS existente de `usuario` (`auth.uid() = id`) ya cubre las columnas nuevas.
- **Tabla `insulina_usuario`** (un usuario, varias insulinas): `clase` (`rapida`/`basal`/`lenta`/`mixta`), `marca` (nullable), `activa` (para desactivar sin borrar historial). **RLS con las 4 políticas** acotadas por `auth.uid() = usuario_id` (agregar/desactivar/borrar desde el perfil editable). Nada usa `service_role`.
- **Onboarding `/onboarding`** (wizard cliente, mobile-first, cálido): 4 pasos uno por pantalla — tipo de diabetes (botones), año de nacimiento, ¿menstruás? (Sí/No/**Prefiero no decir** → `null`, mismo peso visual), insulinas (clase + marca, varias, o "no uso"). Cada paso explica **por qué** se pregunta. **Todo salteable**: nunca bloquea el uso. Server Action `guardarOnboarding` guarda lo compartido y setea `onboarding_completo=true` **siempre** (incluso salteando todo).
- **Perfil editable `/perfil`** (Server Component + form cliente): editar tipo/año/menstrua y agregar/quitar insulinas, todo bajo RLS. Acceso desde el header del chat.
- **Personalización del prompt**: `buildPerfilContext` (`/api/chat`, RLS) arma un bloque de **CONTEXTO PRIVADO** con tipo de diabetes, edad e insulinas activas; nuevo parámetro `perfil` en `construirSystemPrompt`, inyectado después de seguridad y especialidades. El subagente insulina puede referirse a las insulinas reales de la persona (siempre educativo). **`menstrua` se persiste pero A PROPÓSITO no se surfacea todavía** (queda disponible para el futuro subagente hormonal; no se construyó nada hormonal).
- **Gate de onboarding en `middleware.ts`** (función pura `requiereOnboarding`): si `onboarding_completo=false`, redirige a `/onboarding`. **FAILSAFE:** si el `SELECT` falla (error de red/Supabase → estado `null`), el gate **falla ABIERTO** hacia `/chat` — un problema de infra jamás deja a la persona trabada fuera de su app. Exentas: `/onboarding`, `/login`, `/auth`, `/api`.
- Tests: `__tests__/perfil-contexto.test.ts` (7), `__tests__/perfil-gate.test.ts` (7, incluye el fail-open) y 3 nuevos en `orquestador.test.ts` (perfil tras seguridad, nunca en emergencia, no pisa especialidades). Total **156 tests**.
- Documentación en `docs/perfil-onboarding-paso-9.md` y `DB_SCHEMA.md`.

### Cambiado
- `construirSystemPrompt` acepta `perfil`, con el **mismo gate estructural** que patrones/variables: **nunca en emergencia** (el protocolo 15/15 es ciego al perfil — una sola respuesta para todos). El perfil personaliza **tono y contexto, jamás los guardrails**: sin prescribir dosis, con o sin perfil.
- `/api/chat` lee el perfil (RLS, en paralelo) e inyecta el bloque solo fuera de emergencia; cualquier error devuelve `""` y nunca rompe la respuesta.
- `middleware.ts` protege `/chat`, `/perfil` y `/onboarding` (antes solo `/chat`).
- Header del chat: acceso a `/perfil`.

### Notas del code review
- Verificado: (a) RLS en `usuario` ampliado + `insulina_usuario` (4 políticas, cliente de sesión, cero `service_role`); (b) datos sensibles nunca cruzan de usuario (filtro `user.id` + RLS, `""` ante error, perfil como contexto privado no crudo); (c) guardrails intactos con y sin perfil (doble gate de emergencia, tests que lo fijan).
- Correcciones aplicadas: (1) cierre de onboarding resiliente — si el UPDATE del perfil falla, se reintenta solo `onboarding_completo=true` para no rebotar a la persona en loop; (2) `/api` exento del gate (un `fetch` no debe recibir un redirect a HTML); (3) `finalizar()` con try/finally para no trabar el botón ante un fallo de red.
- Nota abierta (baja): los `redirect` del middleware no copian las cookies de sesión refrescadas de `supabaseResponse` (patrón pre-existente del repo); ante rotación de token se pierde la cookie nueva. Pendiente de decisión.

## [Paso 8] — 2026-07-09 — Patrones cruzados v0

### Agregado
- Módulo `src/lib/patrones/cruces.ts`: detección **determinística** (sin LLM) de relaciones entre **dos variables** y la glucemia. Dos cruces v0: `sueno_vs_amanecer` (noches de `<6 h` vs. `≥6 h` → glucemia de amanecer 5–9 h del mismo día local) y `estres_vs_glucemia` (días de estrés `≥7` vs. `≤4`, el medio 5–6 se excluye → glucemia promedio del día). Guard genérico `evaluarCruce` preparado para sumar más cruces.
- **Rigor reforzado (factor 41):** un cruce solo se reporta con **≥5 observaciones en cada grupo** Y **diferencia de promedios ≥20 mg/dL**; con datos escasos o diferencia chica → `null` (el sistema **calla**). Cada cruce lleva `n` por grupo y `confianza` (proxy por muestra, no p-value).
- **Correlación, no causalidad** (lo central del paso): documentado explícitamente en el código y comunicado **siempre como pregunta tentativa** ("¿Será que…?"), con lenguaje asociativo ("coinciden con", "los días que…") y **jamás causal** ("te sube/te causa/genera"). El bloque incluye el recordatorio de que es una correlación observada, no un diagnóstico ni una relación de causa.
- Nuevos `factor` en la tabla `patron`: `sueno_vs_amanecer`, `estres_vs_glucemia`. **Sin migración**: `factor` es `text` libre y los cruces comparten la forma persistida de los patrones simples (`efecto_estimado` = diferencia de promedios, puede ser negativa; `detalle jsonb` = los dos grupos comparados).
- Tests: `__tests__/patrones-cruzados.test.ts` (20) con datos sintéticos — reporta / insuficiente / diferencia chica / contradictorio por cada cruce, exclusión del estrés medio, selección unificada (máx. un patrón entre simples y cruzados) y guardrails de lenguaje. Total 139 tests.
- Documentación en `docs/patrones-cruzados-paso-8.md` (con la distinción correlación/causalidad desarrollada) y `DB_SCHEMA.md`.

### Cambiado
- `construirContextoPatrones(patrones, cruces=[])` y nuevo `seleccionarMencion`: los patrones simples y cruzados **conviven** y la selección elige **UN solo** patrón conversacional entre todos (el de mayor confianza); el bloque de seguridad de `hipos_recurrentes` sigue apareciendo siempre, aparte. Firma retrocompatible (segundo arg opcional).
- `leerLecturas14d(supabase, userId, ahora, tipo="glucemia")`: reusa la lectura con RLS para sueño y estrés (las filas sin valor numérico se excluyen). `sincronizarPatrones` acepta simples + cruzados y el barrido de borrado incluye los factores cruzados.
- `/api/chat` lee glucemias + sueño + estrés (en paralelo, RLS), calcula los cruces, los persiste junto a los simples e inyecta el contexto — después de la observabilidad y solo fuera de emergencia. Cualquier error va a `try/catch` y nunca rompe la respuesta.
- Helpers `promedio`, `redondear`, `confianzaMuestra`, `enVentana` y el nuevo `fechaLocalKey` exportados desde `calculo.ts` para reuso (los cruces no duplican matemática).

### Notas del code review
- Verificado: (a) matemática determinística y testeada; (b) cero lenguaje causal en cualquier cruce (blindado por test regex); (c) RLS y guardrails intactos (cliente de sesión + filtro `usuario_id`, sin `service_role`, máximo un patrón, nunca en emergencia). Sin bugs de correctitud.
- Corrección aplicada: evitar el doble cálculo de `horaLocal` por lectura al filtrar el amanecer.

## [Paso 7] — 2026-07-08 — Captura conversacional de variables

### Agregado
- Módulo `src/lib/agents/deteccion.ts`: cinco detectores **puros y determinísticos** (`detectarSueno`, `detectarEstres`, `detectarComida`, `detectarEjercicio`, `detectarInsulina`) + agregador `detectarEventos`. Captura **pasiva** de variables que la persona menciona al pasar, con la misma filosofía que `detectarGlucosa`: contexto obligatorio, exclusiones duras y, ante la duda, no guardar. Un mensaje puede generar varios eventos ("dormí 5 horas y amanecí en 190" → `sueno` + `glucemia`).
- **Insulina = registro estrictamente informativo.** Exige verbo de aplicación en pasado ("me puse", "me apliqué"…) + contexto de insulina; las preguntas de dosis y la intención futura NO disparan registro. `valor_num` viene `null` a propósito (cero semántica de dosis): nunca se interpreta, persiste ni sugiere una dosis.
- Estimación de carbos (v0): `metadatos.estimacion_carbs` solo cuando el usuario los declara explícitamente ("comí 45g de carbos"); nada de adivinar por IA.
- Nuevos `tipo` de `evento`: `sueno`, `estres`, `comida`, `ejercicio`, `insulina`. **Sin migración**: `evento.tipo` es `text` libre.
- `buildVariablesContext` (`/api/chat`): memoria de **sueño y estrés** recientes (comida y ejercicio afuera, demasiado ruido) con RLS, inyectada como contexto privado igual que la memoria de glucemia.
- Tests: `__tests__/deteccion.test.ts` (55) con casos positivos/negativos por tipo, múltiples eventos y regresiones del code review. Total 119 tests.
- Documentación en `docs/deteccion-conversacional-paso-7.md` y `DB_SCHEMA.md`.

### Cambiado
- `construirSystemPrompt` acepta `variables` (sueño/estrés), inyectado después de la memoria de glucemia y siempre con `REGLAS_SEGURIDAD` primero. **Gate estructural de emergencia:** nunca en `emergencia === true`, igual que patrones (`src/lib/agents/orquestador.ts`).
- `registrarObservabilidad` (`/api/chat`) persiste los eventos capturados junto a la fila de glucemia/ruteo en un **único insert por lote**, todo con el cliente de sesión (RLS valida cada fila).

### Notas del code review
- Insulina: confirmado que la captura **solo** produce registro (nunca recomendación), RLS intacto (cliente de sesión, `WITH CHECK auth.uid() = usuario_id`, cero `service_role`) y guardrails de emergencia en todos los caminos.
- Correcciones aplicadas: `rápida`/`lenta`/`basal` sueltos ya no matchean como insulina (requieren artículo/preposición: "la lenta", "de rápida") — evitaba registros falsos como "me apliqué la crema rápidamente"; el intensificador "re" ya no se cuela desde el final de otra palabra ("siempre tranquilo"); "sin estrés" se registra como calma (2), no como estrés moderado.
- Nota técnica: `\b` es ASCII y no reconoce vocales acentuadas; los detectores usan lookbehind/lookahead con clase acentuada en su lugar.

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

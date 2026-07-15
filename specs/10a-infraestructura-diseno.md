# SPEC — PASO 10A: INFRAESTRUCTURA DE DISEÑO

## OBJETIVO
Dejar lista la base visual de GlucoVida (tokens, tipografía, componentes)
para que en el paso 10B se rediseñen las pantallas. NO se rediseña ninguna
pantalla en este paso.

## ALCANCE (importante)
Construimos SOLO el asistente conversacional: chat, onboarding, perfil, login.
NO la red social (feed, comunidad, pages) — eso es otro producto. Aplicamos el
sistema visual del branding, no su arquitectura de pantallas.

## REQUISITOS

### R1. Crear docs/BRANDING.md con el sistema de diseño completo:
- **Esencia:** la pregunta que guía toda decisión es "¿esto hace que alguien se
  sienta acompañado, o monitoreado?" Si es monitoreado, se descarta.
  GlucoVida NO es una app médica, ni un dashboard, ni un tracker.
- **Modo:** LIGHT MODE PURO. Sin dark mode. Sin fondos oscuros. Nunca.
- **Paleta:**
  - primary #22A7E6 · primary-strong #1D90C7 · primary-soft #A9DDF7
  - primary-air #D6EEFB · white #FFFFFF · text #0F172A · muted #5B6B7C
  - border #E6EEF5 · success #10B981 · warning #F59E0B · danger #EF4444
- **Gradientes:** el celeste SIEMPRE degrada hacia blanco.
  - Botón: `linear-gradient(180deg, #22A7E6, #1D90C7)`
  - Sección: `linear-gradient(180deg, #D6EEFB 0%, #EBF6FD 55%, #FFFFFF 100%)`
- **Tipografía:** Nunito, weights 400/600/700/800/900.
  - Line-height 1.1 en títulos, 1.75 en body.
- **Radios:** cards 28px · botones y pills 999px · icon circles 50%. Nada sharp.
- **Sombras:** siempre en tono celeste, nunca negras.
  - Card hover: `0 25px 50px rgba(34,167,230,0.08)`
  - Botón hover: `0 15px 35px rgba(34,167,230,0.25)`
- **Espaciado:** mucho aire, mucho blanco, nada saturado.
- **Tono de voz:** amigo con experiencia, no médico ni algoritmo. Rioplatense
  (vos, sos, tenés). JAMÁS juzgar un valor de glucosa.
  - "Nivel incorrecto" → "Veamos qué pasó"
  - "Valor anormal" → "Tu glucosa está moviéndose"
  - "Error" → "Algo no salió como esperábamos. ¿Probamos de nuevo?"
  - Sesión expirada → "Te extrañamos. Iniciá sesión para volver"

### R2. Extender tailwind.config con TODOS los tokens de R1
Paleta, radios, sombras celestes, fuente. Nada hardcodeado: todo vía token.

### R3. Cargar Nunito con next/font
Optimizado, no `<link>` suelto.

### R4. Instalar y configurar shadcn/ui con NUESTROS tokens, no los defaults.
Componentes base: Button, Input, Card, Select, Badge, Skeleton.
El Button primario debe salir con gradiente celeste y radio 999px.

### R5. NO rediseñar ninguna pantalla. Solo infraestructura.

## EDGE CASES
- Si shadcn pisa estilos existentes y rompe una pantalla actual, la pantalla
  debe seguir funcionando (aunque se vea igual que antes). Nada roto.
- Si Tailwind ya tiene colores con esos nombres, no duplicar: extender limpio.

## DEFINICIÓN DE DONE (verificable)
- [ ] docs/BRANDING.md existe y contiene todos los ítems de R1
- [ ] tailwind.config tiene los 11 colores, los 3 radios y las 2 sombras
- [ ] Nunito carga vía next/font y se ve en la app
- [ ] shadcn instalado; un `<Button>` primario renderiza con gradiente y pill
- [ ] Ninguna pantalla existente se rompió (login, onboarding, chat, perfil)
- [ ] Todos los tests siguen verdes (tsc, eslint, vitest)
- [ ] Ninguna pantalla fue rediseñada

## GUARDRAILS DEL LOOP (app de salud, innegociables)
- NUNCA borres, aflojes ni desactives un test para "pasar limpio". Si un test
  bloquea, se arregla el código, no el test.
- NO toques los archivos de seguridad (seguridad.ts, pre-filtro de hipoglucemia,
  guardrails de no-prescripción). Este paso es puramente visual.
- FRENÁ y reportá antes de dar el paso por cerrado. No autoaprobarse.
- Si el loop lleva más de 5 iteraciones sin converger, FRENÁ y explicá qué
  está trabado.

# SPEC — PASO 10B-3: REDISEÑO DE LA PANTALLA DE CHAT

## OBJETIVO
Rediseñar `/chat` con el mismo lenguaje visual de login y onboarding ya
aprobados. Es la pantalla que más se usa — tiene que sentirse como hablar
con un amigo, nunca como un dashboard de monitoreo.

## REQUISITOS

**R1.** Mismo lenguaje visual: fondo blanco/celeste-aire, Nunito, tokens ya
definidos (incluyendo el fix de contraste del 10B-2 — reusar los mismos
tokens de botón, no reintroducir el gradiente sin ajustar).

**R2.** Burbujas de mensaje: usuario a la derecha (celeste), Gluco a la izquierda
(blanco/celeste-air suave), bordes redondeados consistentes con el
sistema (no 28px como cards, un radio propio de burbuja — definilo y
documentalo en BRANDING.md).

**R3.** El chip de estado de glucemia (cuando se detecta un valor) usa los
colores semánticos ya definidos (success/warning/danger) con contraste
AA verificado — no solo color, también un ícono o texto que no dependa
del color solo (daltonismo).

**R4.** Indicador de "Gluco está escribiendo" con animación sutil (los tres
puntos con blink ya definidos en el prototipo original), no un spinner
genérico.

**R5.** Input de mensaje: mismo estilo de shadcn tokenizado que login/onboarding,
con el botón de enviar como ícono circular celeste (no cuadrado).

**R6.** Header del chat: nombre "Gluco" + estado sutil de conexión, sin
saturar — recordá que esto NO es un dashboard, nada de métricas
visibles permanentemente.

**R7.** Accesibilidad conversacional: los mensajes nuevos deben anunciarse a
lectores de pantalla (`aria-live="polite"` en el contenedor de mensajes,
sin interrumpir si el usuario está escribiendo).

**R8.** Estado vacío (primera vez que alguien entra): usar el tono del branding
("No encontramos nada por acá, pero seguí explorando" es el estilo —
adaptalo a "escribile lo que quieras" cálido, con 2-3 chips de arranque
como el prototipo original tenía).

**R9.** Mantener TODA la lógica existente intacta: la llamada a `/api/chat`, el
manejo de errores, la detección de eventos, el orquestador, la memoria.
CERO cambios de lógica — esto es solo la capa visual sobre lo que ya
funciona.

**R10.** Responsive mobile-first: el teclado del celular no debe tapar el input
ni el último mensaje (viewport dinámico).

## EDGE CASES
- Mensaje de error de conexión: usar el tono cálido ("No pudimos cargar
  esto. ¿Probamos de nuevo?"), nunca un error crudo.
- Historial largo: scroll debe ir al último mensaje automáticamente sin
  saltos bruscos.
- Chip de glucemia en mensajes viejos vs. nuevos: consistente en todo el
  historial, no solo en los mensajes recién enviados.

## DEFINICIÓN DE DONE (verificable)
- [ ] Burbujas con el lenguaje visual consistente con login/onboarding
- [ ] Chip de glucemia con contraste AA + no depende solo del color
- [ ] Indicador de "escribiendo" con animación sutil, no spinner genérico
- [ ] Input y botón de enviar tokenizados, ícono circular
- [ ] `aria-live` en el contenedor de mensajes (verificado con el accessibility review)
- [ ] Estado vacío cálido con chips de arranque
- [ ] CERO cambios en `/api/chat`, orquestador, detección o memoria
- [ ] El teclado mobile no tapa el input (viewport dinámico probado)
- [ ] Tests verdes; `next build` limpio

## GUARDRAILS DEL LOOP
- Cero cambios en lógica: la llamada a la API, el orquestador, los
  detectores, la memoria, los patrones. Si algo tienta a "mejorar" ahí,
  reportalo aparte, no lo toques.
- No toques archivos de seguridad.
- No aflojes tests.
- Corré `next build` antes de terminar.
- Al final del loop, corré `engineering:code-review` sobre el diff.
- Al final del loop, corré `design:accessibility-review` sobre `/chat`, con foco
  en: contraste de los chips de glucemia (y que no dependan solo del color),
  aria-live del contenedor de mensajes, tamaño táctil del botón de enviar
  en mobile.
- FRENÁ antes de commitear. Mostrar descripción detallada + screenshots si
  la extensión de Chrome está conectada; si no, walkthrough escrito alcanza.

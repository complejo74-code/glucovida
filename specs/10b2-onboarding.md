# SPEC — PASO 10B-2: REDISEÑO DEL ONBOARDING (6 PASOS)

## Objetivo

Rediseñar `/onboarding` usando la infraestructura del 10A y el mismo lenguaje
visual del login ya aprobado (10B-1). Es donde alguien cuenta cosas íntimas
(tipo de diabetes, peso, insulinas) muchas veces por primera vez frente a una
pantalla. Tiene que sentirse como una charla, no como un trámite.

## Requisitos

- **R1.** Mismo lenguaje visual que `/login`: fondo celeste→blanco, card blanca
  28px, Nunito, botones pill con gradiente. Consistencia entre pantallas.
- **R2.** Barra o indicador de progreso de los 6 pasos (nombre → tipo diabetes →
  año → sexo → peso/altura → insulinas). Debe sentirse como "vamos avanzando
  juntos", no como una cuenta regresiva burocrática. Sugerencia: puntos o
  segmentos suaves en celeste, no un porcentaje frío tipo "3/6".
- **R3.** Transición entre pasos: animación suave (fade + slight slide), nunca un
  salto brusco de pantalla. Consistente con las animaciones ya definidas en
  BRANDING.md (fade in, float).
- **R4.** Cada paso mantiene su línea de "por qué preguntamos esto" ya existente
  en la lógica — pero ahora con jerarquía visual clara (más sutil que el título,
  en muted, cerca del campo).
- **R5.** El botón "Prefiero seguir" (saltear) debe existir en TODOS los pasos
  salvo el del nombre, con la MISMA prioridad visual que "Continuar" — ninguno
  debe verse como la opción "correcta" y el otro como la "incorrecta". Ambos son
  válidos.
- **R6.** Paso de tipo de diabetes: botones grandes tipo card (no un `<select>`),
  con buen espaciado táctil para mobile — es una decisión importante, merece
  presencia visual.
- **R7.** Paso de insulinas: los dos slots (rápida / basal-lenta) claramente
  diferenciados visualmente, con sus dropdowns tokenizados (shadcn Select).
- **R8.** Última pantalla (fin del onboarding): un cierre cálido antes de entrar
  al chat — algo como "Listo, [nombre]. Gluco ya te está esperando" — no un
  simple redirect silencioso.
- **R9.** Mantener TODA la lógica existente intacta: Server Action de guardado,
  el gate del middleware, el comportamiento de saltear, la persistencia en
  `usuario` e `insulina_usuario`. CERO cambios de lógica.
- **R10.** Responsive mobile-first (es el uso real).

## Edge cases

- Si el usuario navega hacia atrás en el wizard, el progreso visual debe reflejar
  el paso correcto.
- Los campos salteados deben verse claramente como "salteados", no como si
  hubiera un error o algo faltante.

## Definición de done (verificable)

- [ ] Fondo y card consistentes con `/login`
- [ ] Indicador de progreso de 6 pasos, visualmente suave (no burocrático)
- [ ] Transiciones entre pasos con animación (no salto brusco)
- [ ] "Por qué preguntamos esto" visible y con jerarquía visual clara en cada paso
- [ ] "Prefiero seguir" con la misma prioridad visual que "Continuar" en todos los
  pasos salvo nombre
- [ ] Tipo de diabetes con botones-card, no select
- [ ] Insulinas con dos slots diferenciados y Select tokenizado
- [ ] Pantalla de cierre cálida antes de ir al chat
- [ ] CERO cambios en Server Actions, gate de middleware o persistencia
- [ ] Tests siguen verdes; `next build` limpio
- [ ] Se ve bien en mobile

## Guardrails del loop

- Cero cambios en lógica: Server Actions, middleware, persistencia. Si el
  rediseño tienta a "mejorar" algo de eso, reportarlo aparte, no tocarlo.
- No tocar archivos de seguridad ni otros flujos (chat, patrones, perfil, login
  ya aprobado).
- No aflojar tests.
- Correr `next build` antes de terminar.
- FRENAR antes de commitear. El dueño quiere ver cómo quedó (screenshots o
  descripción detallada paso por paso) antes de aprobar — como con el login.

## Cierre del loop (antes de mostrar resultado)

- Correr `engineering:code-review` sobre el diff.
- Correr `design:accessibility-review` sobre las 6 pantallas del onboarding, con
  foco en contraste de color, tamaño de zona táctil en mobile, y que "Prefiero
  seguir" y "Continuar" sean igual de accesibles (no solo igual de vistosos).
- Mostrar ambos resultados junto con la descripción del rediseño.

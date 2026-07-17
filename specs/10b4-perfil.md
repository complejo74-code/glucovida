# SPEC — PASO 10B-4: REDISEÑO DE LA PANTALLA DE PERFIL

## OBJETIVO
Rediseñar `/perfil` con el mismo lenguaje visual de login, onboarding y chat ya
aprobados (10B-1/2/3). Es la pantalla donde alguien edita sus datos personales de
salud — debe sentirse igual de cálida que el onboarding, pero sin el wizard (es
edición directa, no primera vez).

## REQUISITOS

- **R1. Mismo lenguaje visual:** fondo blanco/celeste-aire (`bg-gradient-section`),
  card blanca 28px (`rounded-card`), Nunito, botones e inputs tokenizados (shadcn).
  Consistencia total con las tres pantallas ya aprobadas.

- **R2. Secciones claras pero no frías:** agrupar los campos por bloque
  (datos personales: nombre, tipo de diabetes, año, sexo · cuerpo: peso, altura ·
  insulinas: rápida y basal/lenta). Separadores suaves, no títulos gritones tipo
  formulario médico.

- **R3. Insulinas:** los dos slots (rápida / basal-lenta) con los mismos dropdowns
  de marcas del onboarding (shadcn Select), con la opción de agregar, desactivar o
  cambiar. Visualmente diferenciados como en el onboarding.

- **R4. Botón de guardar** con gradiente celeste + pill + feedback de guardado
  exitoso (no solo un redirect silencioso — un toast cálido o un cambio visual que
  confirme "listo, guardado").

- **R5. El peso y la altura** se muestran como campos editables normales, SIN
  ningún cálculo de IMC visible, SIN ningún comentario, SIN ningún indicador de
  "saludable/no saludable". Son datos internos, no métricas para juzgar.
  Consistente con el guardrail ya testeado.

- **R6. Navegación** de vuelta al chat clara (botón o link "Volver al chat").

- **R7. Mantener TODA la lógica existente intacta:** Server Actions de guardado,
  persistencia en `usuario` e `insulina_usuario`, RLS. CERO cambios de lógica.

- **R8. Responsive mobile-first.**

## EDGE CASES
- Si el guardado falla, mostrar error con tono cálido (nunca crudo).
- Si no hay insulinas cargadas, mostrar un estado vacío invitador
  ("Todavía no cargaste tus insulinas — podés agregarlas acá").

## DEFINICIÓN DE DONE (verificable)
- [ ] Fondo, card, inputs y botones consistentes con login/onboarding/chat
- [ ] Campos agrupados en bloques con separadores suaves
- [ ] Insulinas con dropdowns de marcas y opción agregar/desactivar
- [ ] Feedback visual de guardado exitoso (no silencioso)
- [ ] Peso/altura sin IMC visible ni comentario evaluativo
- [ ] Navegación de vuelta al chat
- [ ] CERO cambios en Server Actions ni persistencia
- [ ] Tests verdes; `next build` limpio
- [ ] Se ve bien en mobile

## GUARDRAILS DEL LOOP
- Cero cambios en lógica (Server Actions, RLS, persistencia).
- No tocar archivos de seguridad ni otros flujos.
- No aflojar tests.
- Correr `next build` antes de terminar.
- Correr `engineering:code-review` sobre el diff.
- Correr `design:accessibility-review` sobre `/perfil` (contraste, labels de los
  campos, tamaño táctil de los botones agregar/desactivar insulina).
- FRENAR antes de commitear. Mostrar descripción detallada o screenshots.
</content>
</invoke>

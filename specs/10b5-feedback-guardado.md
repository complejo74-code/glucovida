# SPEC — MICRO-PASO: FEEDBACK FIEL DE GUARDADO EN /perfil

Paso 10B-5. Loop: spec → build → review → fix → repetir hasta pasar limpio.

## OBJETIVO

Cerrar el hueco detectado en el 10B-4: `actualizarPerfil` traga errores de
Supabase y devuelve `void`, así que el toast puede decir "guardado" cuando en
realidad la escritura en la DB falló. El usuario tiene que saber la verdad.

## REQUISITOS

- **R1.** Las Server Action(s) de guardado en `actions.ts` (perfil e insulinas)
  deben devolver un resultado explícito, ej: `{ ok: boolean, error?: string }`
  en vez de `void` silencioso. Capturar el error real de Supabase (no solo
  errores de red/invocación) y propagarlo.

- **R2.** El frontend (`PerfilForm.tsx`) usa ese resultado real para decidir qué
  toast mostrar: "Listo, guardado 💙" SOLO si `ok=true`; si `ok=false`, el toast
  cálido de error ("¿Probamos de nuevo?"), no el de éxito.

- **R3.** Mensajes de error SIEMPRE con el tono del branding — nunca mostrar el
  error crudo de Supabase al usuario. Loguear el detalle técnico donde
  corresponda (consola/servidor), no en la UI.

- **R4.** RLS y la lógica de persistencia (qué se guarda, cómo) NO cambian. Este
  paso es solo sobre el manejo/propagación del resultado, no sobre qué se guarda.

- **R5.** Actualizar los tests existentes que asumían `void`, y agregar un test
  que verifique: si Supabase devuelve error, el resultado es `{ ok: false }` y el
  toast de error se dispara (no el de éxito).

## EDGE CASES

- **Guardado parcial** (perfil OK, insulina falla, o viceversa): el usuario tiene
  que enterarse de cuál de las dos partes falló, no un OK genérico que oculte una
  falla parcial. En particular, cambiar una insulina = eliminar la anterior +
  agregar la nueva; si el borrado sale bien pero el alta falla, hay que decírselo
  distinto de un fallo total.
- **Reintentar** después de un error debe funcionar sin recargar la página.

## DEFINICIÓN DE DONE (verificable)

- [ ] Las Server Actions de guardado devuelven `{ ok, error? }` en vez de `void`
- [ ] El toast de éxito solo aparece si `ok=true`
- [ ] El toast de error aparece si `ok=false`, con tono cálido, nunca error crudo
- [ ] Guardado parcial (perfil ok, insulina falla) se comunica distinto de un
      fallo total
- [ ] Tests nuevos cubren el caso de error real de Supabase
- [ ] RLS y persistencia sin cambios
- [ ] Tests verdes; `next build` limpio

## GUARDRAILS DEL LOOP

- No cambiar QUÉ se persiste ni el modelo de RLS — solo cómo se reporta el
  resultado.
- No tocar archivos de seguridad ni otros flujos (chat, onboarding, login).
- No aflojar tests existentes; solo agregar los que hagan falta.
- Correr `next build` antes de terminar.
- Correr `engineering:code-review` sobre el diff.
- FRENAR antes de commitear. Mostrar el antes/después del comportamiento (con
  Supabase simulando un error) antes de aprobar.

# Paso 7 — Captura conversacional de variables

## Qué resuelve

Gluco venía registrando solo glucemia. El paso 7 le da la capacidad de **capturar
pasivamente** otras variables que la persona menciona al pasar mientras charla —
sueño, estrés, comida, ejercicio e insulina — para alimentar los patrones
cruzados del futuro. **La captura es pasiva:** no se le pide al usuario ningún
dato que no ofreció. Si dice "hola", no se le pregunta cuánto durmió. Gluco sigue
siendo un compañero, no un formulario con voz.

## Filosofía (la misma que `detectarGlucosa`)

- **Ante la duda, NO guardar.** Un dato faltante es mejor que un dato falso.
- Cada detector exige su **contexto obligatorio** y descarta lo ambiguo.
- Son **funciones puras y testeables**: mismo input → mismo output, sin efectos.
- Un mensaje puede generar **múltiples eventos** ("dormí 5 horas y amanecí en
  190" → evento `sueno` + evento `glucemia`).

## Los detectores — `src/lib/agents/deteccion.ts`

Cinco funciones puras (`detectarSueno`, `detectarEstres`, `detectarComida`,
`detectarEjercicio`, `detectarInsulina`) y un agregador `detectarEventos` que
las corre todas y devuelve los eventos capturados. La **glucemia va en su propio
carril** (`detectarGlucosa` en `seguridad.ts`) por su rol en el pre-filtro de
emergencia.

| Tipo | `valor_num` | `valor_texto` | Notas de detección |
|------|-------------|---------------|--------------------|
| `sueno` | horas dormidas si las dice ("5 horas", "7 hs") | mensaje | "me acosté a las 3" NO toma 3 como horas (es hora de reloj) |
| `estres` | escala 1-10 inferida por keywords, o número explícito ("9/10") | mensaje | "sin estrés" → 2 (calma); "quedate tranquilo" (a otro) → nada |
| `comida` | — | mensaje | solo verbos en **pasado** (`comí/almorcé/cené…`); descarta el "como" conjunción y la intención futura |
| `ejercicio` | minutos solo con unidad ("40 min", "1 hora"→60); 0 si sedentarismo declarado | mensaje | "corrí 5 km" NO toma 5 como minutos |
| `insulina` | **siempre `null`** (cero semántica de dosis) | mensaje | solo verbos de aplicación en **pasado** + contexto de insulina |

### Insulina: registro estrictamente informativo

La captura de insulina **nunca** genera una recomendación ni interpreta una
dosis. Exige **dos señales juntas**: un verbo de aplicación en pasado ("me puse",
"me apliqué", "me inyecté", "me pinché", "me di", "me coloqué") **y** contexto de
insulina. Esto excluye por diseño:

- Las **preguntas de dosis** ("¿cuánta insulina me pongo?") — no hay verbo en
  pasado, no dispara registro. La pregunta la atiende el subagente `insulina`
  (educativo), que rechaza prescribir.
- La **intención futura** ("tengo que ponerme la basal más tarde").

`valor_num` viene `null` desde el detector a propósito: no se persiste ninguna
dosis. El registro es informativo, no prescriptivo.

### Estimación de carbohidratos (v0)

`metadatos.estimacion_carbs` se completa **solo cuando el usuario declara los
carbos explícitamente** ("comí 45g de carbos" → 45). No se estima por IA: un
detector determinístico no puede adivinar los carbos de "una pizza" sin romper
"función pura" y "ante la duda no guardar". La estimación asistida queda como
trabajo futuro.

## Nota técnica: `\b` y las vocales acentuadas

En JavaScript, `\b` (word boundary) es **ASCII**: no reconoce `í`, `é`, `ó` como
parte de palabra, así que `\bcomí\b` o `me\s+pinché\b` **nunca** matchean. Los
detectores usan lookbehind/lookahead con clase de vocales acentuadas
(`(?<![a-záéíóúñ])…(?![a-záéíóúñ])`) en vez de `\b`. Así "comí" cuenta pero
"comida"/"como" no.

## Persistencia — `src/app/api/chat/route.ts`

`registrarObservabilidad` arma la fila de glucemia/ruteo (como antes) y suma una
fila por cada evento capturado, en un **único insert por lote**. Todo con el
**cliente de sesión** del usuario (anon key + cookies): la política RLS
`evento_insert_own` (`WITH CHECK auth.uid() = usuario_id`) valida cada fila. Nada
usa `service_role`. Los errores se loguean server-side y nunca rompen la
respuesta al usuario.

Los `tipo` nuevos (`sueno`, `estres`, `comida`, `ejercicio`, `insulina`) **no
requieren migración**: `evento.tipo` es `text` libre (sin `CHECK`).

## Memoria (extensión del paso 4)

`buildVariablesContext` lee los últimos eventos de **sueño y estrés** (comida y
ejercicio quedan afuera: demasiado ruido) con el cliente de sesión (RLS) y arma
un bloque de **contexto privado** que `construirSystemPrompt` inyecta como la
memoria de glucemia: siempre después de `REGLAS_SEGURIDAD`, **nunca en
emergencia** (gate estructural, no depende del caller). Gluco puede mencionar con
suavidad que alguien durmió poco si viene al caso, jamás como reproche ni
vigilancia. La memoria acompaña, no controla.

## Tests — `__tests__/deteccion.test.ts`

Misma rigurosidad que `detectarGlucosa`: casos positivos y negativos por cada
tipo de evento (≥6 por tipo), el caso de múltiples eventos, y regresiones de los
falsos positivos que salieron del code review (insulina con adjetivos sueltos,
"siempre tranquilo", "sin estrés").

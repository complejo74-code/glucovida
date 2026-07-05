# Arquitectura de agentes de Gluco (Paso 5)

Gluco pasó de ser un solo prompt a un **orquestador** que enruta cada mensaje
a subagentes especializados. El usuario siempre recibe UNA respuesta natural:
el ruteo interno jamás se expone al cliente.

## Diagrama de flujo

```
POST /api/chat
      │
      ▼
1. Validación runtime del body (role + content string) ──✗──▶ 400
      │
      ▼
2. PRE-FILTRO DE SEGURIDAD  (seguridad.ts · determinístico, SIN LLM)
   ¿glucosa <70? ¿síntomas de hipo? ¿síntomas graves?
      │
      ├── SÍ → salta la clasificación → prompt de EMERGENCIA
      │        (REGLAS_SEGURIDAD + INSTRUCCION_EMERGENCIA → protocolo 15/15)
      │
      ▼ NO
3. CLASIFICACIÓN  (orquestador.ts · claude-haiku, max_tokens 100, solo JSON)
   {"agentes": ["nutricion" | "insulina" | "emocional"]}
      │
      ├── falla / JSON inválido / sin match → agentes = [] (fallback)
      │
      ▼
4. RESPUESTA ÚNICA  (claude-sonnet, una sola llamada)
   system = construirSystemPrompt():
     REGLAS_SEGURIDAD            ← SIEMPRE primero, en TODOS los caminos
   + especialidad(es) elegidas   ← 0, 1 o varias combinadas
   + memoria (historial glucemia con RLS, paso 4)
      │
      ▼
5. Cliente recibe SOLO { reply }  ·  Ruteo → observabilidad server-side
```

## Módulos (`src/lib/agents/`)

| Módulo | Rol |
|---|---|
| `seguridad.ts` | Reglas innegociables compartidas (`REGLAS_SEGURIDAD`), instrucción de emergencia, pre-filtro determinístico (`preFiltroSeguridad`) y `detectarGlucosa`. |
| `orquestador.ts` | `clasificar()` (Haiku, JSON corto) y `construirSystemPrompt()` (único constructor de prompts). |
| `nutricion.ts` | Carbohidratos, índice glucémico, porciones, comida argentina. Nunca juzga. |
| `insulina.ts` | SOLO educativo: tipos, timing, sitios de inyección, conceptos de corrección. Refuerzo redundante: jamás dosis. |
| `emocional.ts` | Valida emociones, burnout de diabetes, sugiere apoyo profesional. No diagnostica. |
| `tipos.ts` | `AgenteId`, `Subagente`, `ResultadoRuteo`. |

## Invariante de seguridad

`construirSystemPrompt()` inicializa el prompt con `REGLAS_SEGURIDAD` **antes
de cualquier bifurcación**. Es estructuralmente imposible generar un prompt
sin las reglas de seguridad, incluso si:

- el clasificador lanza una excepción (catch → fallback),
- devuelve JSON malformado o vacío (→ fallback = Gluco general),
- se combinan varios subagentes,
- el pre-filtro detecta una emergencia (seguridad + emergencia, sin especialidades).

Defensa en profundidad adicional:

1. El pre-filtro es **regex + keywords, sin IA**: no puede fallar por mal ruteo.
2. `insulina.ts` repite el refuerzo anti-dosis dentro de su especialidad.
3. Las reglas base (`REGLAS_SEGURIDAD`) ya incluyen 15/15, no-dosificación y
   derivación a urgencias — el fallback general también las tiene.

## Observabilidad

Cada mensaje registra qué agente(s) lo atendieron (server-side, nunca al cliente):

- **Con glucemia detectada** → evento `tipo: "glucemia"` con
  `metadatos.ruteo = { agentes, emergencia, via }`.
- **Sin glucemia** → evento liviano `tipo: "ruteo_chat"` con el mismo bloque.
- `via` ∈ `"clasificador" | "prefiltro" | "fallback"` — permite medir la
  calidad del ruteo con SQL.
- Además se loguea en consola del server: `[/api/chat] ruteo: {...}`.

Los errores de observabilidad se tragan (log a consola) — nunca rompen la
respuesta al usuario.

## Memoria (paso 4)

Sin cambios: `buildHistorialContext` lee las últimas 15 glucemias con el
cliente de sesión (RLS aplicado) y se inyecta como bloque de contexto privado
al final del system prompt, en todos los caminos.

## Casos de prueba validados (2026-07-05)

| Mensaje | Ruteo |
|---|---|
| "¿puedo comer asado el domingo?" | `nutricion` (clasificador) |
| "¿me conviene la insulina rápida antes o después de comer?" | `insulina` — explica timing sin dosis |
| "estoy agotado de medirme, no doy más" | `emocional` |
| "estoy en 62 y me tiemblan las manos" | **prefiltro** → protocolo 15/15 |
| "dormí mal y amanecí en 190" | `emocional` (clasificador) |
| "estoy harto de contar carbohidratos, ya no sé ni qué comer" | `nutricion` + `emocional` (combinado) |

## Pendientes conocidos (del code review)

- Exigir autenticación (401) en `/api/chat` para evitar consumo anónimo de tokens.
- `detectarGlucosa` puede dar falsos positivos ("tengo 45 años") que persisten
  eventos de glucemia espurios — evaluar umbral de confianza antes de guardar.
- Migrar el insert de observabilidad del admin client a una policy de INSERT
  con `usuario_id = auth.uid()` (RLS sin excepciones).

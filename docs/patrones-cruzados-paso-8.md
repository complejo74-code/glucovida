# Paso 8 — Patrones cruzados v0

Detección **determinística** de relaciones entre **dos variables**: una variable
de estilo de vida (sueño, estrés) contra la glucemia. Extiende el Paso 6, que
miraba una sola variable por vez. Misma filosofía: la matemática es pura (sin
LLM), un patrón falso es peor que ningún patrón, y **la memoria acompaña, no
vigila**.

## 1. Correlación, no causalidad (lo más importante del paso)

Un patrón cruzado dice que **dos cosas coinciden**, no que **una cause la otra**.
Es una distinción que en salud no es un tecnicismo: comunicarla mal puede llevar
a alguien a tomar decisiones equivocadas sobre su cuerpo.

Que las mañanas después de dormir poco muestren glucemias más altas **no**
significa que dormir poco "suba" la glucemia. Puede haber:

- **Un tercer factor (confounder):** las noches de poco sueño suelen coincidir
  con estrés, comidas tardías, enfermedad o cambios de rutina — y cualquiera de
  esos podría ser el verdadero motor.
- **Causalidad inversa:** una glucemia desregulada puede *arruinar* el sueño,
  no al revés.
- **Azar:** con pocas observaciones, dos series suben y bajan juntas por
  casualidad. Por eso el rigor (abajo) es innegociable.
- **Selección de lo que se registra:** la persona anota más ciertos días; lo
  capturado no es una muestra aleatoria.

**En el código.** `src/lib/patrones/cruces.ts` lo documenta explícitamente en el
encabezado y en cada función. El cálculo devuelve una **diferencia de promedios
observada** y nunca una afirmación de efecto.

**En la comunicación.** El bloque que se inyecta al prompt (`contexto.ts`):

- Se plantea **siempre como pregunta tentativa** ("¿Será que…?"), nunca como
  afirmación.
- Usa **solo lenguaje asociativo** ("coinciden con", "los días/noches que…") y
  **jamás lenguaje causal** ("te sube", "te causa", "genera", "por culpa de").
- Cierra con "Es algo interesante para mirar con tu médico/a".
- Incluye el recordatorio explícito: *"esto es una CORRELACIÓN observada (dos
  cosas que coinciden), no significa que una lleve a la otra ni es diagnóstico."*

## 2. Los dos cruces (ventana 14 días)

Unidad de observación: un **día calendario local rioplatense** (no UTC).

- **`sueno_vs_amanecer`** — compara la glucemia del **amanecer** (5–9 h local)
  entre días de **poco sueño (< 6 h)** y de **sueño normal (≥ 6 h)**. Reporta la
  diferencia de promedios.
  - **Emparejamiento (v0, documentado):** el sueño reportado un día se cruza con
    el amanecer de **ese mismo día local**. Los verbos de sueño son siempre en
    pasado ("dormí 4 h"), así que reportar de mañana (sobre la noche que pasó) o
    de noche (sobre la noche anterior) cae en el mismo día calendario que su
    amanecer. Sin par día→mañana, la observación no cuenta.
- **`estres_vs_glucemia`** — compara la glucemia **promedio del día** entre días
  de **estrés alto** (máximo del día ≥ 7) y **estrés bajo** (máximo ≤ 4). El
  estrés **medio (5–6) se excluye** a propósito: sin separación clara entre
  grupos, la comparación es ruido.

La estructura está preparada para sumar más cruces: cada cruce arma dos grupos de
observaciones de glucemia y delega el veredicto en el guard genérico
`evaluarCruce`.

## 3. Rigor estadístico (factor 41, reforzado)

Más estricto que en los patrones simples, porque cruzar dos variables multiplica
las chances de encontrar coincidencias espurias:

- **≥ 5 observaciones en CADA grupo** (`MIN_OBS_CRUCE = 5`): al menos 5 noches de
  poco sueño *y* 5 de sueño normal. Sin eso → `null`.
- **Diferencia de promedios ≥ 20 mg/dL** (`DELTA_CRUCE_MIN`): diferencias más
  chicas son ruido y no se reportan.
- Cada cruce lleva `n` por grupo y una `confianza ∈ [0,1]` (proxy por tamaño de
  muestra, satura en n=12; **no** es un p-value).
- Con datos escasos o diferencia chica, **el sistema calla** (`null`). No hay
  bloque, no hay pregunta.

## 4. Comunicación (una sola mención)

`construirContextoPatrones(patrones, cruces)` sigue armando **como máximo UN
bloque conversacional** — ahora elegido entre **simples y cruzados** vía
`seleccionarMencion`: gana la mayor confianza (desempate por prioridad; los
cruces van después de los simples). El bloque de seguridad de `hipos_recurrentes`
sigue apareciendo siempre, aparte, como hasta ahora.

## 5. Integración y persistencia (RLS intacto)

- En `/api/chat`, tras la observabilidad y **solo fuera de emergencia**, se leen
  las glucemias + sueño + estrés de 14 días (`leerLecturas14d` con `tipo`), se
  calculan los cruces y se **persisten en la misma tabla `patron`** junto con los
  simples, todo con el **cliente de sesión (RLS)**. Nada usa `service_role`.
- Sin migración: `factor` es `text` libre. `sincronizarPatrones` acepta simples y
  cruzados (comparten la forma persistida) y el barrido de borrado incluye los
  factores cruzados, así que un cruce que deja de aplicar se elimina.
- Un cruce puede tener `efecto_estimado` **negativo** (grupo expuesto por debajo
  del control); la comunicación lee el signo para decir "más arriba/abajo" sin
  afirmar dirección causal.

## 6. Tests

`__tests__/patrones-cruzados.test.ts` (20), con datos sintéticos y `ahora`
inyectado. Por cada cruce: correlación clara + datos suficientes (**reporta**),
correlación pero < 5 en un grupo (**calla**), datos suficientes pero diferencia
< 20 mg/dL (**calla**) y datos contradictorios (**calla**). Además: exclusión del
estrés medio, días sin par día→mañana / sin glucemia, orquestación
(`calcularCruces`), la selección unificada (máximo un patrón entre simples y
cruzados) y los guardrails de lenguaje (regex que prohíbe lo causal, exige lo
asociativo). Un test-demo imprime un cruce calculado + su comunicación tentativa.
Metodología TDD: los tests se escribieron primero.

## 7. Code review

Verificado: (a) la matemática es determinística y está testeada (reusa los
helpers del Paso 6, sin duplicar); (b) ningún patrón cruzado usa lenguaje causal
(blindado por test); (c) RLS y guardrails intactos — lectura/persistencia por
cliente de sesión con filtro `usuario_id` + RLS, máximo un patrón, nunca en
emergencia. Sin bugs de correctitud; se aplicó un refactor menor (evitar doble
cálculo de `horaLocal`).

## Backlog conocido (no bloqueante)

- Emparejamiento sueño→amanecer del mismo día local: heurística v0 razonable;
  con datos de dispositivos (CGM/wearables) podría precisarse la noche real.
- Umbrales (`< 6 h`, `≥ 7` / `≤ 4`, `≥ 20 mg/dL`) son constantes v0 tuneables.
- Estrés como proxy grueso por keywords (Paso 7), no una medición.
- Zona horaria fija en rioplatense (heredado del Paso 6); debe salir del perfil.

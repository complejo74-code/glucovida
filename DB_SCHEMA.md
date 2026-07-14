# DB Schema — GlucoVida (chat web)

Esquema de la base Supabase (PostgreSQL). La fuente de verdad son las
migraciones en `supabase/migrations/`; este documento las resume. **Toda** tabla
con datos del usuario tiene RLS habilitado y acota por `auth.uid()`.

## Tablas

### `usuario` (migración 001; ampliada en 003 — paso 9; y en 004 — paso 9.5)

Perfil del usuario, 1:1 con `auth.users`. La migración 003 sumó el contexto que
personaliza a los subagentes (tono/contexto, nunca los guardrails); la 004 lo
amplió con nombre, sexo, peso y altura.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `nombre` | `text` | cómo quiere que Gluco la/lo llame. **Requerido en la UI del onboarding, nullable en DB** (agregarlo NOT NULL sobre filas existentes rompería la no-destructividad). Agregado en 004 |
| `tipo_diabetes` | `text` | `CHECK IN ('DM1','DM2','LADA','DMG','prediabetes','otro')` — `'otro'` agregado en 003 |
| `anio_nacimiento` | `int` | edad sin fecha exacta (menos sensible). `CHECK (NULL OR 1900..2026)` |
| `sexo` | `text` | `CHECK (NULL OR IN ('masculino','femenino','prefiero_no_decir'))`. `null` = no respondió; `prefiero_no_decir` = eligió no decir (distinto). Agregado en 004 |
| `peso_kg` | `numeric` | `CHECK (NULL OR 20..400)`. Contexto interno para porciones; **nunca material de comentario evaluativo**. Agregado en 004 |
| `altura_cm` | `int` | `CHECK (NULL OR 50..250)`. Con `peso_kg` se deriva el IMC (contexto interno). Agregado en 004 |
| `menstrua` | `boolean` | **nullable**. Persistida pero el onboarding **ya no la pregunta** (paso 9.5); se conserva para el futuro subagente hormonal |
| `onboarding_completo` | `boolean` | `NOT NULL DEFAULT false`. Gate de onboarding (paso 9) |
| `creado_en` | `timestamptz` | `DEFAULT now()` |

Se crea automáticamente al registrarse vía trigger `on_auth_user_created`
(`handle_new_user`, `SECURITY DEFINER`) con `onboarding_completo=false`; el
onboarding hace **UPDATE** (nunca INSERT). El RLS de `usuario` (`auth.uid() = id`)
ya cubre todas las columnas nuevas de 004: no hizo falta ninguna policy nueva.
`menstrua` se persiste pero **no se inyecta** al system prompt (queda para el
futuro subagente hormonal); `sexo` solo se surfacea si es `masculino`/`femenino`.
Ver `docs/perfil-onboarding-paso-9.md`.

### `insulina_usuario` (migración 003 — paso 9)

Insulinas que la persona declaró usar. Un usuario puede tener varias.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | `DEFAULT gen_random_uuid()` |
| `usuario_id` | `uuid` NOT NULL | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `clase` | `text` NOT NULL | `CHECK IN ('rapida','basal','lenta','mixta')` |
| `marca` | `text` | nullable (puede no saberla) |
| `activa` | `boolean` NOT NULL | `DEFAULT true`. Permite desactivar sin borrar historial |
| `creado_en` | `timestamptz` NOT NULL | `DEFAULT now()` |

Índice: `idx_insulina_usuario (usuario_id)`. Es un **registro informativo**: cero
semántica de dosis. El bloque de perfil puede nombrar las insulinas reales de la
persona, siempre como concepto educativo, jamás calculando una dosis.

### `evento` (migración 001)

Registro genérico de eventos del usuario. Se usa para glucemias
(`tipo='glucemia'`, valor en `valor_num` mg/dL), observabilidad del ruteo
(`tipo='ruteo_chat'`) y, desde el paso 7, las variables capturadas
conversacionalmente: `sueno`, `estres`, `comida`, `ejercicio`, `insulina`.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | `DEFAULT gen_random_uuid()` |
| `usuario_id` | `uuid` | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `tipo` | `text` NOT NULL | `'glucemia'`, `'ruteo_chat'`, `'sueno'`, `'estres'`, `'comida'`, `'ejercicio'`, `'insulina'`, … |
| `valor_num` | `numeric` | mg/dL (glucemia), horas (sueño), 1-10 (estrés), minutos (ejercicio). **Siempre `null` en `insulina`** (cero semántica de dosis) |
| `valor_texto` | `text` | texto original / etiqueta / descripción |
| `metadatos` | `jsonb` | fuente, ruteo, flags; `estimacion_carbs` en `comida` si el usuario la declaró |
| `ocurrido_en` | `timestamptz` NOT NULL | `DEFAULT now()` (UTC) |
| `creado_en` | `timestamptz` NOT NULL | `DEFAULT now()` |

Índice: `idx_evento_usuario_tiempo (usuario_id, ocurrido_en DESC)`.

`tipo` es `text` libre (sin `CHECK`): los tipos del paso 7 **no requieren
migración**. La detección determinística vive en `src/lib/agents/deteccion.ts`
(ver `docs/deteccion-conversacional-paso-7.md`).

### `patron` (migración 002 — paso 6; ampliada en paso 8)

Patrones detectados de forma determinística sobre los datos del usuario. Una fila
por `(usuario_id, factor)`; se recalcula (upsert) al procesar cada mensaje.
Alberga tanto los **patrones simples** (paso 6, una variable) como los **patrones
cruzados** (paso 8, relación entre dos variables).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | `DEFAULT gen_random_uuid()` |
| `usuario_id` | `uuid` NOT NULL | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `factor` | `text` NOT NULL | simples: `'amanecer_alto'` / `'franja_problematica'` / `'tendencia_semanal'` / `'hipos_recurrentes'` · cruzados (paso 8): `'sueno_vs_amanecer'` / `'estres_vs_glucemia'` |
| `efecto_estimado` | `numeric` | magnitud (unidad según el factor). En los cruces = **diferencia de promedios** (grupo expuesto − control), en mg/dL; **puede ser negativa** |
| `n_observaciones` | `integer` NOT NULL | observaciones que respaldan el patrón (factor 41). En los cruces = suma de ambos grupos |
| `confianza` | `numeric` NOT NULL | `[0,1]`, proxy por muestra (no es p-value) |
| `detalle` | `jsonb` | simples: franja, dirección, promedios… · cruces: los dos grupos comparados (`promedio` + `n` de cada uno) para la comunicación |
| `actualizado_en` | `timestamptz` NOT NULL | `DEFAULT now()` |

Restricción: `UNIQUE (usuario_id, factor)` → upsert idempotente. Su índice
también sirve las lecturas por `usuario_id` (no hay índice adicional).

Los factores cruzados **no requirieron migración**: `factor` es `text` libre y la
tabla ya modela la forma que comparten simples y cruzados (mismos campos de rigor
+ `detalle jsonb`). Un patrón cruzado es una **correlación observada, no una
relación causal** (ver `docs/patrones-cruzados-paso-8.md`).

## Row Level Security

RLS habilitado en `usuario`, `evento`, `patron` e `insulina_usuario`. Todas las
políticas acotan por `auth.uid()`; ningún dato cruza de un usuario a otro. Nada
del flujo usa `service_role`.

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `usuario` | `auth.uid() = id` | `auth.uid() = id` | `auth.uid() = id` | — |
| `evento` | `auth.uid() = usuario_id` | `auth.uid() = usuario_id` | — | — |
| `patron` | `auth.uid() = usuario_id` | `auth.uid() = usuario_id` | `auth.uid() = usuario_id` | `auth.uid() = usuario_id` |
| `insulina_usuario` | `auth.uid() = usuario_id` | `auth.uid() = usuario_id` | `auth.uid() = usuario_id` | `auth.uid() = usuario_id` |

`patron` e `insulina_usuario` necesitan `UPDATE` y `DELETE` (recalcular/editar y
borrar); por eso tienen las 4 políticas, a diferencia de `evento`.

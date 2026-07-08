# DB Schema — GlucoVida (chat web)

Esquema de la base Supabase (PostgreSQL). La fuente de verdad son las
migraciones en `supabase/migrations/`; este documento las resume. **Toda** tabla
con datos del usuario tiene RLS habilitado y acota por `auth.uid()`.

## Tablas

### `usuario` (migración 001)

Perfil mínimo del usuario, 1:1 con `auth.users`.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `tipo_diabetes` | `text` | `CHECK IN ('DM1','DM2','LADA','DMG','prediabetes')` |
| `creado_en` | `timestamptz` | `DEFAULT now()` |

Se crea automáticamente al registrarse vía trigger `on_auth_user_created`
(`handle_new_user`, `SECURITY DEFINER`).

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

### `patron` (migración 002 — paso 6)

Patrones temporales detectados de forma determinística sobre las glucemias del
usuario. Una fila por `(usuario_id, factor)`; se recalcula (upsert) al procesar
cada mensaje.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | `uuid` PK | `DEFAULT gen_random_uuid()` |
| `usuario_id` | `uuid` NOT NULL | `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `factor` | `text` NOT NULL | `'amanecer_alto'` / `'franja_problematica'` / `'tendencia_semanal'` / `'hipos_recurrentes'` |
| `efecto_estimado` | `numeric` | magnitud (unidad según el factor) |
| `n_observaciones` | `integer` NOT NULL | lecturas que respaldan el patrón (factor 41) |
| `confianza` | `numeric` NOT NULL | `[0,1]`, proxy por muestra (no es p-value) |
| `detalle` | `jsonb` | franja, dirección, promedios… para la comunicación |
| `actualizado_en` | `timestamptz` NOT NULL | `DEFAULT now()` |

Restricción: `UNIQUE (usuario_id, factor)` → upsert idempotente. Su índice
también sirve las lecturas por `usuario_id` (no hay índice adicional).

## Row Level Security

RLS habilitado en `usuario`, `evento` y `patron`. Todas las políticas acotan por
`auth.uid()`; ningún dato cruza de un usuario a otro. Nada del flujo usa
`service_role`.

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `usuario` | `auth.uid() = id` | `auth.uid() = id` | `auth.uid() = id` | — |
| `evento` | `auth.uid() = usuario_id` | `auth.uid() = usuario_id` | — | — |
| `patron` | `auth.uid() = usuario_id` | `auth.uid() = usuario_id` | `auth.uid() = usuario_id` | `auth.uid() = usuario_id` |

`patron` necesita `UPDATE` (upsert al recalcular) y `DELETE` (borrar patrones que
dejaron de aplicar); por eso tiene las 4 políticas, a diferencia de `evento`.

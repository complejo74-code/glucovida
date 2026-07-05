# Memoria Conversacional — Paso 4

## Qué hace

Antes de cada llamada a Anthropic, el endpoint `/api/chat` lee de Supabase los últimos 15 eventos de glucemia del usuario logueado y se los pasa a Gluco como contexto privado en el system prompt.

Gluco usa ese historial para acompañar con calidez ("venís mejor que ayer"), no para recitar estadísticas ni juzgar.

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/app/api/chat/route.ts` | Se agregaron `buildHistorialContext`, `formatFechaRelativa` y `buildSystemPrompt`. El `POST` handler llama a `buildHistorialContext` antes de invocar la API de Anthropic. |

## Flujo de datos

```
Request POST /api/chat
  │
  ├─ createClient()             → cliente anon key + cookies de sesión
  ├─ supabase.auth.getUser()    → valida sesión, obtiene user.id
  │
  ├─ buildHistorialContext(supabase, user.id)
  │    └─ SELECT valor_num, ocurrido_en FROM evento
  │         WHERE tipo='glucemia' AND usuario_id=userId
  │         ORDER BY ocurrido_en DESC LIMIT 15
  │         [RLS: auth.uid() = usuario_id — filtro automático]
  │    └─ Devuelve string legible: "hoy 08:30: 130 mg/dL | ayer 22:00: 140 mg/dL | ..."
  │         o "" si no hay datos o hay error
  │
  ├─ buildSystemPrompt(historial)
  │    └─ Si historial != "": agrega sección [CONTEXTO PRIVADO] al system prompt base
  │    └─ Si historial == "": devuelve el prompt base sin cambios (usuario nuevo)
  │
  └─ Anthropic API: messages.create({ system: buildSystemPrompt(historial), ... })
```

## Seguridad

- **Lectura con RLS:** `buildHistorialContext` usa el cliente de sesión (`createClient()`), nunca el admin. El RLS de Supabase garantiza `auth.uid() = usuario_id` a nivel base de datos.
- **Defensa en profundidad:** la query incluye `.eq("usuario_id", userId)` además del RLS.
- **Service role solo en escritura:** `createAdminClient()` se usa únicamente para insertar el evento detectado en el mensaje actual. Nunca para leer.
- **Historial nunca llega al frontend:** el string del historial va al system prompt de Anthropic (server-to-server). El frontend solo recibe el `reply` generado.
- **Error seguro:** si la query falla, `buildHistorialContext` devuelve `""` → Gluco opera sin historial, sin exponer el error al usuario.

## Instrucciones a Gluco sobre el historial

```
[CONTEXTO PRIVADO — no mostrar crudo ni recitar al usuario]
Últimas glucemias registradas: <historial>
Cómo usar este historial:
- Úsalo para acompañar con calidez cuando sume algo humano (ej: "venís mejor que ayer").
- No recités estadísticas ni promedios. No lo mencionás en cada respuesta.
- Si el usuario comparte una glucemia nueva, podés comparar con suavidad cuando sea alentador.
- Si no hay nada relevante que decir del historial en este momento, ignoralo completamente.
- La memoria acompaña, no vigila. Jamás juzgás ni alarmás innecesariamente.
```

## Caso borde: usuario nuevo

Si el usuario no tiene eventos registrados, `buildHistorialContext` devuelve `""` y `buildSystemPrompt` retorna el prompt base sin ninguna sección de historial. Gluco se comporta exactamente igual que antes del Paso 4.

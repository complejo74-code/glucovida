/*
 * GlucoVida — Service Worker MÍNIMO (paso 11).
 *
 * REGLA DE ORO (docs/BRANDING.md + spec 11 R4): esto es una app de SALUD.
 * NUNCA se cachea información sensible ni en tiempo real:
 *   - respuestas del chat (Gluco) ni ningún /api/*
 *   - navegaciones (HTML de /chat, /perfil, etc.): traen datos del usuario
 *   - lecturas de glucosa, patrones, perfil
 * Cachear un dato de glucosa viejo o una respuesta de Gluco vieja es peligroso.
 *
 * SOLO se cachea lo estático e inmutable: assets de build (/_next/static/*),
 * los íconos (/icons/*) y el favicon. Estos archivos llevan hash o son fijos,
 * así que servirlos desde caché es seguro y hace que la app abra rápido y
 * funcione sin conexión la próxima vez.
 */

const CACHE = "glucovida-static-v1";
const OFFLINE_URL = "/offline";

// Íconos de marca: fijos, seguros de precachear (nunca redirigen).
const PRECACHE_ICONS = ["/icons/icon-192.png", "/icons/icon-512.png"];

// Fallback offline autocontenido: HTML de marca con estilos inline, sin
// depender de ningún CSS ni ruta cacheada. Tono cálido del branding (§9):
// nunca una pantalla en blanco ni un error crudo del navegador.
const OFFLINE_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sin conexión — GlucoVida</title>
<style>
  html,body{margin:0;height:100%}
  body{
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    color:#0F172A;
    background:linear-gradient(180deg,#D6EEFB 0%,#EBF6FD 55%,#FFFFFF 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;padding:24px;box-sizing:border-box;
  }
  .mark{width:64px;height:64px;border-radius:9999px;background:#D6EEFB;
    display:flex;align-items:center;justify-content:center;font-size:30px;margin-bottom:16px}
  h1{font-size:24px;font-weight:900;line-height:1.1;margin:0}
  p{font-size:14px;line-height:1.75;color:#5B6B7C;max-width:22rem;margin:8px 0 24px}
  button{
    min-height:44px;padding:0 24px;border:0;border-radius:9999px;cursor:pointer;
    font-size:15px;font-weight:800;color:#0F172A;
    background:linear-gradient(180deg,#22A7E6,#1D90C7);
  }
</style>
</head>
<body>
  <div class="mark" aria-hidden="true">🩵</div>
  <h1>Sin conexión, ya volvemos</h1>
  <p>Parece que te quedaste sin internet. No te preocupes: en cuanto vuelva la conexión, seguimos donde estábamos.</p>
  <button type="button" onclick="location.reload()">Reintentar</button>
</body>
</html>`;

function respuestaOffline() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(PRECACHE_ICONS);
      // /offline: best-effort. La ruta puede redirigir (p. ej. gate de
      // onboarding) → NUNCA guardamos una respuesta redirigida ni con error:
      // rompería el fallback. Si no se puede cachear, usamos el HTML inline.
      try {
        const res = await fetch(OFFLINE_URL, { redirect: "manual" });
        if (res.ok && res.type === "basic" && !res.redirected) {
          await cache.put(OFFLINE_URL, res.clone());
        }
      } catch {
        // sin red en install: no pasa nada, queda el HTML inline como fallback
      }
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ¿Es un asset estático seguro de cachear? Solo build assets inmutables e íconos.
function esEstaticoCacheable(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.ico"
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo GET del mismo origen. El resto (POST, otros orígenes) pasa directo.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // NUNCA tocar la API (chat/salud). Que vaya SIEMPRE a la red, sin caché.
  if (url.pathname.startsWith("/api/")) return;

  // Navegaciones (documentos HTML): SIEMPRE frescas desde la red. Traen datos
  // del usuario y no se cachean jamás. Si no hay red, mostramos el estado
  // offline cálido (la ruta /offline cacheada, o el HTML inline de respaldo).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match(OFFLINE_URL, { ignoreSearch: true });
        return cached ?? respuestaOffline();
      })
    );
    return;
  }

  // Assets estáticos inmutables: cache-first (rápido + offline-ready).
  if (esEstaticoCacheable(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          // Solo cachear respuestas OK y básicas (mismo origen).
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Cualquier otra cosa: red directa, sin caché.
});

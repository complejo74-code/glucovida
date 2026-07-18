# Review: STEP 11 — Installable PWA

## Verdict: PASS

Verification method: `npm test` (168/168), `npm run build` (clean), `npm run
lint` (0 errors), and live checks against `next start` on :3111 (curl of the
manifest, rendered `<head>`, icons, `/offline`, and `/sw.js`). Service-worker
runtime behaviour verified by tracing the fetch handler against each request
class plus confirming the served files — not by executing the SW in a browser.

## Requirements
1. "manifest.json … name 'GlucoVida', short name 'GlucoVida', theme_color and
   background_color using the brand tokens … display: standalone, start_url
   pointing to /chat … portrait orientation" — **Met**. `curl /manifest.webmanifest`
   returns exactly: `name/short_name "GlucoVida"`, `theme_color "#22A7E6"`,
   `background_color "#FFFFFF"`, `display "standalone"`, `start_url "/chat"`,
   `orientation "portrait"`. Source: `src/app/manifest.ts`.
2. "Icons in standard required sizes (192x192, 512x512, and a maskable icon)…
   brand icon/droplet … brand celeste" — **Met**. `public/icons/icon-192.png`,
   `icon-512.png` (`purpose any`), `icon-maskable-512.png` (`purpose maskable`,
   content within the ~80% safe zone) all serve `200 image/png`. White brand
   heart on the celeste brand gradient; inspected visually.
3. "meta tags in <head> (apple-touch-icon, theme-color,
   apple-mobile-web-app-capable)" — **Met**. Rendered `<head>` contains
   `<meta name="theme-color" content="#22A7E6">`,
   `<meta name="apple-mobile-web-app-capable" content="yes">`,
   `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" sizes="180x180">`
   (plus `mobile-web-app-capable`, `apple-mobile-web-app-title`). Source:
   `src/app/layout.tsx`.
4. "MINIMAL service worker: cache static assets ONLY … Do NOT cache chat
   responses or glucose data … must ALWAYS be fresh" — **Met**. `public/sw.js`:
   `fetch` handler caches only when `esEstaticoCacheable(url)` is true —
   `/_next/static/*`, `/icons/*`, `/favicon.ico`. `/api/*` returns early
   (network-only). `mode === "navigate"` (HTML pages) is network-only with an
   offline fallback, never `cache.put`. RSC/data requests (e.g. `/chat?_rsc=`)
   match none of the branches → fall through to the network with no caching.
   No chat/glucose/profile response can enter the cache.
5. "Basic splash screen with the brand … while the app loads when opened as
   installed" — **Met**. `src/components/pwa/SplashScreen.tsx` renders the
   celeste→white gradient + 🩵 + "GlucoVida", only when
   `display-mode: standalone` (or iOS `navigator.standalone`), fading out after
   ~700ms. Manifest `background_color`/`theme_color`/icons also drive the native
   Android splash.
6. "Verify next build still generates everything … app keeps working the same
   for anyone who does NOT install it" — **Met**. `next build` clean; 168 tests
   pass. `ServiceWorkerRegister` no-ops unless `NODE_ENV === "production"` and
   `serviceWorker` is supported; `SplashScreen` returns `null` unless standalone.
   Non-installed browser use is unchanged.

## Edge Cases
- "If the user is offline and opens the installed PWA: it must show a clear
  state … instead of a blank screen or a raw browser error" — **Met**. The SW
  `navigate` branch catches network failure and returns cached `/offline`
  (`src/app/offline/page.tsx`) or a self-contained inline branded HTML page
  (styles inline; renders even if no CSS is cached). Copy: "Sin conexión, ya
  volvemos" with a Reintentar button.
- "The manifest must not break existing login/auth … installing and opening the
  PWA keeps the session" — **Met**. `start_url: /chat` uses the existing
  session-based redirect chain; the SW never caches navigations or `/api/*`, so
  auth cookies and the Supabase session flow are untouched. Middleware left
  unmodified. `/offline` precache uses `redirect: "manual"` and refuses to cache
  redirected/non-OK responses, so a logged-in non-onboarded user's onboarding
  redirect cannot poison the offline cache or abort SW install.

## Definition of Done
- [x] Valid manifest.json with the fields from R1 — curl verified
- [x] Icons in correct sizes, with GlucoVida branding — 4 PNGs serve 200
- [x] iOS meta tags present — head verified
- [x] Service worker caches ONLY static assets, never chat/glucose data — traced
- [x] Branded splash screen visible on open — standalone-gated component
- [x] App installable from Chrome Android / Safari iOS — manifest + iOS meta present
- [x] Clear, warm offline state, not a blank screen — SW fallback + inline HTML
- [x] Normal (non-installed) usage still works exactly the same — prod-gated, null splash
- [x] Tests green (168/168); clean next build

## Summary
PASS — every requirement, edge case, and Definition-of-Done item is Met. The
service worker caches static assets only; no health/chat data path reaches the
cache. Nothing to fix.

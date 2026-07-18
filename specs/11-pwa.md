# STEP 11 — Installable PWA

## OBJECTIVE
Make GlucoVida installable from the phone as an app: home screen icon,
opens fullscreen (no Chrome/Safari browser bar), splash screen with the
brand. This is still the same Next.js web app underneath — this is
configuration, not a rewrite.

## REQUIREMENTS

**R1. manifest** — `manifest.json` (or `manifest.webmanifest`) with: name
"GlucoVida", short name "GlucoVida", `theme_color` and `background_color`
using the brand tokens (primary `#22A7E6` and white), `display: "standalone"`,
`start_url` pointing to `/chat` (or `/` if it redirects correctly based on
session), portrait orientation.

**R2. icons** — Icons in standard required sizes (192x192, 512x512, and a
maskable icon for Android). Use the brand icon/droplet — check if an asset
already exists or generate a simple one with the brand celeste.

**R3. iOS meta tags** — Necessary meta tags in `<head>` (`apple-touch-icon`,
`theme-color`, `apple-mobile-web-app-capable`) so iOS also treats it as an
installable PWA, not just Android.

**R4. minimal service worker** — Cache static assets ONLY (so it loads fast
and is offline-ready next time). Do NOT cache chat responses or glucose data
— those must ALWAYS be fresh, never served from cache (this is real-time
health information).

**R5. splash screen** — Basic splash screen with the brand (celeste→white
background, the icon) while the app loads when opened as installed.

**R6. build integrity** — Verify `next build` still generates everything
correctly and that the app keeps working the same for anyone who does NOT
install it (normal browser use, no behavior changes).

## EDGE CASES
- If the user is offline and opens the installed PWA: it must show a clear
  state ("No connection, we'll be right back" — warm tone) instead of a blank
  screen or a raw browser error.
- The manifest must not break existing login/auth. Test that installing and
  opening the PWA keeps the session.

## DEFINITION OF DONE (verifiable)
- [ ] Valid manifest.json with the fields from R1
- [ ] Icons in correct sizes, with GlucoVida branding
- [ ] iOS meta tags present
- [ ] Service worker caches ONLY static assets, never chat/glucose data
- [ ] Branded splash screen visible on open
- [ ] App installable from Chrome Android (likely) and Safari iOS (likely,
      "Add to Home Screen")
- [ ] Clear, warm offline state, not a blank screen
- [ ] Normal (non-installed) usage still works exactly the same
- [ ] Tests green; clean `next build`

## LOOP GUARDRAILS
- ZERO caching of health data (chat messages, glucose readings, patterns,
  profile). The service worker is for static assets only (CSS, fonts, icons).
  Non-negotiable: caching a stale Gluco response or an outdated glucose
  reading in a health app is dangerous.
- Do not touch security files, auth, or business logic.
- Do not loosen any tests.
- Run `next build` before finishing.
- Run engineering:code-review on the diff, with explicit focus on what the
  service worker caches.
- STOP before committing. Explain how to test the installation on a real
  phone (manual steps).

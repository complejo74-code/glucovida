import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requiereOnboarding } from "@/lib/perfil/gate";

/** Rutas que exigen sesión. El resto (/, /login, /auth) es público. */
const RUTAS_PROTEGIDAS = ["/chat", "/perfil", "/onboarding"];

function esRutaProtegida(pathname: string): boolean {
  return RUTAS_PROTEGIDAS.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: no poner lógica de negocio entre createServerClient y este await
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Proteger rutas privadas (/chat, /perfil, /onboarding): sin sesión → /login
  if (esRutaProtegida(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Si ya está logueado y va a /login, redirigir a /chat
  if (pathname === "/login" && user) {
    const chatUrl = request.nextUrl.clone();
    chatUrl.pathname = "/chat";
    return NextResponse.redirect(chatUrl);
  }

  // ── GATE DE ONBOARDING (paso 9) ────────────────────────────────────────────
  // Para usuarios autenticados: si aún no completaron el onboarding, van a
  // /onboarding. FAILSAFE: si el SELECT falla (error de red/Supabase), tratamos
  // el estado como desconocido (null) y el gate FALLA ABIERTO — dejamos pasar.
  // Un problema de infra jamás puede dejar a la persona trabada fuera de su app.
  if (user) {
    let onboardingCompleto: boolean | null = null;
    try {
      const { data, error } = await supabase
        .from("usuario")
        .select("onboarding_completo")
        .eq("id", user.id)
        .maybeSingle();
      // error o fila ausente → null (fail-open). Solo un false explícito redirige.
      onboardingCompleto = error ? null : data?.onboarding_completo ?? null;
    } catch {
      onboardingCompleto = null; // fail-open ante cualquier excepción
    }

    if (requiereOnboarding(pathname, onboardingCompleto)) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

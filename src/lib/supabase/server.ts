import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Cliente para Server Components, Route Handlers y Server Actions.
 * Usa la anon key — el RLS se aplica normalmente.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll puede fallar en Server Components de solo lectura — es seguro ignorarlo
          }
        },
      },
    }
  );
}

/**
 * Cliente con service_role para operaciones privilegiadas (solo servidor).
 * Bypasea RLS — usar únicamente cuando el servidor necesita escribir en nombre del usuario.
 * NUNCA exportar ni usar en Client Components.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}

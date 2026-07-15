"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Origen real de la app para el link de confirmación de email.
 *
 * NO se puede derivar de NEXT_PUBLIC_SUPABASE_URL: ese es el host de Supabase,
 * no el de nuestra app. Lo tomamos del host de la request — así apunta bien en
 * producción Y en cada preview deploy de Vercel (dominios efímeros distintos),
 * con override opcional por NEXT_PUBLIC_SITE_URL. Si no hay host usable,
 * devolvemos undefined y Supabase cae al Site URL del dashboard (el mismo
 * comportamiento que ya funciona hoy). Requiere que el dominio esté en las
 * Redirect URLs de Supabase (config de dashboard, paso 3).
 */
async function getAppOrigin(): Promise<string | undefined> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return explicit ? explicit.replace(/\/+$/, "") : undefined;
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=credenciales_invalidas");
  }

  revalidatePath("/", "layout");
  redirect("/chat");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const origin = await getAppOrigin();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined,
    },
  });

  if (error) {
    redirect("/login?error=registro_fallido");
  }

  redirect("/login?mensaje=revisa_tu_email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

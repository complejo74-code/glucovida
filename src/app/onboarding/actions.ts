"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  esClaseInsulina,
  esTipoDiabetes,
  type ClaseInsulina,
  type TipoDiabetes,
} from "@/lib/perfil/tipos";

/** Payload del wizard. Todo opcional: saltear cualquier cosa es válido. */
export interface OnboardingPayload {
  tipoDiabetes: TipoDiabetes | null;
  anioNacimiento: number | null;
  menstrua: boolean | null;
  insulinas: Array<{ clase: ClaseInsulina; marca: string | null }>;
}

/**
 * Cierra el onboarding: guarda lo que la persona haya querido compartir y marca
 * onboarding_completo=true SIEMPRE (incluso si salteó todo). Nunca bloquea el
 * uso: ante datos faltantes guarda null y sigue. Cliente de sesión → RLS
 * (auth.uid()=id / usuario_id) valida cada escritura; nada usa service_role.
 */
export async function guardarOnboarding(payload: OnboardingPayload) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Saneo defensivo (no confiamos en el cliente): valores inválidos → null.
  const tipoDiabetes = esTipoDiabetes(payload.tipoDiabetes)
    ? payload.tipoDiabetes
    : null;

  const anio = payload.anioNacimiento;
  const anioNacimiento =
    typeof anio === "number" &&
    Number.isInteger(anio) &&
    anio >= 1900 &&
    anio <= 2026
      ? anio
      : null;

  const menstrua =
    typeof payload.menstrua === "boolean" ? payload.menstrua : null;

  // Perfil + cierre del onboarding en un solo UPDATE (RLS: auth.uid()=id).
  const { error: errPerfil } = await supabase
    .from("usuario")
    .update({
      tipo_diabetes: tipoDiabetes,
      anio_nacimiento: anioNacimiento,
      menstrua,
      onboarding_completo: true,
    })
    .eq("id", user.id);

  if (errPerfil) {
    console.error("[/onboarding] error guardando perfil:", errPerfil);
    // El onboarding no debe ser una pared. Si el update combinado falló,
    // reintentamos SOLO el cierre: es lo que evita que el gate rebote a la
    // persona de vuelta a /onboarding (loop). Los datos del perfil los podrá
    // completar más tarde en /perfil; lo importante es no dejarla trabada.
    const { error: errCierre } = await supabase
      .from("usuario")
      .update({ onboarding_completo: true })
      .eq("id", user.id);
    if (errCierre) {
      console.error("[/onboarding] error cerrando onboarding:", errCierre);
    }
  }

  // Insulinas válidas (si eligió "ninguna", el array viene vacío → no inserta).
  const insulinas = (payload.insulinas ?? [])
    .filter((i) => esClaseInsulina(i.clase))
    .slice(0, 12) // techo defensivo
    .map((i) => ({
      usuario_id: user.id,
      clase: i.clase,
      marca: i.marca?.trim() ? i.marca.trim().slice(0, 80) : null,
      activa: true,
    }));

  if (insulinas.length > 0) {
    const { error: errIns } = await supabase
      .from("insulina_usuario")
      .insert(insulinas);
    if (errIns) console.error("[/onboarding] error guardando insulinas:", errIns);
  }

  revalidatePath("/", "layout");
  redirect("/chat");
}

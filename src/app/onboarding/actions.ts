"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  esClaseInsulina,
  esSexo,
  esTipoDiabetes,
  type ClaseInsulina,
  type Sexo,
  type TipoDiabetes,
} from "@/lib/perfil/tipos";

/** Payload del wizard. Todo opcional salvo el nombre (requerido en la UI). */
export interface OnboardingPayload {
  nombre: string | null;
  tipoDiabetes: TipoDiabetes | null;
  anioNacimiento: number | null;
  sexo: Sexo | null;
  pesoKg: number | null;
  alturaCm: number | null;
  insulinas: Array<{ clase: ClaseInsulina; marca: string | null }>;
}

/** Saneo defensivo del peso: número finito en rango, o null. */
function sanearPeso(peso: number | null): number | null {
  return typeof peso === "number" && Number.isFinite(peso) && peso >= 20 && peso <= 400
    ? peso
    : null;
}

/** Saneo defensivo de la altura: entero en rango, o null. */
function sanearAltura(altura: number | null): number | null {
  return typeof altura === "number" &&
    Number.isInteger(altura) &&
    altura >= 50 &&
    altura <= 250
    ? altura
    : null;
}

/**
 * Cierra el onboarding: guarda lo que la persona haya querido compartir y marca
 * onboarding_completo=true SIEMPRE (incluso si salteó casi todo). Nunca bloquea
 * el uso: ante datos faltantes guarda null y sigue. Cliente de sesión → RLS
 * (auth.uid()=id / usuario_id) valida cada escritura; nada usa service_role.
 */
export async function guardarOnboarding(payload: OnboardingPayload) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Saneo defensivo (no confiamos en el cliente): valores inválidos → null.
  const nombre =
    typeof payload.nombre === "string" && payload.nombre.trim()
      ? payload.nombre.trim().slice(0, 40)
      : null;

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

  const sexo = esSexo(payload.sexo) ? payload.sexo : null;
  const pesoKg = sanearPeso(payload.pesoKg);
  const alturaCm = sanearAltura(payload.alturaCm);

  // Perfil + cierre del onboarding en un solo UPDATE (RLS: auth.uid()=id).
  const { error: errPerfil } = await supabase
    .from("usuario")
    .update({
      nombre,
      tipo_diabetes: tipoDiabetes,
      anio_nacimiento: anioNacimiento,
      sexo,
      peso_kg: pesoKg,
      altura_cm: alturaCm,
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

  // Insulinas válidas (los slots en blanco no llegan; array vacío → no inserta).
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

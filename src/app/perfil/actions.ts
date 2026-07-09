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

/**
 * Edición del perfil (paso 9). Las cosas cambian (nueva insulina, etc.), así que
 * el perfil es editable después del onboarding. NO toca onboarding_completo.
 * Cliente de sesión → RLS (auth.uid()=id / usuario_id) valida cada escritura.
 */
export async function actualizarPerfil(payload: {
  tipoDiabetes: TipoDiabetes | null;
  anioNacimiento: number | null;
  menstrua: boolean | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  const { error } = await supabase
    .from("usuario")
    .update({ tipo_diabetes: tipoDiabetes, anio_nacimiento: anioNacimiento, menstrua })
    .eq("id", user.id);

  if (error) console.error("[/perfil] error actualizando perfil:", error);
  revalidatePath("/perfil");
}

export async function agregarInsulina(clase: ClaseInsulina, marca: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!esClaseInsulina(clase)) return;

  const { error } = await supabase.from("insulina_usuario").insert({
    usuario_id: user.id,
    clase,
    marca: marca.trim() ? marca.trim().slice(0, 80) : null,
    activa: true,
  });
  if (error) console.error("[/perfil] error agregando insulina:", error);
  revalidatePath("/perfil");
}

export async function eliminarInsulina(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS (insulina_delete_own) ya impide borrar filas de otro usuario; el filtro
  // por usuario_id es defensa en profundidad + intención explícita.
  const { error } = await supabase
    .from("insulina_usuario")
    .delete()
    .eq("id", id)
    .eq("usuario_id", user.id);
  if (error) console.error("[/perfil] error eliminando insulina:", error);
  revalidatePath("/perfil");
}

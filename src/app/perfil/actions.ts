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

/**
 * Resultado explícito de una acción de guardado (paso 10B-5). Reemplaza el
 * `void` silencioso: el frontend necesita saber si la escritura en la DB salió
 * bien para no mentirle al usuario con un toast de éxito. `error` es SIEMPRE un
 * mensaje cálido, apto para mostrar; el detalle técnico de Supabase se loguea
 * en el servidor, nunca viaja a la UI.
 */
export type ResultadoGuardado = { ok: true } | { ok: false; error: string };

/**
 * Edición del perfil (paso 9 / 9.5). Las cosas cambian (nueva insulina, otro
 * peso, etc.), así que el perfil es editable después del onboarding. NO toca
 * onboarding_completo. Cliente de sesión → RLS (auth.uid()=id / usuario_id)
 * valida cada escritura; nada usa service_role.
 */
export async function actualizarPerfil(payload: {
  nombre: string | null;
  tipoDiabetes: TipoDiabetes | null;
  anioNacimiento: number | null;
  sexo: Sexo | null;
  pesoKg: number | null;
  alturaCm: number | null;
}): Promise<ResultadoGuardado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
  const pesoKg =
    typeof payload.pesoKg === "number" &&
    Number.isFinite(payload.pesoKg) &&
    payload.pesoKg >= 20 &&
    payload.pesoKg <= 400
      ? payload.pesoKg
      : null;
  const alturaCm =
    typeof payload.alturaCm === "number" &&
    Number.isInteger(payload.alturaCm) &&
    payload.alturaCm >= 50 &&
    payload.alturaCm <= 250
      ? payload.alturaCm
      : null;

  const { error } = await supabase
    .from("usuario")
    .update({
      nombre,
      tipo_diabetes: tipoDiabetes,
      anio_nacimiento: anioNacimiento,
      sexo,
      peso_kg: pesoKg,
      altura_cm: alturaCm,
    })
    .eq("id", user.id);

  revalidatePath("/perfil");
  if (error) {
    console.error("[/perfil] error actualizando perfil:", error);
    return { ok: false, error: "No pudimos guardar tus cambios. ¿Probamos de nuevo?" };
  }
  return { ok: true };
}

export async function agregarInsulina(
  clase: ClaseInsulina,
  marca: string
): Promise<ResultadoGuardado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!esClaseInsulina(clase)) {
    return { ok: false, error: "No pudimos guardar esa insulina. ¿Probamos de nuevo?" };
  }

  const { error } = await supabase.from("insulina_usuario").insert({
    usuario_id: user.id,
    clase,
    marca: marca.trim() ? marca.trim().slice(0, 80) : null,
    activa: true,
  });
  revalidatePath("/perfil");
  if (error) {
    console.error("[/perfil] error agregando insulina:", error);
    return { ok: false, error: "No pudimos guardar esa insulina. ¿Probamos de nuevo?" };
  }
  return { ok: true };
}

export async function eliminarInsulina(id: string): Promise<ResultadoGuardado> {
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
  revalidatePath("/perfil");
  if (error) {
    console.error("[/perfil] error eliminando insulina:", error);
    return { ok: false, error: "No pudimos quitar esa insulina. ¿Probamos de nuevo?" };
  }
  return { ok: true };
}

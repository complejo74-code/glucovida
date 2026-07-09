import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  esClaseInsulina,
  esTipoDiabetes,
  type ClaseInsulina,
  type TipoDiabetes,
} from "@/lib/perfil/tipos";
import PerfilForm from "./PerfilForm";

/**
 * Página de perfil editable (paso 9). Server Component: carga el perfil y las
 * insulinas del usuario con el cliente de sesión (RLS: cada quien ve lo suyo) y
 * delega la edición al formulario cliente vía Server Actions.
 */
export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [perfilRes, insulinasRes] = await Promise.all([
    supabase
      .from("usuario")
      .select("tipo_diabetes, anio_nacimiento, menstrua")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("insulina_usuario")
      .select("id, clase, marca")
      .eq("usuario_id", user.id)
      .eq("activa", true)
      .order("creado_en", { ascending: true }),
  ]);

  const fila = perfilRes.data;
  const tipoDiabetes: TipoDiabetes | null = esTipoDiabetes(fila?.tipo_diabetes)
    ? fila.tipo_diabetes
    : null;

  const insulinas = (insulinasRes.data ?? [])
    .filter((i) => esClaseInsulina(i.clase))
    .map((i) => ({
      id: i.id,
      clase: i.clase as ClaseInsulina,
      marca: i.marca,
    }));

  return (
    <PerfilForm
      inicial={{
        tipoDiabetes,
        anioNacimiento: fila?.anio_nacimiento ?? null,
        menstrua: fila?.menstrua ?? null,
      }}
      insulinas={insulinas}
    />
  );
}

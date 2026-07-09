/**
 * PATRONES TEMPORALES v0 — persistencia (paso 6)
 *
 * Lee las glucemias del usuario y sincroniza la tabla `patron`. SIEMPRE con el
 * cliente CON SESIÓN del usuario (anon key + cookies): RLS garantiza que solo
 * lee/escribe SUS propios datos. Nada de service_role. Los errores se loguean
 * server-side y nunca rompen la respuesta al usuario (igual que la
 * observabilidad del paso 5.5).
 */
import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { FactorCruce, FactorPatron, Lectura, Patron, PatronCruzado } from "./tipos";

type SupabaseSesion = Awaited<ReturnType<typeof createClient>>;

const MS_DIA = 86_400_000;
const VENTANA_DIAS = 14;

/** Todos los factores conocidos (simples + cruzados) para el barrido de borrado. */
const TODOS_LOS_FACTORES: readonly (FactorPatron | FactorCruce)[] = [
  "amanecer_alto",
  "franja_problematica",
  "tendencia_semanal",
  "hipos_recurrentes",
  "sueno_vs_amanecer",
  "estres_vs_glucemia",
];

/**
 * Lee lecturas numéricas del usuario de los últimos 14 días para un `tipo` de
 * evento (por defecto glucemia; paso 8 lo reusa para sueño y estrés). RLS
 * aplicado + filtro explícito por usuario_id como defensa en profundidad. Las
 * filas sin valor numérico se excluyen (ej. sueño sin horas). Devuelve [] ante
 * error.
 */
export async function leerLecturas14d(
  supabase: SupabaseSesion,
  userId: string,
  ahora: Date,
  tipo = "glucemia"
): Promise<Lectura[]> {
  const desde = new Date(ahora.getTime() - VENTANA_DIAS * MS_DIA).toISOString();

  const { data, error } = await supabase
    .from("evento")
    .select("valor_num, ocurrido_en")
    .eq("tipo", tipo)
    .eq("usuario_id", userId) // defensa en profundidad + intención explícita
    .not("valor_num", "is", null)
    .gte("ocurrido_en", desde)
    .order("ocurrido_en", { ascending: false })
    .limit(500);

  if (error || !data) return [];

  const lecturas: Lectura[] = [];
  for (const e of data) {
    if (e.valor_num === null) continue;
    lecturas.push({ valor: e.valor_num, fecha: new Date(e.ocurrido_en) });
  }
  return lecturas;
}

/**
 * Sincroniza los patrones vigentes del usuario: upsert de los activos y borrado
 * de los que ya no aplican. Idempotente por (usuario_id, factor). El insert y el
 * delete pasan por RLS (patron_insert_own / patron_update_own / patron_delete_own),
 * así que es estructuralmente imposible tocar los patrones de otro usuario.
 */
export async function sincronizarPatrones(
  supabase: SupabaseSesion,
  userId: string,
  patrones: Array<Patron | PatronCruzado>
): Promise<void> {
  try {
    const activos = new Set(patrones.map((p) => p.factor));
    const ahoraIso = new Date().toISOString();

    if (patrones.length > 0) {
      const filas = patrones.map((p) => {
        // Serialización honesta del detalle tipado a Json (sin `any`).
        const detalle: Json = JSON.parse(JSON.stringify(p.detalle));
        return {
          usuario_id: userId,
          factor: p.factor,
          efecto_estimado: p.efectoEstimado,
          n_observaciones: p.nObservaciones,
          confianza: p.confianza,
          detalle,
          actualizado_en: ahoraIso,
        };
      });
      const { error } = await supabase
        .from("patron")
        .upsert(filas, { onConflict: "usuario_id,factor" });
      if (error) throw error;
    }

    const inactivos = TODOS_LOS_FACTORES.filter((f) => !activos.has(f));
    if (inactivos.length > 0) {
      const { error } = await supabase
        .from("patron")
        .delete()
        .eq("usuario_id", userId)
        .in("factor", inactivos);
      if (error) throw error;
    }
  } catch (error) {
    console.error("[patrones] error sincronizando:", error);
  }
}

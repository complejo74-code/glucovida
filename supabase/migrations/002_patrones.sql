-- ============================================================
-- GlucoVida — Migración 002: Patrones temporales v0 (paso 6)
-- ============================================================
-- Detección determinística de patrones sobre las glucemias del
-- usuario. Una fila por (usuario_id, factor); se recalcula (upsert)
-- al procesar cada mensaje. RLS espejo de `evento`: cada usuario solo
-- ve y toca SUS propios patrones. Los patrones de un usuario jamás
-- llegan a otro.

CREATE TABLE IF NOT EXISTS public.patron (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Nombre del patrón detectado:
  -- 'amanecer_alto' | 'franja_problematica' | 'tendencia_semanal' | 'hipos_recurrentes'
  factor          text        NOT NULL,
  -- Magnitud del efecto (la unidad depende del factor: mg/dL de diferencia,
  -- promedio de la franja, o cantidad de hipos).
  efecto_estimado numeric,
  -- Cuántas lecturas respaldan el patrón (rigor: factor 41).
  n_observaciones integer     NOT NULL,
  -- Robustez por tamaño de muestra, en [0,1]. Proxy v0, NO es un p-value.
  confianza       numeric     NOT NULL,
  -- Detalle legible para la capa de comunicación (franja, dirección, promedios…).
  detalle         jsonb,
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  -- Un patrón de cada tipo por usuario → el recálculo es un upsert idempotente.
  -- El índice de este UNIQUE (usuario_id, factor) también sirve las lecturas
  -- por usuario_id (prefijo izquierdo); no hace falta un índice extra.
  UNIQUE (usuario_id, factor)
);

-- ============================================================
-- ROW LEVEL SECURITY — espejo de `evento`, con update/delete
-- (upsert al recalcular, delete de patrones que dejaron de aplicar).
-- ============================================================

ALTER TABLE public.patron ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patron_select_own"
  ON public.patron FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "patron_insert_own"
  ON public.patron FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "patron_update_own"
  ON public.patron FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "patron_delete_own"
  ON public.patron FOR DELETE
  USING (auth.uid() = usuario_id);

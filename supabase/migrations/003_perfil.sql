-- ============================================================
-- GlucoVida — Migración 003: Perfil y onboarding (paso 9)
-- ============================================================
-- Amplía `usuario` con el contexto que personaliza a los subagentes y crea
-- `insulina_usuario`. Idempotente y NO destructiva: no borra datos ni columnas
-- existentes. El RLS de `usuario` (auth.uid() = id) ya cubre las columnas nuevas.

-- ── 1. Ampliar `usuario` ────────────────────────────────────────────────────

ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS anio_nacimiento     int;
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS menstrua            boolean;      -- nullable: cubre "prefiero no decir"
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS onboarding_completo boolean NOT NULL DEFAULT false;

-- Ampliar el CHECK de tipo_diabetes para incluir 'otro' (drop + recreate; los
-- datos existentes siguen siendo válidos porque el conjunto solo se agranda).
ALTER TABLE public.usuario DROP CONSTRAINT IF EXISTS usuario_tipo_diabetes_check;
ALTER TABLE public.usuario ADD CONSTRAINT usuario_tipo_diabetes_check
  CHECK (tipo_diabetes IN ('DM1','DM2','LADA','DMG','prediabetes','otro'));

-- Sanidad del año de nacimiento (nullable siempre permitido).
ALTER TABLE public.usuario DROP CONSTRAINT IF EXISTS usuario_anio_nacimiento_check;
ALTER TABLE public.usuario ADD CONSTRAINT usuario_anio_nacimiento_check
  CHECK (anio_nacimiento IS NULL OR anio_nacimiento BETWEEN 1900 AND 2026);

-- ── 2. Tabla `insulina_usuario` ─────────────────────────────────────────────
-- Un usuario puede tener varias. `activa` permite "desactivar" sin borrar
-- historial. `marca` es nullable (puede no saberla).

CREATE TABLE IF NOT EXISTS public.insulina_usuario (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clase      text        NOT NULL CHECK (clase IN ('rapida','basal','lenta','mixta')),
  marca      text,
  activa     boolean     NOT NULL DEFAULT true,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insulina_usuario
  ON public.insulina_usuario (usuario_id);

-- ── 3. Row Level Security en `insulina_usuario` ─────────────────────────────
-- Dato sensible de salud: cada usuario ve y maneja SOLO lo suyo. Necesita las
-- 4 operaciones porque el perfil editable agrega (INSERT), desactiva (UPDATE) y
-- borra (DELETE) insulinas. Mismo criterio que `patron`. Nada usa service_role.

ALTER TABLE public.insulina_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insulina_select_own" ON public.insulina_usuario;
CREATE POLICY "insulina_select_own"
  ON public.insulina_usuario FOR SELECT
  USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "insulina_insert_own" ON public.insulina_usuario;
CREATE POLICY "insulina_insert_own"
  ON public.insulina_usuario FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "insulina_update_own" ON public.insulina_usuario;
CREATE POLICY "insulina_update_own"
  ON public.insulina_usuario FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "insulina_delete_own" ON public.insulina_usuario;
CREATE POLICY "insulina_delete_own"
  ON public.insulina_usuario FOR DELETE
  USING (auth.uid() = usuario_id);

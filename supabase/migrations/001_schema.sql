-- ============================================================
-- GlucoVida — Migración 001: Esquema base
-- ============================================================

-- Tabla: usuario
CREATE TABLE IF NOT EXISTS public.usuario (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_diabetes text        CHECK (tipo_diabetes IN ('DM1','DM2','LADA','DMG','prediabetes')),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Tabla: evento
CREATE TABLE IF NOT EXISTS public.evento (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo         text        NOT NULL,
  valor_num    numeric,
  valor_texto  text,
  metadatos    jsonb,
  ocurrido_en  timestamptz NOT NULL DEFAULT now(),
  creado_en    timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas por usuario ordenadas por tiempo
CREATE INDEX IF NOT EXISTS idx_evento_usuario_tiempo
  ON public.evento (usuario_id, ocurrido_en DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento  ENABLE ROW LEVEL SECURITY;

-- Políticas para usuario
CREATE POLICY "usuario_select_own"
  ON public.usuario FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "usuario_insert_own"
  ON public.usuario FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "usuario_update_own"
  ON public.usuario FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Políticas para evento
CREATE POLICY "evento_select_own"
  ON public.evento FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "evento_insert_own"
  ON public.evento FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

-- ============================================================
-- TRIGGER: auto-crear fila en usuario al registrarse
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuario (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

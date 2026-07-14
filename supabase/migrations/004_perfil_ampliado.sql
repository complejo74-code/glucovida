-- ============================================================
-- GlucoVida — Migración 004: Perfil ampliado (paso 9.5)
-- ============================================================
-- Suma a `usuario` el contexto que afina el TONO de los subagentes: nombre,
-- sexo, peso y altura. Idempotente y NO destructiva: no borra datos ni columnas
-- (la columna `menstrua` de la 003 se conserva aunque el onboarding ya no la
-- pregunte). El RLS de `usuario` (auth.uid() = id) ya cubre las columnas nuevas,
-- igual que en la 003: no se toca ninguna policy.

-- ── 1. Nuevas columnas en `usuario` ─────────────────────────────────────────
-- `nombre` es requerido en la UI del onboarding, pero en la DB queda NULLABLE:
-- agregarlo NOT NULL sobre una tabla con filas existentes rompería la no-
-- destructividad. La obligatoriedad se hace en el onboarding, no en el esquema.

ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS nombre    text;
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS sexo      text;
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS peso_kg   numeric;
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS altura_cm int;

-- Sexo: conjunto cerrado. NULL = no respondió; 'prefiero_no_decir' = eligió no
-- decir (semánticamente distinto, ambos válidos).
ALTER TABLE public.usuario DROP CONSTRAINT IF EXISTS usuario_sexo_check;
ALTER TABLE public.usuario ADD CONSTRAINT usuario_sexo_check
  CHECK (sexo IS NULL OR sexo IN ('masculino','femenino','prefiero_no_decir'));

-- Sanidad de peso/altura (nullable siempre permitido). Rangos amplios: filtran
-- basura evidente sin juzgar ni excluir cuerpos reales.
ALTER TABLE public.usuario DROP CONSTRAINT IF EXISTS usuario_peso_kg_check;
ALTER TABLE public.usuario ADD CONSTRAINT usuario_peso_kg_check
  CHECK (peso_kg IS NULL OR (peso_kg >= 20 AND peso_kg <= 400));

ALTER TABLE public.usuario DROP CONSTRAINT IF EXISTS usuario_altura_cm_check;
ALTER TABLE public.usuario ADD CONSTRAINT usuario_altura_cm_check
  CHECK (altura_cm IS NULL OR (altura_cm >= 50 AND altura_cm <= 250));

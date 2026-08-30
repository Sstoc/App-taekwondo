-- ==============================================================================
-- TAEKWONDO CHANG MOO KWAN - AGREGAR COLUMNAS NUEVAS SIN TOCAR TUS DATOS
-- ==============================================================================
-- Este script NO borra alumnos, NO borra pagos, NO borra asistencias ni tablas.
-- Únicamente AGREGA las columnas nuevas si todavía no existen.

-- 1. Agregar campos nuevos a la tabla de alumnos si faltan
ALTER TABLE public.tkd_students ADD COLUMN IF NOT EXISTS dni TEXT;
ALTER TABLE public.tkd_students ADD COLUMN IF NOT EXISTS cuota_fija BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tkd_students ADD COLUMN IF NOT EXISTS exam_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tkd_students ADD COLUMN IF NOT EXISTS exam_paid_amount NUMERIC DEFAULT 0;
ALTER TABLE public.tkd_students ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- 2. Agregar campos nuevos a la tabla de configuración si faltan
ALTER TABLE public.tkd_settings ADD COLUMN IF NOT EXISTS exam_tiers JSONB DEFAULT '{"amarillos": 12000, "azules": 15000, "rojos": 18000, "negros": 25000}'::jsonb;
ALTER TABLE public.tkd_settings ADD COLUMN IF NOT EXISTS schedules JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tkd_settings ADD COLUMN IF NOT EXISTS debt_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tkd_settings ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tkd_settings ADD COLUMN IF NOT EXISTS price_tiers JSONB DEFAULT '{"tier1": 12500, "tier2": 15000, "tier3": 18000, "lastApplied": 1}'::jsonb;

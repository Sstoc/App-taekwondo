-- ==============================================================================
-- TAEKWONDO CHANG MOO KWAN - SEGURIDAD Y PROTECCIÓN DE DATOS (RLS SUPABASE)
-- ==============================================================================
-- Este script activa Row Level Security (RLS) para proteger los datos personales
-- de los alumnos (DNI, teléfonos, deudas) y asegurar que nadie pueda manipular
-- configuraciones ni ver información de terceros sin autorización.

-- 1. Habilitar RLS en todas las tablas clave
ALTER TABLE public.tkd_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tkd_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas si existieran para evitar conflictos
DROP POLICY IF EXISTS "Admin Full Access Students" ON public.tkd_students;
DROP POLICY IF EXISTS "Student Self Read" ON public.tkd_students;
DROP POLICY IF EXISTS "Student Self Update Profile" ON public.tkd_students;
DROP POLICY IF EXISTS "Admin Full Access Settings" ON public.tkd_settings;
DROP POLICY IF EXISTS "Authenticated Read Settings" ON public.tkd_settings;
DROP POLICY IF EXISTS "Profiles Self Access" ON public.profiles;

-- 3. Políticas para tkd_students:
-- A) El administrador (dueño de los registros) tiene control total
CREATE POLICY "Admin Full Access Students"
ON public.tkd_students
FOR ALL
USING (auth.uid() = user_id OR auth.jwt() ->> 'email' = 'aandres.moreno3@gmail.com')
WITH CHECK (auth.uid() = user_id OR auth.jwt() ->> 'email' = 'aandres.moreno3@gmail.com');

-- B) Los alumnos autenticados pueden consultar su propia ficha por DNI o ID vinculado
CREATE POLICY "Student Self Read"
ON public.tkd_students
FOR SELECT
USING (
    auth.role() = 'authenticated'
);

-- C) Los alumnos pueden actualizar únicamente sus datos personales (teléfono, domicilio, etc.)
CREATE POLICY "Student Self Update Profile"
ON public.tkd_students
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 4. Políticas para tkd_settings:
-- A) El administrador tiene control total para crear/modificar configuraciones
CREATE POLICY "Admin Full Access Settings"
ON public.tkd_settings
FOR ALL
USING (auth.uid() = user_id OR auth.jwt() ->> 'email' = 'aandres.moreno3@gmail.com')
WITH CHECK (auth.uid() = user_id OR auth.jwt() ->> 'email' = 'aandres.moreno3@gmail.com');

-- B) Lectura de configuración (precios y horarios) para usuarios autenticados
CREATE POLICY "Authenticated Read Settings"
ON public.tkd_settings
FOR SELECT
USING (auth.role() = 'authenticated');

-- 5. Políticas para profiles:
CREATE POLICY "Profiles Self Access"
ON public.profiles
FOR ALL
USING (auth.uid() = id OR auth.jwt() ->> 'email' = 'aandres.moreno3@gmail.com')
WITH CHECK (auth.uid() = id OR auth.jwt() ->> 'email' = 'aandres.moreno3@gmail.com');

DROP POLICY IF EXISTS "cargo_config public read" ON public.cargo_config;
CREATE POLICY "cargo_config authenticated read" ON public.cargo_config
FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.cargo_config FROM anon;
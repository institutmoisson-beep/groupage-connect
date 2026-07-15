-- Allow payment proofs for sourcing orders too
ALTER TABLE public.payment_proofs ADD COLUMN IF NOT EXISTS sourcing_order_id UUID REFERENCES public.custom_sourcing_orders(id) ON DELETE CASCADE;
ALTER TABLE public.payment_proofs ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE public.payment_proofs ADD CONSTRAINT payment_proofs_target_chk CHECK ((order_id IS NOT NULL) OR (sourcing_order_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_payment_proofs_sourcing ON public.payment_proofs(sourcing_order_id);

-- Cargo tracking: China warehouse instructions (single row config)
CREATE TABLE IF NOT EXISTS public.cargo_config (
  id INT PRIMARY KEY DEFAULT 1,
  china_warehouse_address TEXT NOT NULL DEFAULT '',
  china_warehouse_contact TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cargo_config_single CHECK (id = 1)
);
INSERT INTO public.cargo_config(id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.cargo_config TO anon, authenticated;
GRANT ALL ON public.cargo_config TO service_role;
ALTER TABLE public.cargo_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cargo_config public read" ON public.cargo_config FOR SELECT USING (true);
CREATE POLICY "cargo_config admin write" ON public.cargo_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- QC approval on sourcing orders
ALTER TABLE public.custom_sourcing_orders ADD COLUMN IF NOT EXISTS qc_approved_at TIMESTAMPTZ;
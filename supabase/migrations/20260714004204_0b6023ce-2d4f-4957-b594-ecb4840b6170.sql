-- Add FK relationships from user-scoped tables to public.profiles so PostgREST
-- can embed the profile (full_name, phone) in admin queries.
-- Safe because profiles.id = auth.users.id (1:1 via handle_new_user trigger).

-- Backfill any missing profile rows for existing users to avoid FK violations
INSERT INTO public.profiles (id, full_name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.custom_sourcing_orders
  ADD CONSTRAINT custom_sourcing_orders_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.payment_proofs
  ADD CONSTRAINT payment_proofs_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Performance: indexes on the hot admin filters
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_created_at ON public.custom_sourcing_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sourcing_status ON public.custom_sourcing_orders (status);
CREATE INDEX IF NOT EXISTS idx_sourcing_user_id ON public.custom_sourcing_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_proofs_status ON public.payment_proofs (status);
CREATE INDEX IF NOT EXISTS idx_proofs_user_id ON public.payment_proofs (user_id);
CREATE INDEX IF NOT EXISTS idx_proofs_order_id ON public.payment_proofs (order_id);
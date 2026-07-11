
-- 1. Terms acceptance on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text;

-- 2. Payment fields on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_url text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_meta jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_key
  ON public.orders(payment_reference)
  WHERE payment_reference IS NOT NULL;

-- 3. Grant admin role to Celvus (idempotent, requires the user to have signed up already)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'picelvus@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Also auto-promote picelvus@gmail.com on future signup (safety net)
CREATE OR REPLACE FUNCTION public.auto_promote_celvus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'picelvus@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_promote_celvus ON auth.users;
CREATE TRIGGER on_auth_user_created_promote_celvus
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_promote_celvus();

-- 4. Admin policies
-- profiles
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- products
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- groupage_campaigns
DROP POLICY IF EXISTS "Admins manage campaigns" ON public.groupage_campaigns;
CREATE POLICY "Admins manage campaigns" ON public.groupage_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- campaign_products
DROP POLICY IF EXISTS "Admins manage campaign_products" ON public.campaign_products;
CREATE POLICY "Admins manage campaign_products" ON public.campaign_products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- commissions
DROP POLICY IF EXISTS "Admins manage commissions" ON public.commissions;
CREATE POLICY "Admins manage commissions" ON public.commissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- orders: admin delete + already have admin view/update from earlier
DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
CREATE POLICY "Admins delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- user_roles: admin full manage + users read own
DROP POLICY IF EXISTS "Admins manage user_roles" ON public.user_roles;
CREATE POLICY "Admins manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

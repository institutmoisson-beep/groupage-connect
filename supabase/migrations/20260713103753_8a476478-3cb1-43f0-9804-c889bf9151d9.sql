
-- ============== payment_methods ==============
CREATE TYPE public.payment_method_type AS ENUM ('mobile_money','crypto','bank','cash','other');

CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.payment_method_type NOT NULL,
  name TEXT NOT NULL,
  account_identifier TEXT,
  account_holder TEXT,
  instructions TEXT,
  logo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_methods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active methods" ON public.payment_methods FOR SELECT USING (active = TRUE OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage methods" ON public.payment_methods FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_payment_methods_updated BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== payment_proofs ==============
CREATE TYPE public.payment_proof_status AS ENUM ('pending','verified','rejected');

CREATE TABLE public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  reference TEXT,
  amount_xof NUMERIC NOT NULL,
  screenshot_url TEXT,
  note TEXT,
  status public.payment_proof_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_proofs TO authenticated;
GRANT ALL ON public.payment_proofs TO service_role;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user read own proofs" ON public.payment_proofs FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user insert own proofs" ON public.payment_proofs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user update own pending" ON public.payment_proofs FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status = 'pending') WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin manage proofs" ON public.payment_proofs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_payment_proofs_updated BEFORE UPDATE ON public.payment_proofs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When admin verifies a proof, mark the order paid_confirmed
CREATE OR REPLACE FUNCTION public.handle_proof_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'verified' AND (OLD.status IS DISTINCT FROM 'verified') THEN
    UPDATE public.orders
       SET payment_status = 'paid',
           status = 'paid_confirmed',
           payment_provider = COALESCE(payment_provider, 'manual'),
           payment_reference = COALESCE(payment_reference, NEW.reference)
     WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_payment_proof_verified AFTER UPDATE ON public.payment_proofs FOR EACH ROW EXECUTE FUNCTION public.handle_proof_verified();

-- ============== custom sourcing ==============
CREATE TYPE public.sourcing_status AS ENUM ('quote_pending','quoted','paid','ordered_china','qc','shipped','transit','abidjan','delivered','cancelled');

CREATE TABLE public.custom_sourcing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_url TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant TEXT,
  cny_unit_price NUMERIC,
  quantity INT NOT NULL DEFAULT 1,
  exchange_rate_cny_xof NUMERIC NOT NULL DEFAULT 85,
  logistics_fee_xof NUMERIC NOT NULL DEFAULT 0,
  msn_commission_rate NUMERIC NOT NULL DEFAULT 0.07,
  msn_commission_xof NUMERIC,
  estimated_total_xof NUMERIC,
  final_total_xof NUMERIC,
  shipping_type TEXT NOT NULL DEFAULT 'sea',
  status public.sourcing_status NOT NULL DEFAULT 'quote_pending',
  qc_images TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_sourcing_orders TO authenticated;
GRANT ALL ON public.custom_sourcing_orders TO service_role;
ALTER TABLE public.custom_sourcing_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user read own sourcing" ON public.custom_sourcing_orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user insert own sourcing" ON public.custom_sourcing_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user update own pending sourcing" ON public.custom_sourcing_orders FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status IN ('quote_pending','quoted')) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin manage sourcing" ON public.custom_sourcing_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_sourcing_updated BEFORE UPDATE ON public.custom_sourcing_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- MLM commissions on delivered sourcing (rule of 10 handled in app for withdrawals)
CREATE OR REPLACE FUNCTION public.handle_sourcing_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_referrer UUID;
  level INT := 1;
  rates NUMERIC[] := ARRAY[0.01, 0.02, 0.025];
  commission_base NUMERIC;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    commission_base := COALESCE(NEW.msn_commission_xof, NEW.final_total_xof * NEW.msn_commission_rate, 0);
    SELECT referred_by INTO current_referrer FROM public.profiles WHERE id = NEW.user_id;
    WHILE current_referrer IS NOT NULL AND level <= 3 LOOP
      INSERT INTO public.commissions (referrer_id, buyer_id, order_id, amount_xof, level)
      VALUES (current_referrer, NEW.user_id, NULL, ROUND(commission_base * rates[level], 2), level);
      -- increment delivered referrals count
      UPDATE public.profiles SET delivered_referrals_count = COALESCE(delivered_referrals_count,0) + 1 WHERE id = current_referrer AND level = 1;
      SELECT referred_by INTO current_referrer FROM public.profiles WHERE id = current_referrer;
      level := level + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sourcing_delivered AFTER UPDATE ON public.custom_sourcing_orders FOR EACH ROW EXECUTE FUNCTION public.handle_sourcing_delivered();

-- Profiles: add referral counters
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS delivered_referrals_count INT NOT NULL DEFAULT 0;

-- Allow commissions.order_id nullable (for sourcing)
ALTER TABLE public.commissions ALTER COLUMN order_id DROP NOT NULL;

-- Seed a couple of example payment methods (admin can edit/remove)
INSERT INTO public.payment_methods (type, name, account_identifier, account_holder, instructions, sort_order) VALUES
  ('mobile_money','Wave','+225 07 00 00 00 00','MSN Courtier','Envoyez le montant exact via Wave puis uploadez la capture.',1),
  ('mobile_money','Orange Money','+225 07 00 00 00 00','MSN Courtier','Composez #144# et envoyez au numéro ci-dessus.',2),
  ('crypto','USDT (TRC20)','TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','MSN Courtier','Envoyez uniquement en TRC20. Frais réseau à votre charge.',3);

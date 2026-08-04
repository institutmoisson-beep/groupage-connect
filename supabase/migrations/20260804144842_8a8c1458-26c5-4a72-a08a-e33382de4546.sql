-- ============ ENUMS ============
CREATE TYPE public.stock_product_status AS ENUM ('pending_review','active','sold_out','hidden','rejected');
CREATE TYPE public.stock_order_status AS ENUM ('pending','dispatched','delivered','cancelled');
CREATE TYPE public.wallet_tx_type AS ENUM ('wholesale_credit','commission_credit','delivery_fee','withdrawal_debit','adjustment');
CREATE TYPE public.withdrawal_method AS ENUM ('wave','orange_money','mtn_money','moov_money','bank_transfer');
CREATE TYPE public.withdrawal_status AS ENUM ('pending','approved','paid','rejected');

-- ============ PRODUITS ============
CREATE TABLE public.stock_express_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  container_tracking_number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  storage_location TEXT,
  wholesale_price NUMERIC NOT NULL DEFAULT 0,
  suggested_price NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  media_kit_text TEXT,
  status public.stock_product_status NOT NULL DEFAULT 'pending_review',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_express_products TO authenticated;
GRANT ALL ON public.stock_express_products TO service_role;
ALTER TABLE public.stock_express_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalogue visible par les membres connectes"
  ON public.stock_express_products FOR SELECT TO authenticated
  USING (status = 'active' OR importer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Importateur cree ses annonces"
  ON public.stock_express_products FOR INSERT TO authenticated
  WITH CHECK (importer_id = auth.uid());

CREATE POLICY "Importateur ou admin modifie l annonce"
  ON public.stock_express_products FOR UPDATE TO authenticated
  USING (importer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (importer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Importateur ou admin supprime l annonce"
  ON public.stock_express_products FOR DELETE TO authenticated
  USING (importer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_stock_products_status ON public.stock_express_products (status, created_at DESC);
CREATE INDEX idx_stock_products_importer ON public.stock_express_products (importer_id);

-- ============ COMMANDES ============
CREATE TABLE public.stock_express_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.stock_express_products(id) ON DELETE CASCADE,
  reseller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_phone_alt TEXT,
  delivery_address TEXT NOT NULL,
  city_district TEXT NOT NULL,
  delivery_date DATE,
  final_price NUMERIC NOT NULL,
  commission_earned NUMERIC NOT NULL DEFAULT 0,
  wholesale_total NUMERIC NOT NULL DEFAULT 0,
  delivery_fee_xof NUMERIC NOT NULL DEFAULT 0,
  status public.stock_order_status NOT NULL DEFAULT 'pending',
  driver_name TEXT,
  driver_contact TEXT,
  delivered_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.stock_express_orders TO authenticated;
GRANT ALL ON public.stock_express_orders TO service_role;
ALTER TABLE public.stock_express_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Revendeur importateur ou admin lit la commande"
  ON public.stock_express_orders FOR SELECT TO authenticated
  USING (
    reseller_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.stock_express_products p WHERE p.id = product_id AND p.importer_id = auth.uid())
  );

CREATE POLICY "Revendeur cree sa commande client"
  ON public.stock_express_orders FOR INSERT TO authenticated
  WITH CHECK (reseller_id = auth.uid());

CREATE POLICY "Admin met a jour la commande"
  ON public.stock_express_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_stock_orders_reseller ON public.stock_express_orders (reseller_id, created_at DESC);
CREATE INDEX idx_stock_orders_status ON public.stock_express_orders (status, created_at DESC);

-- ============ PORTEFEUILLE ============
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_xof NUMERIC NOT NULL,
  type public.wallet_tx_type NOT NULL,
  label TEXT NOT NULL,
  stock_order_id UUID REFERENCES public.stock_express_orders(id) ON DELETE SET NULL,
  withdrawal_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chacun lit son portefeuille"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_wallet_tx_user ON public.wallet_transactions (user_id, created_at DESC);

-- ============ RETRAITS ============
CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_xof NUMERIC NOT NULL,
  method public.withdrawal_method NOT NULL,
  account_identifier TEXT NOT NULL,
  account_holder TEXT,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chacun lit ses retraits"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Chacun demande un retrait"
  ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin traite les retraits"
  ON public.withdrawal_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_withdrawals_user ON public.withdrawal_requests (user_id, created_at DESC);

-- ============ TRIGGERS ============
CREATE TRIGGER trg_stock_products_updated_at BEFORE UPDATE ON public.stock_express_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_stock_orders_updated_at BEFORE UPDATE ON public.stock_express_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_withdrawals_updated_at BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Répartition automatique des fonds à la livraison + décrément du stock
CREATE OR REPLACE FUNCTION public.handle_stock_order_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_importer UUID;
  v_title TEXT;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    SELECT importer_id, title INTO v_importer, v_title
      FROM public.stock_express_products WHERE id = NEW.product_id;

    IF NEW.wholesale_total > 0 AND v_importer IS NOT NULL THEN
      INSERT INTO public.wallet_transactions (user_id, amount_xof, type, label, stock_order_id)
      VALUES (v_importer, NEW.wholesale_total, 'wholesale_credit',
              'Vente Stock Express — ' || COALESCE(v_title, 'produit'), NEW.id);
    END IF;

    IF NEW.commission_earned > 0 THEN
      INSERT INTO public.wallet_transactions (user_id, amount_xof, type, label, stock_order_id)
      VALUES (NEW.reseller_id, NEW.commission_earned, 'commission_credit',
              'Commission Stock Express — ' || COALESCE(v_title, 'produit'), NEW.id);
    END IF;

    NEW.delivered_at := COALESCE(NEW.delivered_at, now());

    UPDATE public.stock_express_products
       SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity),
           status = CASE WHEN GREATEST(0, stock_quantity - NEW.quantity) = 0 THEN 'sold_out'::public.stock_product_status ELSE status END
     WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_order_delivered BEFORE UPDATE ON public.stock_express_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_stock_order_delivered();

-- Notification revendeur à chaque changement de statut
CREATE OR REPLACE FUNCTION public.notify_stock_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_msg := CASE NEW.status
      WHEN 'dispatched' THEN 'Votre commande client est en cours de livraison.'
      WHEN 'delivered' THEN 'Livré & Payé ! Votre commission de ' || ROUND(NEW.commission_earned) || ' FCFA a été créditée.'
      WHEN 'cancelled' THEN 'Votre commande client a été annulée.'
      ELSE 'Statut de votre commande mis à jour.'
    END;
    INSERT INTO public.user_notifications (user_id, title, body, link)
    VALUES (NEW.reseller_id, 'MSN Stock Express — ' || NEW.client_name, v_msg, '/stock/orders');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_stock_order_status AFTER UPDATE ON public.stock_express_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_stock_order_status();
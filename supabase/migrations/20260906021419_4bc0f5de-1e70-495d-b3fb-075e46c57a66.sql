-- ============ 1. LIVRAISON VIDA : ASSIGNATION D'UN LIVREUR ============

CREATE TYPE public.staff_module AS ENUM (
  'users','products','campaigns','orders','hotels','hotel_bookings','payment_methods',
  'payment_proofs','sourcing','messages','cargo','stock','onfaisimple',
  'vida_orders','vida_delivery','vida_products','wallets','withdrawals','commissions','logistics'
);

CREATE TABLE public.staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module public.staff_module NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module)
);

GRANT SELECT ON public.staff_assignments TO authenticated;
GRANT ALL ON public.staff_assignments TO service_role;

ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chacun voit ses modules confiés" ON public.staff_assignments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins gèrent les délégations" ON public.staff_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER staff_assignments_touch
  BEFORE UPDATE ON public.staff_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_staff_module(_user_id uuid, _module public.staff_module)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_assignments
    WHERE user_id = _user_id AND module = _module AND is_active = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_staff_module(uuid, public.staff_module) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_staff_module(uuid, public.staff_module) TO authenticated, service_role;

-- Raccourci : admin OU gestionnaire délégué du module
CREATE OR REPLACE FUNCTION public.can_manage_module(_module public.staff_module)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_staff_module(auth.uid(), _module);
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_module(public.staff_module) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_module(public.staff_module) TO authenticated, service_role;

-- ============ 2. DÉLÉGATION ADMIN ============

CREATE OR REPLACE FUNCTION public.admin_set_staff_module(
  p_user_id uuid,
  p_module public.staff_module,
  p_is_active boolean DEFAULT true,
  p_note text DEFAULT NULL
)
RETURNS public.staff_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.staff_assignments;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.';
  END IF;

  INSERT INTO public.staff_assignments (user_id, module, is_active, note)
  VALUES (p_user_id, p_module, p_is_active, p_note)
  ON CONFLICT (user_id, module)
  DO UPDATE SET is_active = EXCLUDED.is_active,
                note = COALESCE(EXCLUDED.note, public.staff_assignments.note),
                updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_staff_module(uuid, public.staff_module, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_staff_module(uuid, public.staff_module, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_staff_module(p_user_id uuid, p_module public.staff_module)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.';
  END IF;
  DELETE FROM public.staff_assignments WHERE user_id = p_user_id AND module = p_module;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_remove_staff_module(uuid, public.staff_module) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_staff_module(uuid, public.staff_module) TO authenticated;

-- Liste des délégations (admin) avec emails
CREATE OR REPLACE FUNCTION public.admin_list_staff_assignments()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  module public.staff_module,
  is_active boolean,
  note text,
  created_at timestamptz,
  full_name text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.';
  END IF;
  RETURN QUERY
  SELECT s.id, s.user_id, s.module, s.is_active, s.note, s.created_at,
         p.full_name, u.email::text
  FROM public.staff_assignments s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN auth.users u ON u.id = s.user_id
  ORDER BY s.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_staff_assignments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_staff_assignments() TO authenticated;

-- ============ 3. ASSIGNATION LIVREUR SUR COMMANDE VIDA ============

CREATE OR REPLACE FUNCTION public.vida_assign_courier(p_order_id uuid, p_courier_id uuid)
RETURNS public.vida_escrow_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order public.vida_escrow_orders;
BEGIN
  IF NOT public.can_manage_module('vida_delivery') THEN
    RAISE EXCEPTION 'Accès réservé à la gestion des livraisons ViDa.';
  END IF;

  IF p_courier_id IS NOT NULL AND NOT public.has_vida_role(p_courier_id, 'courier') THEN
    RAISE EXCEPTION 'Ce compte n''est pas un livreur ViDa approuvé.';
  END IF;

  UPDATE public.vida_escrow_orders
  SET courier_id = p_courier_id, updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;

  RETURN v_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vida_assign_courier(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vida_assign_courier(uuid, uuid) TO authenticated;

-- Le livreur signale la prise en charge du colis
CREATE OR REPLACE FUNCTION public.vida_courier_pickup(p_order_id uuid)
RETURNS public.vida_escrow_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order public.vida_escrow_orders;
BEGIN
  SELECT * INTO v_order FROM public.vida_escrow_orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;
  IF v_order.courier_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cette course ne vous est pas assignée.';
  END IF;
  IF v_order.status <> 'funds_locked' THEN
    RAISE EXCEPTION 'Les fonds doivent être verrouillés avant la prise en charge.';
  END IF;

  UPDATE public.vida_escrow_orders
  SET status = 'in_transit', updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vida_courier_pickup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vida_courier_pickup(uuid) TO authenticated;

-- Livreurs approuvés (pour le sélecteur admin)
CREATE OR REPLACE FUNCTION public.vida_list_couriers()
RETURNS TABLE (user_id uuid, full_name text, phone text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_module('vida_delivery') THEN
    RAISE EXCEPTION 'Accès réservé à la gestion des livraisons ViDa.';
  END IF;
  RETURN QUERY
  SELECT r.user_id, p.full_name, p.phone, u.email::text
  FROM public.vida_roles r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN auth.users u ON u.id = r.user_id
  WHERE r.role = 'courier' AND r.is_approved = true AND r.is_suspended = false
  ORDER BY p.full_name NULLS LAST;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vida_list_couriers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vida_list_couriers() TO authenticated;

-- Vue commandes ViDa pour la gestion des livraisons (admin ou délégué)
CREATE OR REPLACE FUNCTION public.vida_delivery_board()
RETURNS TABLE (
  id uuid,
  order_code varchar,
  product_title text,
  status public.vida_order_status,
  total_amount numeric,
  delivery_fee numeric,
  delivery_address text,
  delivery_phone text,
  courier_id uuid,
  courier_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_module('vida_delivery') THEN
    RAISE EXCEPTION 'Accès réservé à la gestion des livraisons ViDa.';
  END IF;
  RETURN QUERY
  SELECT o.id, o.order_code, pr.title, o.status, o.total_amount, o.delivery_fee,
         o.delivery_address, o.delivery_phone, o.courier_id, cp.full_name, o.created_at
  FROM public.vida_escrow_orders o
  LEFT JOIN public.vida_products pr ON pr.id = o.product_id
  LEFT JOIN public.profiles cp ON cp.id = o.courier_id
  ORDER BY o.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vida_delivery_board() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vida_delivery_board() TO authenticated;

-- ============ 4. ACCÈS RLS DES GESTIONNAIRES DÉLÉGUÉS ============

CREATE POLICY "Gestionnaires délégués gèrent les produits" ON public.products
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'products'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'products'));

CREATE POLICY "Gestionnaires délégués gèrent les campagnes" ON public.groupage_campaigns
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'campaigns'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'campaigns'));

CREATE POLICY "Gestionnaires délégués gèrent les commandes" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'orders'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'orders'));

CREATE POLICY "Gestionnaires délégués gèrent les preuves" ON public.payment_proofs
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'payment_proofs'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'payment_proofs'));

CREATE POLICY "Gestionnaires délégués gèrent le sourcing" ON public.custom_sourcing_orders
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'sourcing'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'sourcing'));

CREATE POLICY "Gestionnaires délégués gèrent le stock" ON public.stock_express_products
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'stock'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'stock'));

CREATE POLICY "Gestionnaires délégués suivent les ventes stock" ON public.stock_express_orders
  FOR SELECT TO authenticated
  USING (public.has_staff_module(auth.uid(), 'stock'));

CREATE POLICY "Gestionnaires délégués gèrent OnFaiSimple" ON public.onfaisimple_products
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'onfaisimple'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'onfaisimple'));

CREATE POLICY "Gestionnaires délégués suivent OnFaiSimple" ON public.onfaisimple_orders
  FOR SELECT TO authenticated
  USING (public.has_staff_module(auth.uid(), 'onfaisimple'));

CREATE POLICY "Gestionnaires délégués gèrent les hôtels" ON public.custom_hotels
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'hotels'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'hotels'));

CREATE POLICY "Gestionnaires délégués gèrent les chambres" ON public.custom_rooms
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'hotels'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'hotels'));

CREATE POLICY "Gestionnaires délégués gèrent les réservations" ON public.custom_hotel_bookings
  FOR SELECT TO authenticated
  USING (public.has_staff_module(auth.uid(), 'hotel_bookings'));

CREATE POLICY "Gestionnaires délégués gèrent les moyens de paiement" ON public.payment_methods
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'payment_methods'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'payment_methods'));

CREATE POLICY "Gestionnaires délégués suivent les retraits" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (public.has_staff_module(auth.uid(), 'withdrawals'));

CREATE POLICY "Gestionnaires délégués suivent les commissions" ON public.commissions
  FOR SELECT TO authenticated
  USING (public.has_staff_module(auth.uid(), 'commissions'));

CREATE POLICY "Gestionnaires délégués suivent les portefeuilles" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (public.has_staff_module(auth.uid(), 'wallets'));

CREATE POLICY "Gestionnaires délégués suivent les colis cargo" ON public.forwarding_packages
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'cargo'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'cargo'));

CREATE POLICY "Gestionnaires délégués suivent les commandes ViDa" ON public.vida_escrow_orders
  FOR SELECT TO authenticated
  USING (public.has_staff_module(auth.uid(), 'vida_orders') OR public.has_staff_module(auth.uid(), 'vida_delivery'));

CREATE POLICY "Gestionnaires délégués gèrent les produits ViDa" ON public.vida_products
  FOR ALL TO authenticated
  USING (public.has_staff_module(auth.uid(), 'vida_products'))
  WITH CHECK (public.has_staff_module(auth.uid(), 'vida_products'));
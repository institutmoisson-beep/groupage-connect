-- ============ ENUMS ============
CREATE TYPE public.onfaisimple_stage AS ENUM (
  'COMMANDE_VALIDEE','ACHAT_CHINE','ENTREPOT_CHINE','EN_TRANSIT','DEDOUANEMENT','EN_VENTE','GAIN_CLOTURE'
);
CREATE TYPE public.onfaisimple_product_status AS ENUM ('funding','closed','completed','hidden');
CREATE TYPE public.onfaisimple_payment_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.onfaisimple_channel_kind AS ENUM ('wallet','redirect','manual','crypto');

ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'onfaisimple_debit';
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'onfaisimple_payout';

-- ============ PRODUCTS ============
CREATE TABLE public.onfaisimple_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  unit_cost numeric NOT NULL CHECK (unit_cost > 0),
  projected_retail_price numeric NOT NULL CHECK (projected_retail_price > 0),
  user_profit_share_percent numeric NOT NULL DEFAULT 60.0 CHECK (user_profit_share_percent >= 0 AND user_profit_share_percent <= 100),
  total_units integer NOT NULL CHECK (total_units > 0),
  funded_units integer NOT NULL DEFAULT 0 CHECK (funded_units >= 0),
  min_units_per_order integer NOT NULL DEFAULT 1 CHECK (min_units_per_order > 0),
  estimated_days integer NOT NULL DEFAULT 35,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.onfaisimple_product_status NOT NULL DEFAULT 'funding',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.onfaisimple_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onfaisimple_products TO authenticated;
GRANT ALL ON public.onfaisimple_products TO service_role;
ALTER TABLE public.onfaisimple_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onfaisimple products public read" ON public.onfaisimple_products
  FOR SELECT TO anon USING (status <> 'hidden');
CREATE POLICY "onfaisimple products auth read" ON public.onfaisimple_products
  FOR SELECT TO authenticated USING (status <> 'hidden' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "onfaisimple products admin write" ON public.onfaisimple_products
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER onfaisimple_products_updated_at BEFORE UPDATE ON public.onfaisimple_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORDERS ============
CREATE TABLE public.onfaisimple_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.onfaisimple_products(id) ON DELETE RESTRICT,
  units_count integer NOT NULL CHECK (units_count > 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  expected_payout numeric NOT NULL CHECK (expected_payout >= 0),
  contract_reference text NOT NULL DEFAULT ('OFS-' || upper(substr(md5(random()::text), 1, 8))),
  contract_pdf_url text,
  signature_pin_verified boolean NOT NULL DEFAULT false,
  current_stage public.onfaisimple_stage NOT NULL DEFAULT 'COMMANDE_VALIDEE',
  payment_method text,
  payment_channel_label text,
  payment_reference text,
  payment_proof_url text,
  payment_status public.onfaisimple_payment_status NOT NULL DEFAULT 'pending',
  payout_credited_at timestamptz,
  cargo_tracking_code text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.onfaisimple_orders TO authenticated;
GRANT ALL ON public.onfaisimple_orders TO service_role;
ALTER TABLE public.onfaisimple_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onfaisimple orders own read" ON public.onfaisimple_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "onfaisimple orders own insert" ON public.onfaisimple_orders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "onfaisimple orders admin update" ON public.onfaisimple_orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER onfaisimple_orders_updated_at BEFORE UPDATE ON public.onfaisimple_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX onfaisimple_orders_user_idx ON public.onfaisimple_orders (user_id, created_at DESC);
CREATE INDEX onfaisimple_orders_product_idx ON public.onfaisimple_orders (product_id);

-- ============ STAGE EVENTS ============
CREATE TABLE public.onfaisimple_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.onfaisimple_orders(id) ON DELETE CASCADE,
  stage public.onfaisimple_stage NOT NULL,
  note text,
  photo_url text,
  tracking_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.onfaisimple_stage_events TO authenticated;
GRANT ALL ON public.onfaisimple_stage_events TO service_role;
ALTER TABLE public.onfaisimple_stage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onfaisimple stage events read" ON public.onfaisimple_stage_events
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.onfaisimple_orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );

-- ============ PAYMENT CHANNELS ============
CREATE TABLE public.onfaisimple_payment_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.onfaisimple_channel_kind NOT NULL,
  name text NOT NULL,
  account_identifier text,
  account_holder text,
  redirect_url text,
  crypto_network text,
  instructions text,
  logo_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.onfaisimple_payment_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onfaisimple_payment_channels TO authenticated;
GRANT ALL ON public.onfaisimple_payment_channels TO service_role;
ALTER TABLE public.onfaisimple_payment_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onfaisimple channels auth read" ON public.onfaisimple_payment_channels
  FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "onfaisimple channels admin write" ON public.onfaisimple_payment_channels
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER onfaisimple_channels_updated_at BEFORE UPDATE ON public.onfaisimple_payment_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER PINS ============
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.user_signature_pins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_signature_pins TO authenticated;
GRANT ALL ON public.user_signature_pins TO service_role;
ALTER TABLE public.user_signature_pins ENABLE ROW LEVEL SECURITY;
-- No direct read of hashes: only existence check through the helper function below.
CREATE POLICY "signature pin owner existence" ON public.user_signature_pins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER user_signature_pins_updated_at BEFORE UPDATE ON public.user_signature_pins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_signature_pin(p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;
  IF p_pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'Le code PIN doit contenir 4 chiffres.'; END IF;
  INSERT INTO public.user_signature_pins (user_id, pin_hash)
  VALUES (auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  ON CONFLICT (user_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, updated_at = now();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.set_signature_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_signature_pin(text) TO authenticated;

-- ============ ORDER CREATION ============
CREATE OR REPLACE FUNCTION public.onfaisimple_create_order(
  p_product_id uuid,
  p_units integer,
  p_pin text,
  p_payment_method text,
  p_channel_label text DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_payment_proof_url text DEFAULT NULL
)
RETURNS TABLE(order_id uuid, contract_reference text, payment_status public.onfaisimple_payment_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_p public.onfaisimple_products%ROWTYPE;
  v_hash text;
  v_total numeric;
  v_payout numeric;
  v_balance numeric;
  v_status public.onfaisimple_payment_status := 'pending';
  v_id uuid;
  v_ref text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentification requise.'; END IF;

  SELECT pin_hash INTO v_hash FROM public.user_signature_pins WHERE user_id = v_uid;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'Aucun code PIN enregistré. Créez votre code de signature.'; END IF;
  IF extensions.crypt(coalesce(p_pin, ''), v_hash) <> v_hash THEN
    RAISE EXCEPTION 'Code PIN incorrect.';
  END IF;

  SELECT * INTO v_p FROM public.onfaisimple_products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable.'; END IF;
  IF v_p.status <> 'funding' THEN RAISE EXCEPTION 'Ce lot n''est plus ouvert au financement.'; END IF;
  IF p_units IS NULL OR p_units < v_p.min_units_per_order THEN
    RAISE EXCEPTION 'Quantité minimale : % unité(s).', v_p.min_units_per_order;
  END IF;
  IF v_p.funded_units + p_units > v_p.total_units THEN
    RAISE EXCEPTION 'Il ne reste que % unité(s) disponibles.', v_p.total_units - v_p.funded_units;
  END IF;

  v_total := round(v_p.unit_cost * p_units);
  v_payout := round(v_total + (v_p.projected_retail_price - v_p.unit_cost) * p_units * v_p.user_profit_share_percent / 100.0);

  IF p_payment_method = 'wallet' THEN
    SELECT COALESCE(SUM(amount_xof), 0) INTO v_balance FROM public.wallet_transactions WHERE user_id = v_uid;
    IF v_balance < v_total THEN
      RAISE EXCEPTION 'Solde portefeuille insuffisant : % FCFA disponibles.', round(v_balance);
    END IF;
    v_status := 'approved';
  END IF;

  INSERT INTO public.onfaisimple_orders (
    user_id, product_id, units_count, total_amount, expected_payout,
    signature_pin_verified, payment_method, payment_channel_label,
    payment_reference, payment_proof_url, payment_status
  ) VALUES (
    v_uid, p_product_id, p_units, v_total, v_payout,
    true, p_payment_method, p_channel_label,
    p_payment_reference, p_payment_proof_url, v_status
  ) RETURNING id, onfaisimple_orders.contract_reference INTO v_id, v_ref;

  IF p_payment_method = 'wallet' THEN
    INSERT INTO public.wallet_transactions (user_id, amount_xof, type, label)
    VALUES (v_uid, -v_total, 'onfaisimple_debit',
            'OnFaiSimple — financement ' || v_p.title || ' (' || p_units || ' u.)');
  END IF;

  UPDATE public.onfaisimple_products
     SET funded_units = funded_units + p_units,
         status = CASE WHEN funded_units + p_units >= total_units THEN 'closed'::public.onfaisimple_product_status ELSE status END
   WHERE id = p_product_id;

  INSERT INTO public.onfaisimple_stage_events (order_id, stage, note)
  VALUES (v_id, 'COMMANDE_VALIDEE', 'Mandat signé et commande enregistrée.');

  INSERT INTO public.user_notifications (user_id, title, body, link)
  VALUES (v_uid, 'OnFaiSimple™ — ' || v_p.title,
          'Votre mandat ' || v_ref || ' est enregistré. Gain attendu : ' || round(v_payout) || ' FCFA.',
          '/onfaisimple/orders');

  RETURN QUERY SELECT v_id, v_ref, v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.onfaisimple_create_order(uuid, integer, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onfaisimple_create_order(uuid, integer, text, text, text, text, text) TO authenticated;

-- ============ ADMIN: REVIEW PAYMENT ============
CREATE OR REPLACE FUNCTION public.onfaisimple_review_payment(p_order_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS TABLE(payment_status public.onfaisimple_payment_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_o public.onfaisimple_orders%ROWTYPE;
  v_next public.onfaisimple_payment_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Accès réservé à l''administration.'; END IF;
  SELECT * INTO v_o FROM public.onfaisimple_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;

  IF p_action = 'approve' THEN v_next := 'approved';
  ELSIF p_action = 'reject' THEN v_next := 'rejected';
  ELSE RAISE EXCEPTION 'Action invalide.'; END IF;

  UPDATE public.onfaisimple_orders
     SET payment_status = v_next, admin_notes = COALESCE(p_note, admin_notes)
   WHERE id = p_order_id;

  IF v_next = 'rejected' AND v_o.payment_status <> 'rejected' THEN
    UPDATE public.onfaisimple_products
       SET funded_units = GREATEST(0, funded_units - v_o.units_count),
           status = CASE WHEN status = 'closed' THEN 'funding'::public.onfaisimple_product_status ELSE status END
     WHERE id = v_o.product_id;
  END IF;

  INSERT INTO public.user_notifications (user_id, title, body, link)
  VALUES (v_o.user_id, 'OnFaiSimple™ — paiement',
          CASE WHEN v_next = 'approved' THEN 'Paiement validé. Votre lot entre en production.'
               ELSE 'Paiement refusé. ' || COALESCE(p_note, '') END,
          '/onfaisimple/orders');

  RETURN QUERY SELECT v_next;
END;
$$;
REVOKE ALL ON FUNCTION public.onfaisimple_review_payment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onfaisimple_review_payment(uuid, text, text) TO authenticated;

-- ============ ADMIN: STAGE UPDATE ============
CREATE OR REPLACE FUNCTION public.onfaisimple_set_stage(
  p_order_id uuid,
  p_stage public.onfaisimple_stage,
  p_note text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_tracking_code text DEFAULT NULL
)
RETURNS TABLE(current_stage public.onfaisimple_stage)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_o public.onfaisimple_orders%ROWTYPE;
  v_title text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Accès réservé à l''administration.'; END IF;
  SELECT * INTO v_o FROM public.onfaisimple_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF v_o.payment_status <> 'approved' THEN RAISE EXCEPTION 'Le paiement doit être validé avant le suivi.'; END IF;

  SELECT title INTO v_title FROM public.onfaisimple_products WHERE id = v_o.product_id;

  UPDATE public.onfaisimple_orders
     SET current_stage = p_stage,
         cargo_tracking_code = COALESCE(p_tracking_code, cargo_tracking_code)
   WHERE id = p_order_id;

  INSERT INTO public.onfaisimple_stage_events (order_id, stage, note, photo_url, tracking_code)
  VALUES (p_order_id, p_stage, p_note, p_photo_url, p_tracking_code);

  IF p_stage = 'GAIN_CLOTURE' AND v_o.payout_credited_at IS NULL THEN
    INSERT INTO public.wallet_transactions (user_id, amount_xof, type, label)
    VALUES (v_o.user_id, v_o.expected_payout, 'onfaisimple_payout',
            'OnFaiSimple — capital + profit ' || COALESCE(v_title, 'lot') || ' (' || v_o.contract_reference || ')');
    UPDATE public.onfaisimple_orders SET payout_credited_at = now() WHERE id = p_order_id;
  END IF;

  INSERT INTO public.user_notifications (user_id, title, body, link)
  VALUES (v_o.user_id, 'OnFaiSimple™ — ' || COALESCE(v_title, 'suivi'),
          CASE p_stage
            WHEN 'ACHAT_CHINE' THEN 'Achat effectué en Chine.'
            WHEN 'ENTREPOT_CHINE' THEN 'Colis pesé à l''entrepôt MSN Chine.'
            WHEN 'EN_TRANSIT' THEN 'En transit vers Abidjan.'
            WHEN 'DEDOUANEMENT' THEN 'Arrivé en dédouanement à Abidjan.'
            WHEN 'EN_VENTE' THEN 'Mise en vente sur le réseau Stock Express.'
            WHEN 'GAIN_CLOTURE' THEN 'Lot vendu ! Capital + profit de ' || round(v_o.expected_payout) || ' FCFA crédités.'
            ELSE 'Suivi mis à jour.'
          END,
          '/onfaisimple/orders');

  RETURN QUERY SELECT p_stage;
END;
$$;
REVOKE ALL ON FUNCTION public.onfaisimple_set_stage(uuid, public.onfaisimple_stage, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onfaisimple_set_stage(uuid, public.onfaisimple_stage, text, text, text) TO authenticated;

-- ============ SEED PAYMENT CHANNELS ============
INSERT INTO public.onfaisimple_payment_channels (kind, name, account_identifier, account_holder, redirect_url, crypto_network, instructions, sort_order)
VALUES
  ('redirect', 'Wave', '+225 07 00 00 00 00', 'MSN Courtier', 'https://pay.wave.com/m/msn-courtier', NULL, 'Payez via l''application Wave puis revenez valider.', 1),
  ('redirect', 'Orange Money', '+225 07 00 00 00 01', 'MSN Courtier', 'https://qrcode.orange.ci/', NULL, 'Redirection vers Orange Money CI.', 2),
  ('redirect', 'MTN / Moov Money', '+225 05 00 00 00 02', 'MSN Courtier', 'https://mtn.ci/momo', NULL, 'Redirection vers MTN MoMo / Moov Money.', 3),
  ('manual', 'Transfert manuel Wave', '+225 07 00 00 00 00', 'MSN Courtier SARL', NULL, NULL, 'Envoyez le montant exact puis téléversez la capture du reçu.', 4),
  ('manual', 'Transfert manuel Orange Money', '+225 07 00 00 00 01', 'MSN Courtier SARL', NULL, NULL, 'Envoyez le montant exact puis téléversez la capture du reçu.', 5),
  ('crypto', 'USDT TRC20', 'TXMSNcourtierUSDTtrc20address0001', 'MSN Courtier', NULL, 'TRC20', 'Réseau Tron (TRC20) uniquement. Collez le hash de transaction après envoi.', 6),
  ('crypto', 'USDT BEP20', '0xMSNcourtierUSDTbep20address000001', 'MSN Courtier', NULL, 'BEP20', 'Réseau BNB Smart Chain (BEP20) uniquement. Collez le hash de transaction.', 7);

-- ============ SEED PRODUCTS ============
INSERT INTO public.onfaisimple_products (title, category, description, unit_cost, projected_retail_price, user_profit_share_percent, total_units, funded_units, min_units_per_order, estimated_days, status, images)
VALUES
  ('Écouteurs sans fil Pro ANC', 'electronique', 'Écouteurs Bluetooth 5.3 avec réduction de bruit active, très forte demande à Abidjan.', 5000, 11000, 60, 100, 75, 1, 35, 'funding', '[]'::jsonb),
  ('Sérum éclaircissant vitamine C (lot)', 'beaute', 'Sérum visage vitamine C — rotation rapide sur le marché beauté ivoirien.', 3500, 8000, 60, 200, 120, 2, 30, 'funding', '[]'::jsonb),
  ('Mini projecteur LED Full HD', 'gadgets', 'Projecteur portable 1080p, marge élevée et forte demande pour les salons.', 22000, 45000, 55, 60, 18, 1, 45, 'funding', '[]'::jsonb),
  ('Robot mixeur multifonction 5L', 'maison', 'Robot de cuisine 1200W, produit phare pour la revente en boutique.', 28000, 55000, 55, 40, 12, 1, 45, 'funding', '[]'::jsonb),
  ('Montre connectée AMOLED', 'electronique', 'Smartwatch AMOLED avec appels Bluetooth, best-seller réseaux sociaux.', 9000, 20000, 60, 150, 96, 1, 35, 'funding', '[]'::jsonb),
  ('Presse à cheveux céramique', 'beaute', 'Lisseur professionnel céramique, rotation très rapide chez les revendeuses.', 6500, 15000, 60, 120, 40, 1, 30, 'funding', '[]'::jsonb);
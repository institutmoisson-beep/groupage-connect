ALTER TABLE public.stock_express_products
  ADD COLUMN IF NOT EXISTS payment_on_delivery boolean NOT NULL DEFAULT true;

ALTER TABLE public.stock_express_orders
  ADD COLUMN IF NOT EXISTS payment_on_delivery boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(p_user_id uuid, p_amount_xof numeric, p_label text)
RETURNS TABLE(balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.';
  END IF;
  IF p_amount_xof IS NULL OR p_amount_xof = 0 THEN
    RAISE EXCEPTION 'Montant invalide.';
  END IF;
  IF coalesce(btrim(p_label), '') = '' THEN
    RAISE EXCEPTION 'Motif obligatoire.';
  END IF;

  SELECT COALESCE(SUM(amount_xof), 0) INTO v_balance
    FROM public.wallet_transactions WHERE user_id = p_user_id;

  IF p_amount_xof < 0 AND (v_balance + p_amount_xof) < 0 THEN
    RAISE EXCEPTION 'Solde insuffisant : % FCFA disponibles.', round(v_balance);
  END IF;

  INSERT INTO public.wallet_transactions (user_id, amount_xof, type, label)
  VALUES (p_user_id, p_amount_xof, 'adjustment', btrim(p_label));

  RETURN QUERY SELECT v_balance + p_amount_xof;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_offline_stock_sale(p_product_id uuid, p_quantity integer)
RETURNS TABLE(stock_quantity integer, status stock_product_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.stock_express_products%ROWTYPE;
  v_new integer;
BEGIN
  SELECT * INTO v_row FROM public.stock_express_products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable.';
  END IF;
  IF v_row.importer_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Action réservée au propriétaire du stock.';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantité invalide.';
  END IF;
  IF p_quantity > v_row.stock_quantity THEN
    RAISE EXCEPTION 'Quantité supérieure au stock restant (%).', v_row.stock_quantity;
  END IF;

  v_new := v_row.stock_quantity - p_quantity;

  UPDATE public.stock_express_products
     SET stock_quantity = v_new,
         status = CASE WHEN v_new = 0 THEN 'sold_out'::public.stock_product_status ELSE status END
   WHERE id = p_product_id;

  RETURN QUERY SELECT v_new, CASE WHEN v_new = 0 THEN 'sold_out'::public.stock_product_status ELSE v_row.status END;
END;
$$;

REVOKE ALL ON FUNCTION public.record_offline_stock_sale(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_offline_stock_sale(uuid, integer) TO authenticated;
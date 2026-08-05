CREATE OR REPLACE FUNCTION public.settle_withdrawal(
  p_withdrawal_id UUID,
  p_action TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE(status public.withdrawal_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.withdrawal_requests%ROWTYPE;
  v_next public.withdrawal_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.';
  END IF;

  SELECT * INTO v_row FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande introuvable.';
  END IF;
  IF v_row.status = 'paid' THEN
    RAISE EXCEPTION 'Ce retrait est déjà payé.';
  END IF;

  IF p_action = 'approve' THEN
    v_next := 'approved';
  ELSIF p_action = 'pay' THEN
    v_next := 'paid';
  ELSIF p_action = 'reject' THEN
    v_next := 'rejected';
  ELSE
    RAISE EXCEPTION 'Action invalide.';
  END IF;

  UPDATE public.withdrawal_requests
     SET status = v_next,
         admin_notes = COALESCE(p_note, admin_notes),
         processed_at = CASE WHEN p_action = 'pay' THEN now() ELSE processed_at END
   WHERE id = p_withdrawal_id;

  IF p_action = 'pay' THEN
    INSERT INTO public.wallet_transactions (user_id, amount_xof, type, label, withdrawal_id)
    VALUES (
      v_row.user_id,
      -ABS(v_row.amount_xof),
      'withdrawal_debit',
      'Retrait payé (' || v_row.method || ')',
      v_row.id
    );
  END IF;

  RETURN QUERY SELECT v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_withdrawal(UUID, TEXT, TEXT) TO authenticated;

CREATE TABLE public.logistics_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_xof NUMERIC NOT NULL,
  type TEXT NOT NULL DEFAULT 'delivery_fee',
  label TEXT NOT NULL,
  stock_order_id UUID REFERENCES public.stock_express_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.logistics_ledger TO authenticated;
GRANT ALL ON public.logistics_ledger TO service_role;

ALTER TABLE public.logistics_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view logistics ledger"
ON public.logistics_ledger
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_logistics_ledger_created_at ON public.logistics_ledger (created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_stock_order_delivered()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    IF COALESCE(NEW.delivery_fee_xof, 0) > 0 THEN
      INSERT INTO public.logistics_ledger (amount_xof, type, label, stock_order_id)
      VALUES (NEW.delivery_fee_xof, 'delivery_fee',
              'Frais de livraison — ' || COALESCE(v_title, 'produit'), NEW.id);
    END IF;

    NEW.delivered_at := COALESCE(NEW.delivered_at, now());

    UPDATE public.stock_express_products
       SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity),
           status = CASE WHEN GREATEST(0, stock_quantity - NEW.quantity) = 0 THEN 'sold_out'::public.stock_product_status ELSE status END
     WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$function$;
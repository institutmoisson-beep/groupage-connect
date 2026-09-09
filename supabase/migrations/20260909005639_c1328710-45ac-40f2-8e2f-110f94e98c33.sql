-- 1) Liste publique (authentifiée) des agents Mobile Money actifs, lisible malgré les RLS profiles
CREATE OR REPLACE FUNCTION public.vida_list_active_agents()
RETURNS TABLE(agent_id uuid, full_name text, phone text, city text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ac.agent_id, p.full_name, p.phone, p.city
  FROM public.vida_agent_configurations ac
  JOIN public.profiles p ON p.id = ac.agent_id
  WHERE ac.is_active = TRUE
  ORDER BY p.city NULLS LAST, p.full_name NULLS LAST
$$;

REVOKE ALL ON FUNCTION public.vida_list_active_agents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vida_list_active_agents() TO authenticated;

-- 2) File d'attente de l'agent : dépôts à encaisser + commandes encaissées
CREATE OR REPLACE FUNCTION public.vida_agent_deposit_queue()
RETURNS TABLE(
  id uuid,
  order_code character varying,
  status vida_order_status,
  product_title text,
  total_amount numeric,
  delivery_fee numeric,
  agent_commission numeric,
  refund_amount numeric,
  client_name text,
  client_phone text,
  delivery_address text,
  delivery_phone text,
  assigned boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_vida_role(auth.uid(), 'agent') THEN
    RAISE EXCEPTION 'Accès réservé aux agents Mobile Money.';
  END IF;

  RETURN QUERY
  SELECT o.id,
         o.order_code,
         o.status,
         pr.title,
         o.total_amount,
         o.delivery_fee,
         o.agent_commission,
         o.refund_amount,
         cp.full_name,
         cp.phone,
         o.delivery_address,
         o.delivery_phone,
         (o.agent_id = auth.uid()) AS assigned,
         o.created_at
  FROM public.vida_escrow_orders o
  JOIN public.vida_products pr ON pr.id = o.product_id
  LEFT JOIN public.profiles cp ON cp.id = o.client_id
  WHERE o.payment_channel = 'agent_cash'
    AND (
      o.agent_id = auth.uid()
      OR (o.agent_id IS NULL AND o.status = 'pending_deposit')
    )
    AND o.status IN ('pending_deposit', 'funds_locked', 'in_transit', 'cancelled_pending_refund')
  ORDER BY o.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.vida_agent_deposit_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vida_agent_deposit_queue() TO authenticated;

-- 3) Configuration agent : l'admin peut aussi créditer le float virtuel et corriger le cash en main
CREATE OR REPLACE FUNCTION public.vida_admin_configure_agent(
  p_agent_id uuid,
  p_recovery_mode vida_recovery_mode,
  p_max_cash_limit numeric,
  p_security_deposit numeric,
  p_is_active boolean,
  p_virtual_float_balance numeric DEFAULT NULL,
  p_cash_in_hand numeric DEFAULT NULL
)
RETURNS vida_agent_configurations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.vida_agent_configurations;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.';
  END IF;

  INSERT INTO public.vida_agent_configurations (
    agent_id, recovery_mode, max_cash_limit, security_deposit_amount, is_active,
    virtual_float_balance, cash_in_hand
  )
  VALUES (
    p_agent_id, p_recovery_mode, p_max_cash_limit, p_security_deposit, p_is_active,
    COALESCE(p_virtual_float_balance, 0), COALESCE(p_cash_in_hand, 0)
  )
  ON CONFLICT (agent_id) DO UPDATE SET
    recovery_mode = EXCLUDED.recovery_mode,
    max_cash_limit = EXCLUDED.max_cash_limit,
    security_deposit_amount = EXCLUDED.security_deposit_amount,
    is_active = EXCLUDED.is_active,
    virtual_float_balance = COALESCE(p_virtual_float_balance, public.vida_agent_configurations.virtual_float_balance),
    cash_in_hand = COALESCE(p_cash_in_hand, public.vida_agent_configurations.cash_in_hand),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.vida_admin_configure_agent(uuid, vida_recovery_mode, numeric, numeric, boolean, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vida_admin_configure_agent(uuid, vida_recovery_mode, numeric, numeric, boolean, numeric, numeric) TO authenticated;

-- 4) Message clair quand le float virtuel de l'agent est insuffisant
CREATE OR REPLACE FUNCTION public.vida_agent_lock_funds(p_order_code text)
RETURNS vida_escrow_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.vida_escrow_orders%ROWTYPE;
  v_cfg public.vida_agent_configurations%ROWTYPE;
BEGIN
  IF NOT public.has_vida_role(auth.uid(), 'agent') THEN
    RAISE EXCEPTION 'Accès réservé aux agents Mobile Money.';
  END IF;

  SELECT * INTO v_order FROM public.vida_escrow_orders WHERE order_code = upper(p_order_code) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher introuvable.';
  END IF;
  IF v_order.status <> 'pending_deposit' THEN
    RAISE EXCEPTION 'Cette commande n''est plus en attente de dépôt (statut: %).', v_order.status;
  END IF;
  IF v_order.agent_id IS NOT NULL AND v_order.agent_id <> auth.uid() THEN
    RAISE EXCEPTION 'Ce voucher est réservé à un autre agent.';
  END IF;

  SELECT * INTO v_cfg FROM public.vida_agent_configurations WHERE agent_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR NOT v_cfg.is_active THEN
    RAISE EXCEPTION 'Compte agent inactif ou non configuré. Contactez l''administration.';
  END IF;
  IF v_cfg.virtual_float_balance < v_order.total_amount THEN
    RAISE EXCEPTION 'Float virtuel insuffisant (disponible %, requis %). Demandez une recharge à l''administration.', v_cfg.virtual_float_balance, v_order.total_amount;
  END IF;
  IF v_cfg.cash_in_hand + v_order.total_amount > v_cfg.max_cash_limit THEN
    RAISE EXCEPTION 'Plafond de cash-in-hand dépassé (max %). Déclenchez une récupération avant de continuer.', v_cfg.max_cash_limit;
  END IF;

  UPDATE public.vida_agent_configurations
     SET cash_in_hand = cash_in_hand + v_order.total_amount,
         virtual_float_balance = virtual_float_balance - v_order.total_amount,
         updated_at = now()
   WHERE agent_id = auth.uid();

  UPDATE public.vida_escrow_orders
     SET agent_id = auth.uid(),
         status = 'funds_locked',
         delivery_otp = public.vida_generate_otp(),
         deposited_at = now()
   WHERE id = v_order.id
   RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

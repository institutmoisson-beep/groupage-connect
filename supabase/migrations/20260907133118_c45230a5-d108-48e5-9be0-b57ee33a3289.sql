-- 1. Vues : appliquer les droits de l'appelant
ALTER VIEW public.vida_active_agents SET (security_invoker = true);

-- 2. Politiques ViDa trop permissives
DROP POLICY IF EXISTS "ViDa products are viewable" ON public.vida_products;

DROP POLICY IF EXISTS "Vendeur gère ses produits" ON public.vida_products;
CREATE POLICY "Vendeur gère ses produits" ON public.vida_products
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = vendor_id AND public.has_vida_role(auth.uid(), 'vendor'))
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "ViDa product items are viewable" ON public.vida_product_items;
CREATE POLICY "ViDa product items are viewable" ON public.vida_product_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vida_products p
      WHERE p.id = vida_product_items.vida_product_id
        AND (p.is_active = true OR p.vendor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- 3. search_path fixe sur les fonctions internes
ALTER FUNCTION public.vida_generate_order_code() SET search_path = public;
ALTER FUNCTION public.vida_generate_otp() SET search_path = public;
ALTER FUNCTION public.vida_set_cancellation_deadline() SET search_path = public;
ALTER FUNCTION public.vida_touch_updated_at() SET search_path = public;

-- 4. Retirer l'exécution anonyme des fonctions SECURITY DEFINER sensibles
REVOKE EXECUTE ON FUNCTION public.has_vida_role(uuid, vida_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vida_create_order(uuid, vida_payment_channel, uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vida_cancel_order(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vida_confirm_delivery(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vida_agent_lock_funds(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vida_agent_process_refund(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vida_agent_settle_recovery(numeric, text, uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vida_api_topup_confirm(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vida_collector_confirm_pickup(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vida_admin_configure_agent(uuid, vida_recovery_mode, numeric, numeric, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vida_admin_set_role_status(uuid, vida_role, boolean, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.vida_admin_update_product_rules(uuid, integer, numeric, numeric, numeric) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_vida_role(uuid, vida_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vida_create_order(uuid, vida_payment_channel, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vida_cancel_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vida_confirm_delivery(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vida_agent_lock_funds(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vida_agent_process_refund(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vida_agent_settle_recovery(numeric, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vida_api_topup_confirm(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vida_collector_confirm_pickup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vida_admin_configure_agent(uuid, vida_recovery_mode, numeric, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vida_admin_set_role_status(uuid, vida_role, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vida_admin_update_product_rules(uuid, integer, numeric, numeric, numeric) TO authenticated;
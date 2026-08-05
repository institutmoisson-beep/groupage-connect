-- 1. Profiles: remove public read of personal data
DROP POLICY IF EXISTS "Profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Referrers view their downline profiles"
ON public.profiles FOR SELECT TO authenticated
USING (referred_by = auth.uid());

CREATE POLICY "Users insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. Replace anon-reachable policies that evaluate has_role()
-- campaign_products (duplicate of authenticated policy)
DROP POLICY IF EXISTS "Admins manage campaign products" ON public.campaign_products;

-- commissions
DROP POLICY IF EXISTS "Users view earned commissions" ON public.commissions;
CREATE POLICY "Users view earned commissions"
ON public.commissions FOR SELECT TO authenticated
USING ((auth.uid() = referrer_id) OR public.has_role(auth.uid(), 'admin'));

-- orders
DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
DROP POLICY IF EXISTS "Users view own orders" ON public.orders;
CREATE POLICY "Admins update orders"
ON public.orders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own orders"
ON public.orders FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));

-- forwarding_packages
DROP POLICY IF EXISTS "admin delete packages" ON public.forwarding_packages;
DROP POLICY IF EXISTS "users declare own packages" ON public.forwarding_packages;
DROP POLICY IF EXISTS "users update own packages" ON public.forwarding_packages;
DROP POLICY IF EXISTS "users view own packages" ON public.forwarding_packages;
CREATE POLICY "admin delete packages"
ON public.forwarding_packages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users declare own packages"
ON public.forwarding_packages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own packages"
ON public.forwarding_packages FOR UPDATE TO authenticated
USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users view own packages"
ON public.forwarding_packages FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));

-- package_delivery_logs
DROP POLICY IF EXISTS "admin delete delivery logs" ON public.package_delivery_logs;
DROP POLICY IF EXISTS "admin manage delivery logs" ON public.package_delivery_logs;
DROP POLICY IF EXISTS "users capture own gps once" ON public.package_delivery_logs;
DROP POLICY IF EXISTS "users view own delivery logs" ON public.package_delivery_logs;
CREATE POLICY "admin delete delivery logs"
ON public.package_delivery_logs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage delivery logs"
ON public.package_delivery_logs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users capture own gps once"
ON public.package_delivery_logs FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.forwarding_packages fp
   WHERE fp.id = package_delivery_logs.package_id AND fp.user_id = auth.uid()
));
CREATE POLICY "users view own delivery logs"
ON public.package_delivery_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
  SELECT 1 FROM public.forwarding_packages fp
   WHERE fp.id = package_delivery_logs.package_id AND fp.user_id = auth.uid()
));

-- sourcing_messages (drop duplicated public policies, keep authenticated ones)
DROP POLICY IF EXISTS "participants read messages" ON public.sourcing_messages;
DROP POLICY IF EXISTS "participants send messages" ON public.sourcing_messages;
DROP POLICY IF EXISTS "admin delete messages" ON public.sourcing_messages;
DROP POLICY IF EXISTS "sender marks own read" ON public.sourcing_messages;
CREATE POLICY "admin delete messages"
ON public.sourcing_messages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "sender marks own read"
ON public.sourcing_messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
  SELECT 1 FROM public.custom_sourcing_orders o
   WHERE o.id = sourcing_messages.sourcing_order_id AND o.user_id = auth.uid()
));

-- Public catalogs: split anon (no has_role) from authenticated
DROP POLICY IF EXISTS "Anyone reads active destinations" ON public.custom_destinations;
CREATE POLICY "Anon reads active destinations"
ON public.custom_destinations FOR SELECT TO anon USING (is_active);
CREATE POLICY "Users read active destinations"
ON public.custom_destinations FOR SELECT TO authenticated
USING (is_active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone reads active hotels" ON public.custom_hotels;
CREATE POLICY "Anon reads active hotels"
ON public.custom_hotels FOR SELECT TO anon USING (is_active);
CREATE POLICY "Users read active hotels"
ON public.custom_hotels FOR SELECT TO authenticated
USING (is_active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone reads active rooms" ON public.custom_rooms;
CREATE POLICY "Anon reads active rooms"
ON public.custom_rooms FOR SELECT TO anon USING (is_active);
CREATE POLICY "Users read active rooms"
ON public.custom_rooms FOR SELECT TO authenticated
USING (is_active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public read active methods" ON public.payment_methods;
CREATE POLICY "Anon reads active methods"
ON public.payment_methods FOR SELECT TO anon USING (active = true);
CREATE POLICY "Users read active methods"
ON public.payment_methods FOR SELECT TO authenticated
USING ((active = true) OR public.has_role(auth.uid(), 'admin'));

-- 3. Lock down SECURITY DEFINER function execution
REVOKE ALL ON FUNCTION public.auto_promote_celvus() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_forwarding_shipping_cost() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_delivery_log_insert_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_forwarding_qc_gate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_forwarding_user_update_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_order_paid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_proof_verified() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_sourcing_delivered() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_stock_order_delivered() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_guest_hotel_bookings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_direct_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_sourcing_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_stock_order_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_direct_message_sender_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_sourcing_message_sender_role() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.settle_withdrawal(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_withdrawal(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
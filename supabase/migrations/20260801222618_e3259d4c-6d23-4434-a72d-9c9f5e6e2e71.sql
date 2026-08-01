-- Enums
CREATE TYPE public.hotel_payment_model AS ENUM ('direct_merchant', 'api_delegated');
CREATE TYPE public.hotel_payment_gateway AS ENUM ('msn_smart', 'stripe', 'mobile_money_xof', 'hotel_direct');
CREATE TYPE public.hotel_payment_status AS ENUM ('pending', 'paid', 'refunded', 'failed');
CREATE TYPE public.hotel_booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- Bookings
CREATE TABLE public.hotel_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_email text NOT NULL,
  guest_phone text,
  guest_name text,
  booking_reference text NOT NULL UNIQUE DEFAULT ('MSNH' || upper(substring(md5(random()::text) from 1 for 8))),
  supplier_confirmation_id text,
  payment_model public.hotel_payment_model NOT NULL DEFAULT 'direct_merchant',
  payment_gateway public.hotel_payment_gateway NOT NULL DEFAULT 'msn_smart',
  payment_status public.hotel_payment_status NOT NULL DEFAULT 'pending',
  hotel_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  room_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  rooms integer NOT NULL DEFAULT 1,
  guests integer NOT NULL DEFAULT 1,
  supplier_net_price numeric NOT NULL DEFAULT 0,
  markup_amount numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XOF',
  status public.hotel_booking_status NOT NULL DEFAULT 'pending',
  cancellation_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.hotel_bookings TO authenticated;
GRANT ALL ON public.hotel_bookings TO service_role;
ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own hotel bookings" ON public.hotel_bookings
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own hotel bookings" ON public.hotel_bookings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own hotel bookings" ON public.hotel_bookings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_hotel_bookings_user ON public.hotel_bookings(user_id);
CREATE INDEX idx_hotel_bookings_guest_email ON public.hotel_bookings(lower(guest_email));

CREATE TRIGGER hotel_bookings_updated_at BEFORE UPDATE ON public.hotel_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Preferences
CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_currency text NOT NULL DEFAULT 'XOF',
  preferred_language text NOT NULL DEFAULT 'FR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences" ON public.user_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Exchange rates cache
CREATE TABLE public.exchange_rates (
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency, quote_currency)
);

GRANT SELECT ON public.exchange_rates TO anon, authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exchange rates" ON public.exchange_rates
  FOR SELECT USING (true);
CREATE POLICY "Admins manage exchange rates" ON public.exchange_rates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.exchange_rates (base_currency, quote_currency, rate) VALUES
  ('XOF','XOF',1),
  ('XOF','EUR',0.001524),
  ('XOF','USD',0.00165),
  ('XOF','CNY',0.0119),
  ('XOF','GBP',0.00129);

-- Guest booking linkage: profiles row is created for every new user
CREATE OR REPLACE FUNCTION public.link_guest_hotel_bookings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;
  IF v_email IS NOT NULL THEN
    UPDATE public.hotel_bookings
       SET user_id = NEW.id
     WHERE user_id IS NULL
       AND lower(guest_email) = lower(v_email);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER link_guest_hotel_bookings_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.link_guest_hotel_bookings();
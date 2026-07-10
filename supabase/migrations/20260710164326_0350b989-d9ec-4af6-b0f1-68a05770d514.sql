
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'member');
CREATE TYPE public.shipping_type AS ENUM ('sea', 'air');
CREATE TYPE public.campaign_status AS ENUM ('open', 'closed', 'shipped', 'arrived');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid_confirmed', 'shipped', 'transit', 'abidjan', 'delivered', 'cancelled');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  city TEXT DEFAULT 'Abidjan',
  referral_code TEXT UNIQUE NOT NULL,
  referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  mlm_level INT NOT NULL DEFAULT 1,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO anon;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Général',
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  cny_price NUMERIC(10,2) NOT NULL,
  logistics_fee_xof NUMERIC(10,2) NOT NULL DEFAULT 2000,
  exchange_rate_cny_xof NUMERIC(10,4) NOT NULL DEFAULT 85,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are public" ON public.products FOR SELECT USING (active = true);
CREATE POLICY "Admins manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ GROUPAGE CAMPAIGNS ============
CREATE TABLE public.groupage_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  shipping_type shipping_type NOT NULL DEFAULT 'sea',
  target_quantity INT NOT NULL,
  current_participants INT NOT NULL DEFAULT 0,
  end_date TIMESTAMPTZ NOT NULL,
  status campaign_status NOT NULL DEFAULT 'open',
  eta_days INT NOT NULL DEFAULT 45,
  container_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.groupage_campaigns TO anon, authenticated;
GRANT ALL ON public.groupage_campaigns TO service_role;
ALTER TABLE public.groupage_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campaigns are public" ON public.groupage_campaigns FOR SELECT USING (true);
CREATE POLICY "Admins manage campaigns" ON public.groupage_campaigns FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ CAMPAIGN PRODUCTS ============
CREATE TABLE public.campaign_products (
  campaign_id UUID NOT NULL REFERENCES public.groupage_campaigns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, product_id)
);
GRANT SELECT ON public.campaign_products TO anon, authenticated;
GRANT ALL ON public.campaign_products TO service_role;
ALTER TABLE public.campaign_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campaign products public" ON public.campaign_products FOR SELECT USING (true);
CREATE POLICY "Admins manage campaign products" ON public.campaign_products FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  campaign_id UUID REFERENCES public.groupage_campaigns(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_price_xof NUMERIC(10,2) NOT NULL,
  total_xof NUMERIC(12,2) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  shipping_type shipping_type NOT NULL DEFAULT 'sea',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- ============ COMMISSIONS ============
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_xof NUMERIC(10,2) NOT NULL,
  level INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view earned commissions" ON public.commissions FOR SELECT USING (auth.uid() = referrer_id OR public.has_role(auth.uid(), 'admin'));

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  referrer UUID;
BEGIN
  new_code := 'MSN' || UPPER(substring(md5(random()::text || NEW.id::text) from 1 for 6));
  referrer := NULLIF(NEW.raw_user_meta_data->>'referred_by', '')::UUID;
  -- if referral code provided instead of id
  IF referrer IS NULL AND NEW.raw_user_meta_data->>'referral_code' IS NOT NULL THEN
    SELECT id INTO referrer FROM public.profiles WHERE referral_code = NEW.raw_user_meta_data->>'referral_code' LIMIT 1;
  END IF;
  INSERT INTO public.profiles (id, full_name, phone, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    new_code,
    referrer
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ORDER INSERT TRIGGER (update campaign progress) ============
CREATE OR REPLACE FUNCTION public.handle_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL THEN
    UPDATE public.groupage_campaigns
    SET current_participants = current_participants + NEW.quantity,
        status = CASE
          WHEN current_participants + NEW.quantity >= target_quantity THEN 'closed'::campaign_status
          ELSE status
        END
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_order_created AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_new_order();

-- ============ ORDER PAID TRIGGER (commission calculation) ============
CREATE OR REPLACE FUNCTION public.handle_order_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_referrer UUID;
  buyer UUID;
  level INT := 1;
  rates NUMERIC[] := ARRAY[0.10, 0.05, 0.02];
BEGIN
  IF NEW.status = 'paid_confirmed' AND (OLD.status IS DISTINCT FROM 'paid_confirmed') THEN
    buyer := NEW.user_id;
    SELECT referred_by INTO current_referrer FROM public.profiles WHERE id = buyer;
    WHILE current_referrer IS NOT NULL AND level <= 3 LOOP
      INSERT INTO public.commissions (referrer_id, buyer_id, order_id, amount_xof, level)
      VALUES (current_referrer, buyer, NEW.id, ROUND(NEW.total_xof * rates[level], 2), level);
      SELECT referred_by INTO current_referrer FROM public.profiles WHERE id = current_referrer;
      level := level + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_order_paid AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_order_paid();

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

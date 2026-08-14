CREATE TYPE public.app_role AS ENUM ('driver','mechanic','admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'driver',
  full_name text,
  phone text,
  wallet_balance integer NOT NULL DEFAULT 500,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value numeric NOT NULL
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings_admin_write" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.app_settings (setting_key, setting_value) VALUES ('unlock_fee', 50);

CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mechanic_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  vehicle_type text NOT NULL,
  issue_type text NOT NULL,
  exact_lat double precision,
  exact_lng double precision,
  status text NOT NULL DEFAULT 'pending',
  fee_paid numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_requests TO authenticated;
GRANT ALL ON public.service_requests TO service_role;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sr_driver_select" ON public.service_requests FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "sr_driver_insert" ON public.service_requests FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid() AND public.has_role(auth.uid(),'driver'));
CREATE POLICY "sr_driver_update" ON public.service_requests FOR UPDATE TO authenticated USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY "sr_mechanic_select" ON public.service_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'mechanic') AND (status = 'pending' OR mechanic_id = auth.uid()));
CREATE POLICY "sr_mechanic_update" ON public.service_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'mechanic') AND (mechanic_id = auth.uid() OR status = 'pending')) WITH CHECK (public.has_role(auth.uid(),'mechanic') AND mechanic_id = auth.uid());
CREATE POLICY "sr_admin_all" ON public.service_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role text := COALESCE(NEW.raw_user_meta_data->>'role', 'driver');
BEGIN
  IF _role NOT IN ('driver','mechanic','admin') THEN _role := 'driver'; END IF;
  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES (NEW.id, _role, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
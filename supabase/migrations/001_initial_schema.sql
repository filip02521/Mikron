-- System Dostaw - initial schema

CREATE TYPE supplier_location AS ENUM ('POLSKA', 'ZAGRANICA', 'IMPORT');
CREATE TYPE stats_mode AS ENUM ('LACZNIE', 'OSOBNO');
CREATE TYPE individual_order_status AS ENUM (
  'Nowe',
  'Zamowione',
  'Czesciowo_zrealizowane',
  'Zrealizowane',
  'Anulowane'
);
CREATE TYPE order_type_enum AS ENUM ('Glowne', 'Poboczne', 'None');
CREATE TYPE vacation_note_enum AS ENUM (
  'PRZESUNIETE_PO',
  'PRZYSPIESZONE_PRZED',
  'OSTATNIE_ZAMOWIENIE'
);
CREATE TYPE user_role AS ENUM ('admin', 'sales');

CREATE TABLE sales_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  location supplier_location NOT NULL,
  pickup_mikran BOOLEAN NOT NULL DEFAULT false,
  pickup_pallet BOOLEAN NOT NULL DEFAULT false,
  notes TEXT DEFAULT '',
  mails TEXT DEFAULT '',
  extra_info TEXT DEFAULT '',
  interval_weeks NUMERIC,
  stock NUMERIC,
  stats_mode stats_mode NOT NULL DEFAULT 'LACZNIE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE supplier_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL UNIQUE REFERENCES suppliers(id) ON DELETE CASCADE,
  order_date DATE,
  shift_date DATE,
  computed_next_date DATE,
  vacation_note vacation_note_enum,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vacations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  last_order_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE individual_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  sales_person_id UUID NOT NULL REFERENCES sales_people(id),
  symbol TEXT DEFAULT '-',
  products TEXT NOT NULL,
  quantity TEXT DEFAULT '-',
  delivered_quantity TEXT DEFAULT '-',
  order_type order_type_enum NOT NULL DEFAULT 'None',
  status individual_order_status NOT NULL DEFAULT 'Nowe',
  action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_individual_orders_status ON individual_orders(status);
CREATE INDEX idx_individual_orders_sales ON individual_orders(sales_person_id);

CREATE TABLE normal_order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_email TEXT NOT NULL DEFAULT 'system',
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  next_date DATE
);

CREATE TABLE delivery_stats (
  supplier_id UUID PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
  main_sum NUMERIC,
  main_count INTEGER,
  main_avg NUMERIC,
  side_sum NUMERIC,
  side_count INTEGER,
  side_avg NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE job_locks (
  key TEXT PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL,
  locked_by TEXT
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role user_role NOT NULL DEFAULT 'sales',
  sales_person_id UUID REFERENCES sales_people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES
  ('email_recipients', '"filip.naskret@mikran.com"'::jsonb),
  ('summary_colors', '{"expired":"#f5f5f5","today":"#ffebee","tomorrow":"#fffde7","thisWeek":"#e3f2fd","forSomeone":"#e8f5e9","vacationWarning":"#fff3e0"}'::jsonb);

-- RLS
ALTER TABLE sales_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE normal_order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.my_sales_person_id()
RETURNS UUID AS $$
  SELECT sales_person_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admin full access
CREATE POLICY admin_all_sales_people ON sales_people FOR ALL USING (public.is_admin());
CREATE POLICY admin_all_suppliers ON suppliers FOR ALL USING (public.is_admin());
CREATE POLICY admin_all_schedules ON supplier_schedules FOR ALL USING (public.is_admin());
CREATE POLICY admin_all_vacations ON vacations FOR ALL USING (public.is_admin());
CREATE POLICY admin_all_individual ON individual_orders FOR ALL USING (public.is_admin());
CREATE POLICY admin_all_history ON normal_order_history FOR ALL USING (public.is_admin());
CREATE POLICY admin_all_stats ON delivery_stats FOR ALL USING (public.is_admin());
CREATE POLICY admin_all_settings ON app_settings FOR ALL USING (public.is_admin());
CREATE POLICY admin_all_locks ON job_locks FOR ALL USING (public.is_admin());
CREATE POLICY admin_all_profiles ON profiles FOR ALL USING (public.is_admin());

-- Sales: read suppliers/schedules, own orders
CREATE POLICY sales_read_suppliers ON suppliers FOR SELECT USING (
  public.is_admin() OR auth.uid() IS NOT NULL
);
CREATE POLICY sales_read_schedules ON supplier_schedules FOR SELECT USING (
  public.is_admin() OR auth.uid() IS NOT NULL
);
CREATE POLICY sales_own_orders_select ON individual_orders FOR SELECT USING (
  public.is_admin() OR sales_person_id = public.my_sales_person_id()
);
CREATE POLICY sales_own_orders_insert ON individual_orders FOR INSERT WITH CHECK (
  public.is_admin() OR sales_person_id = public.my_sales_person_id()
);
CREATE POLICY sales_read_sales_people ON sales_people FOR SELECT USING (
  public.is_admin() OR auth.uid() IS NOT NULL
);
CREATE POLICY users_read_own_profile ON profiles FOR SELECT USING (
  id = auth.uid() OR public.is_admin()
);
CREATE POLICY users_update_own_profile ON profiles FOR UPDATE USING (id = auth.uid());

-- Service role bypasses RLS when using service key on server

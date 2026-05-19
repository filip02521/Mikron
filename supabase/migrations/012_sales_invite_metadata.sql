-- Powiązanie handlowca z kontem przy zaproszeniu (metadata sales_person_id)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sp_id UUID;
BEGIN
  sp_id := NULLIF(TRIM(NEW.raw_user_meta_data->>'sales_person_id'), '')::uuid;

  INSERT INTO public.profiles (id, email, role, sales_person_id)
  VALUES (NEW.id, NEW.email, 'sales', sp_id)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    sales_person_id = COALESCE(EXCLUDED.sales_person_id, profiles.sales_person_id);

  RETURN NEW;
END;
$$;

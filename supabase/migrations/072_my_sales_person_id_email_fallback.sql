-- Align my_sales_person_id() z resolveSalesPersonForUser() — fallback po e-mailu,
-- gdy profiles.sales_person_id jest NULL, ale konto pasuje do sales_people.email.

CREATE OR REPLACE FUNCTION public.my_sales_person_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT sales_person_id FROM profiles WHERE id = auth.uid()),
    (
      SELECT sp.id
      FROM profiles p
      INNER JOIN sales_people sp
        ON lower(trim(sp.email)) = lower(trim(p.email))
      WHERE p.id = auth.uid()
        AND p.email IS NOT NULL
        AND trim(p.email) <> ''
      ORDER BY sp.id
      LIMIT 1
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.my_sales_person_id() IS
  'UUID karty handlowca: profiles.sales_person_id lub dopasowanie po e-mailu profilu.';

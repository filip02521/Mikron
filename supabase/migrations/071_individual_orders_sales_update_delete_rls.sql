-- RLS UPDATE/DELETE dla handlowca i kierownika na individual_orders.
-- Scope przez can_read_sales_order / can_insert_sales_order (migracja 069).

CREATE POLICY sales_team_orders_update ON individual_orders
  FOR UPDATE
  TO authenticated
  USING (public.can_read_sales_order(sales_person_id))
  WITH CHECK (public.can_insert_sales_order(sales_person_id));

CREATE POLICY sales_team_orders_delete ON individual_orders
  FOR DELETE
  TO authenticated
  USING (
    public.can_read_sales_order(sales_person_id)
    AND status IN ('Nowe', 'Weryfikacja')
  );

COMMENT ON POLICY sales_team_orders_update ON individual_orders IS
  'Handlowiec/kierownik: edycja pól własnych lub zespołowych pozycji w scope RLS.';

COMMENT ON POLICY sales_team_orders_delete ON individual_orders IS
  'Handlowiec/kierownik: usuwanie linii prośby tylko w statusie Nowe/Weryfikacja.';

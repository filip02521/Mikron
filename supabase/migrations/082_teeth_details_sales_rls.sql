-- Handlowiec / kierownik: odczyt i zapis list zębów własnych prośb (mirror polityk individual_orders z 069/071).

CREATE POLICY individual_order_teeth_details_sales_own
  ON individual_order_teeth_details
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM individual_orders io
      WHERE io.id = individual_order_teeth_details.order_id
        AND public.can_read_sales_order(io.sales_person_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM individual_orders io
      WHERE io.id = individual_order_teeth_details.order_id
        AND io.is_teeth = true
        AND public.can_insert_sales_order(io.sales_person_id)
    )
  );

COMMENT ON POLICY individual_order_teeth_details_sales_own ON individual_order_teeth_details IS
  'Handlowiec i kierownik: lista zębów prośb, do których mają dostęp (can_read/can_insert_sales_order).';

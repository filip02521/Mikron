-- Zęby: producent w prosba_teeth_products + szczegóły zębowe per pozycja zamówienia.

-- Kolumna producenta w prosba_teeth_products (ustawiane w adminie).
ALTER TABLE prosba_teeth_products
  ADD COLUMN IF NOT EXISTS manufacturer TEXT NULL;
-- Wartości: 'ivoclar' | 'wiedent' | 'dentex' | 'major' | null

-- Tabela szczegółów zębowych per pozycja zamówienia.
CREATE TABLE IF NOT EXISTS individual_order_teeth_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES individual_orders(id) ON DELETE CASCADE,
  position INT NOT NULL,
  color TEXT NOT NULL,
  mould TEXT NULL,
  size TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, position)
);

CREATE INDEX IF NOT EXISTS individual_order_teeth_details_order_idx
  ON individual_order_teeth_details (order_id);

ALTER TABLE individual_order_teeth_details ENABLE ROW LEVEL SECURITY;

-- Admin i zakupy: pełny dostęp.
CREATE POLICY individual_order_teeth_details_admin_all
  ON individual_order_teeth_details
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_operations())
  WITH CHECK (public.is_admin() OR public.is_operations());

-- zakupy_zeby: dostęp tylko do pozycji powiązanych z zamówieniami zębowymi.
CREATE POLICY individual_order_teeth_details_zeby_all
  ON individual_order_teeth_details
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM individual_orders
      WHERE id = individual_order_teeth_details.order_id
        AND is_teeth = true
    )
    AND public.can_access_teeth_panel()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM individual_orders
      WHERE id = individual_order_teeth_details.order_id
        AND is_teeth = true
    )
    AND public.can_access_teeth_panel()
  );

COMMENT ON TABLE individual_order_teeth_details IS
  'Szczegóły zębowe (kolor, wzór, rozmiar) per pozycja zamówienia — uzupełniane przez handlowca przy prośbie o zęby.';

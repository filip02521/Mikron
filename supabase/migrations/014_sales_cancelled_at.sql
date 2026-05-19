-- Handlowiec anulował prośbę (klient się rozmyślił) — widoczne w panelu zakupów
ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_individual_orders_sales_cancelled
  ON individual_orders (sales_cancelled_at DESC)
  WHERE sales_cancelled_at IS NOT NULL;

-- Potwierdzenie przez handlowca przeczytania zmiany uwag od działu zakupów.

ALTER TABLE individual_orders
  ADD COLUMN IF NOT EXISTS sales_request_note_seen_at timestamptz;

COMMENT ON COLUMN individual_orders.sales_request_note_seen_at IS
  'Kiedy handlowiec potwierdził przeczytanie uwag zaktualizowanych przez zakupy (sales_request_note_updated_at).';

CREATE INDEX IF NOT EXISTS individual_orders_sales_request_note_unread_idx
  ON individual_orders (sales_person_id, sales_request_note_updated_at)
  WHERE sales_request_note_updated_at IS NOT NULL
    AND (
      sales_request_note_seen_at IS NULL
      OR sales_request_note_seen_at < sales_request_note_updated_at
    );

NOTIFY pgrst, 'reload schema';

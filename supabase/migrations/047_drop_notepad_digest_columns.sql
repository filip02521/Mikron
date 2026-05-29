-- Usunięcie martwych kolumn digest (e-mail usunięty z kodu).

ALTER TABLE sales_notes DROP COLUMN IF EXISTS digest_notified_at;
ALTER TABLE sales_payment_watches DROP COLUMN IF EXISTS digest_notified_at;

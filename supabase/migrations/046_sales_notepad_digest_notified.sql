-- Śledzenie wysłanego digestu e-mail (notatnik follow-up / ZK po terminie).

ALTER TABLE sales_payment_watches
  ADD COLUMN IF NOT EXISTS digest_notified_at DATE;

ALTER TABLE sales_notes
  ADD COLUMN IF NOT EXISTS digest_notified_at DATE;

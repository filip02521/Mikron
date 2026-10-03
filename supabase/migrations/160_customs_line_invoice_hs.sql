-- 160_customs_line_invoice_hs.sql
-- Kod HS / commodity code podany przez nadawcę przy pozycji faktury (np. „8207909000”).
-- Tylko podpowiedź przy ustalaniu kodu CN — Mikran podaje agencji własny, sprawdzony kod.

ALTER TABLE public.customs_clearance_lines
  ADD COLUMN IF NOT EXISTS invoice_hs_code text;

COMMENT ON COLUMN public.customs_clearance_lines.invoice_hs_code IS
  'Kod HS z faktury nadawcy (cyfry, bez kropek) — podpowiedź dla kodu CN, nie wysyłany agencji.';

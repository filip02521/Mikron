-- 170_customs_line_invoice_group.sql
-- Opis grupy produktów z faktury (scalona komórka, np. „Dental Lithium Disilicate Glass Ceramic”
-- nad modelami „LT VBL2-R(18-15-13)”). Osobno od nazwy: nazwa jest kluczem karty celnej
-- dla dostawców bez kodów artykułów (Upcera), więc doklejanie grupy zmieniałoby klucze.

ALTER TABLE public.customs_clearance_lines
  ADD COLUMN IF NOT EXISTS invoice_group text;

COMMENT ON COLUMN public.customs_clearance_lines.invoice_group IS
  'Opis grupy produktów z faktury (scalona komórka) — kontekst dla opisu PL i kontroli materiału, nie klucz karty.';

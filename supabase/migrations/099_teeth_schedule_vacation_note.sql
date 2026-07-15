-- Dział zębów: dodaj kolumnę vacation_note do teeth_supplier_schedules.
-- Pozwala wyświetlać informacje o urlopie dostawcy (PRZESUNIETE_PO, PRZYSPIESZONE_PRZED, OSTATNIE_ZAMOWIENIE)
-- w torze zębów, analogicznie jak w głównym harmonogramie supplier_schedules.

ALTER TABLE teeth_supplier_schedules
  ADD COLUMN IF NOT EXISTS vacation_note TEXT NULL;

COMMENT ON COLUMN teeth_supplier_schedules.vacation_note IS
  'Notatka urlopowa — PRZESUNIETE_PO, PRZYSPIESZONE_PRZED, OSTATNIE_ZAMOWIENIE. Przeliczana przez recalcTeethSchedule.';

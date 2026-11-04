-- 207_individual_orders_zd_auto_attached.sql
-- Notatnik ZK: pozycję, którą pokryje towar w drodze (ZD z terminem), handlowiec nie
-- zamawia — OnTime tworzy prośbę od razu jako „już zamówione”, podpiętą pod ten ZD.
-- Znacznik odróżnia takie prośby od oznaczonych ręcznie przez zakupy.

ALTER TABLE public.individual_orders
  ADD COLUMN IF NOT EXISTS zd_auto_attached_at timestamptz;

COMMENT ON COLUMN public.individual_orders.zd_auto_attached_at IS
  'Kiedy prośbę podpięto automatycznie pod ZD w drodze (notatnik ZK); null = utworzona zwykłą ścieżką.';

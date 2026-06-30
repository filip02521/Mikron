-- Dział zakupów — Zęby: nowa rola + kolumny oznaczające pozycje zęby na individual_orders.
-- Uwaga: ALTER TYPE ADD VALUE musi być wykonane poza blokiem transakcyjnym.
-- Ten plik zawiera tylko dodanie wartości enum — reszta w 077b_teeth_order_queue.sql.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'zakupy_zeby';

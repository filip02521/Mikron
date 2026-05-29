-- Rola magazyn (Dział dostaw) — osobna migracja: enum musi być commitowany przed użyciem w funkcjach/politykach.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'magazyn';

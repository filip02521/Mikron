-- Rozszerzenie listy kurierów w dzienniku dostaw (ewidencja magazynu).

ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'ups';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'rhenus_naxco';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'raben';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'psd';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'tnt';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'poltraf';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'kuehne_nagel';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'suus_logistics';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'dhl_express';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'dachser';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'db_schenker';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'mikran_bartek';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'geis';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'jasfbg';
ALTER TYPE warehouse_carrier ADD VALUE IF NOT EXISTS 'hellmann';

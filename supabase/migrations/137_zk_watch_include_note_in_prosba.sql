-- Flaga: notatka do sprawy ZK ma trafić do prośby (obecnej / przyszłej).
ALTER TABLE sales_zk_watches
  ADD COLUMN IF NOT EXISTS include_note_in_prosba boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sales_zk_watches.include_note_in_prosba IS
  'Gdy true i jest note — przy tworzeniu/uzupełnianiu prośby z ZK dołącz notatkę do sales_request_note; handlowiec widzi status w UI.';

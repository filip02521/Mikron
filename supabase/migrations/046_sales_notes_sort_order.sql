-- Kolejność ręczna notatek (drag & drop w notatniku).

ALTER TABLE sales_notes
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY sales_person_id, (archived_at IS NOT NULL)
      ORDER BY pinned DESC, updated_at DESC
    ) - 1 AS rn
  FROM sales_notes
)
UPDATE sales_notes AS n
SET sort_order = ranked.rn
FROM ranked
WHERE n.id = ranked.id;

CREATE INDEX IF NOT EXISTS sales_notes_person_sort_idx
  ON sales_notes (sales_person_id, archived_at, pinned DESC, sort_order ASC);

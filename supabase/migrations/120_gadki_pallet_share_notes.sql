-- Notatka per udział palety (osobna od line_meta.note).

ALTER TABLE public.external_warehouse_line_pallet_shares
  ADD COLUMN IF NOT EXISTS note TEXT NULL;

ALTER TABLE public.external_warehouse_line_pallet_shares
  DROP CONSTRAINT IF EXISTS external_warehouse_line_pallet_shares_note_len;

ALTER TABLE public.external_warehouse_line_pallet_shares
  ADD CONSTRAINT external_warehouse_line_pallet_shares_note_len
  CHECK (note IS NULL OR char_length(note) <= 2000);

COMMENT ON COLUMN public.external_warehouse_line_pallet_shares.note IS
  'Notatka do konkretnego udziału palety (nie mylić z line_meta.note).';

-- RPC: zapisuje też note z JSON udziałów
CREATE OR REPLACE FUNCTION public.replace_external_warehouse_line_pallet_shares(
  p_zk_link_id uuid,
  p_line_key text,
  p_shares jsonb,
  p_updated_by uuid DEFAULT NULL,
  p_max_qty numeric DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_count integer := 0;
  total_qty numeric := 0;
  item jsonb;
  label text;
  q numeric;
  n integer;
  note_text text;
BEGIN
  IF p_line_key IS NULL OR length(btrim(p_line_key)) = 0 THEN
    RAISE EXCEPTION 'missing_line_key'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_shares IS NULL OR jsonb_typeof(p_shares) <> 'array' THEN
    RAISE EXCEPTION 'invalid_shares'
      USING ERRCODE = 'check_violation';
  END IF;

  n := jsonb_array_length(p_shares);
  IF n > 20 THEN
    RAISE EXCEPTION 'too_many_shares'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(
      'ew_pallet_shares:' || p_zk_link_id::text || ':' || btrim(p_line_key)
    )
  );

  FOR item IN SELECT value FROM jsonb_array_elements(p_shares) AS t(value)
  LOOP
    label := nullif(btrim(item->>'pallet_label'), '');
    BEGIN
      q := (item->>'qty')::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_share_qty'
        USING ERRCODE = 'check_violation';
    END;
    IF label IS NULL OR q IS NULL OR q <= 0 THEN
      RAISE EXCEPTION 'invalid_share_row'
        USING ERRCODE = 'check_violation';
    END IF;
    IF char_length(label) > 80 THEN
      RAISE EXCEPTION 'pallet_label_too_long'
        USING ERRCODE = 'check_violation';
    END IF;
    note_text := nullif(btrim(COALESCE(item->>'note', '')), '');
    IF note_text IS NOT NULL AND char_length(note_text) > 2000 THEN
      RAISE EXCEPTION 'share_note_too_long'
        USING ERRCODE = 'check_violation';
    END IF;
    total_qty := total_qty + q;
  END LOOP;

  IF p_max_qty IS NOT NULL AND total_qty > p_max_qty THEN
    RAISE EXCEPTION 'shares_exceed_line_qty'
      USING ERRCODE = 'check_violation',
            HINT = 'Suma udziałów przekracza ilość pozycji w ZK.';
  END IF;

  DELETE FROM public.external_warehouse_line_pallet_shares
  WHERE zk_link_id = p_zk_link_id
    AND line_key = btrim(p_line_key);

  IF n > 0 THEN
    INSERT INTO public.external_warehouse_line_pallet_shares (
      zk_link_id,
      line_key,
      pallet_label,
      qty,
      note,
      updated_by,
      updated_at
    )
    SELECT
      p_zk_link_id,
      btrim(p_line_key),
      btrim(s->>'pallet_label'),
      (s->>'qty')::numeric,
      nullif(btrim(COALESCE(s->>'note', '')), ''),
      p_updated_by,
      now()
    FROM jsonb_array_elements(p_shares) AS s;

    GET DIAGNOSTICS share_count = ROW_COUNT;

    INSERT INTO public.external_warehouse_line_meta (
      zk_link_id,
      line_key,
      pallet_label,
      updated_by,
      updated_at
    )
    VALUES (
      p_zk_link_id,
      btrim(p_line_key),
      NULL,
      p_updated_by,
      now()
    )
    ON CONFLICT (zk_link_id, line_key) DO UPDATE
    SET
      pallet_label = NULL,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();
  END IF;

  RETURN share_count;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_external_warehouse_line_pallet_shares(
  uuid, text, jsonb, uuid, numeric
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_external_warehouse_line_pallet_shares(
  uuid, text, jsonb, uuid, numeric
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_external_warehouse_line_pallet_shares(
  uuid, text, jsonb, uuid, numeric
) TO service_role;

NOTIFY pgrst, 'reload schema';

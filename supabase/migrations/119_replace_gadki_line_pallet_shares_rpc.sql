-- Atomowe replace-all udziałów palet + advisory lock (ochrona Σqty / delete→insert).

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

  -- Blokada per (link, line_key) — współbieżne save nie mogą „dokleić” udziałów.
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
      updated_by,
      updated_at
    )
    SELECT
      p_zk_link_id,
      btrim(p_line_key),
      btrim(s->>'pallet_label'),
      (s->>'qty')::numeric,
      p_updated_by,
      now()
    FROM jsonb_array_elements(p_shares) AS s;

    GET DIAGNOSTICS share_count = ROW_COUNT;

    -- Przy aktywnym rozbiciu źródłem prawdy są shares — nulluj meta.pallet_label.
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

  -- n = 0: tylko usunięcie udziałów; meta.pallet_label NIE jest zerowane
  -- (żeby puste „Zapisz rozbicie” nie kasowało zwykłego przypisania 1:1).

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

COMMENT ON FUNCTION public.replace_external_warehouse_line_pallet_shares(
  uuid, text, jsonb, uuid, numeric
) IS
  'Atomowe replace-all udziałów palet pozycji ZK (advisory xact lock + opcjonalny limit Σqty).';

NOTIFY pgrst, 'reload schema';

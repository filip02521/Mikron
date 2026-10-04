-- 165_copy_replace_em_dash.sql
-- Odświeżenie UI: w widocznym copy zamiast półpauzy / pauzy (— –) używamy zwykłego dywizu (-).
-- Kod generuje już nowe teksty z „-”; ta migracja poprawia dane zapisane wcześniej w bazie:
--   * mail_job_definitions — etykiety, opisy i harmonogram jobów (seed z 142_mail_center.sql),
--   * external_warehouse_change_log.summary — historyczne wpisy dziennika Magazynu Gądki.
-- Idempotentna: drugi przebieg nie znajdzie już żadnych znaków do zamiany.

UPDATE public.mail_job_definitions
SET
  label = regexp_replace(regexp_replace(label, '\s+[—–]\s+', ' - ', 'g'), '[—–]', '-', 'g'),
  description = regexp_replace(regexp_replace(description, '\s+[—–]\s+', ' - ', 'g'), '[—–]', '-', 'g'),
  schedule_label = regexp_replace(regexp_replace(schedule_label, '\s+[—–]\s+', ' - ', 'g'), '[—–]', '-', 'g')
WHERE label ~ '[—–]' OR description ~ '[—–]' OR schedule_label ~ '[—–]';

UPDATE public.external_warehouse_change_log
SET summary = regexp_replace(regexp_replace(summary, '\s+[—–]\s+', ' - ', 'g'), '[—–]', '-', 'g')
WHERE summary ~ '[—–]';

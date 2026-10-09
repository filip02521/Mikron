-- 181_drop_google_shared_mailboxes.sql
-- Skrzynka wspólna (office@) wycofana — maile DHL i dostawców czytamy tylko ze skrzynek osób,
-- które połączyły swojego Gmaila. Przesyłki DHL już założone z office@ zostają (customs_dhl_*).

DROP TABLE IF EXISTS public.google_shared_mailboxes;

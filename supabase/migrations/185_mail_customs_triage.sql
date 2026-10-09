-- 185_mail_customs_triage.sql
-- Maile agencji celnych i spedytorów idą do odpraw celnych (/zakupy/odprawy), nie na tablicę spraw:
-- triage 'customs' i reguła nadawcy 'customs'. Startowe domeny znanych firm; resztę dopisuje półka
-- „Do przejrzenia” (przycisk „Odprawa / spedycja”). Reguły zapisane już przez użytkownika wygrywają.

ALTER TABLE public.supplier_mail_messages DROP CONSTRAINT IF EXISTS supplier_mail_messages_triage_check;
ALTER TABLE public.supplier_mail_messages
  ADD CONSTRAINT supplier_mail_messages_triage_check CHECK (triage IN ('review', 'case', 'ignored', 'customs'));

ALTER TABLE public.mail_sender_rules DROP CONSTRAINT IF EXISTS mail_sender_rules_decision_check;
ALTER TABLE public.mail_sender_rules
  ADD CONSTRAINT mail_sender_rules_decision_check CHECK (decision IN ('case', 'ignore', 'customs'));

INSERT INTO public.mail_sender_rules (pattern, decision) VALUES
  ('@dhl.com', 'customs'),
  ('@dhlexpress.pl', 'customs'),
  ('@hartrodt.com', 'customs'),
  ('@fracht.com', 'customs'),
  ('@suus.com', 'customs'),
  ('@kuehne-nagel.com', 'customs'),
  ('@dfds.com', 'customs')
ON CONFLICT (pattern) DO NOTHING;

-- Półka: to, co już na niej leży od tych firm (także z poddomen, np. pl.fracht.com).
UPDATE public.supplier_mail_messages m SET triage = 'customs'
  FROM public.mail_sender_rules r
 WHERE m.triage = 'review' AND r.decision = 'customs' AND r.pattern LIKE '@%'
   AND (lower(m.from_address) LIKE '%' || r.pattern OR lower(m.from_address) LIKE '%.' || substr(r.pattern, 2));

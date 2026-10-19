-- 188_mail_offers_acks.sql
-- Poczta dostawców — dokładniejsze sito:
-- 1. category 'offer': reklamy i newslettery dostawców z kart leżą na półce „Oferty” (wcześniej pomijane).
-- 2. Potwierdzenia odbioru z systemów zgłoszeń („potwierdzamy, że wiadomość dotarła”) to autoodpowiedzi —
--    nie zamykają czekania na odpowiedź do ZD.
-- 3. „RE: … invoice 274…” bez pliku to rozmowa, nie faktura do wpisania do Subiekta.
-- Kroki 2–3 przeliczają tylko zapisane wiadomości; nowe klasyfikuje synchronizacja (lib/google/gmail, supplier-mail/match).

ALTER TABLE public.supplier_mail_messages DROP CONSTRAINT IF EXISTS supplier_mail_messages_category_check;
ALTER TABLE public.supplier_mail_messages
  ADD CONSTRAINT supplier_mail_messages_category_check
  CHECK (category IN ('reply', 'confirmation', 'invoice', 'shipping', 'offer'));

UPDATE public.supplier_mail_messages
   SET kind = 'auto'
 WHERE kind = 'supplier'
   AND snippet ~* '(potwierdzamy,? (że|iż) (pa[ńn]stwa |twoja )?wiadomo[śs][ćc] dotar|wiadomo[śs][ćc] (zosta[łl]a )?(przyj[ęe]ta|zarejestrowana)|zg[łl]oszenie (zosta[łl]o )?(przyj[ęe]te|zarejestrowane)|we( have|''ve) received your (message|e-?mail|request|inquiry|enquiry)|your (message|request|ticket|inquiry) has been (received|logged)|this is an automated (message|response|reply|confirmation)|wir haben ihre (nachricht|anfrage|e-?mail) erhalten)';

UPDATE public.supplier_mail_messages
   SET category = 'offer'
 WHERE kind = 'supplier'
   AND case_kind IS NULL
   AND category IN ('reply', 'confirmation')
   AND subject !~* '^\s*(re|odp|aw|r|antwort|sv)\s*:'
   AND subject !~* '(zmian\w* cen|podwy[żz]k\w* cen|now\w* cennik|cennik 20\d\d|price (change|increase|adjustment|list)|preis(änderung|erhöhung|anpassung|liste)|aumento (dei )?prezzi|listino)'
   AND subject ~* '(promocj|promotion|newsletter|webinar|black friday|oferta hurtowa|wyprzeda[zż]|nowo[śs][ćc]|nowo[śs]ci|w ofercie|zapas[óo]w|wyczerpuj|rabat|discount|special offer|sonderangebot|black week|\m\d ?\+ ?\d\M)';

-- „Faktura do opłacenia” w temacie zostaje fakturą (prośba o zapłatę). Z ostatnich 7 dni rozmowy trafiają do
-- Do zrobienia (do przejrzenia); starsze — jako załatwione, żeby nie zasypały tablicy.
UPDATE public.supplier_mail_messages
   SET category = 'reply',
       handled_at = CASE WHEN received_at < now() - interval '7 days' THEN COALESCE(handled_at, received_at) ELSE handled_at END,
       handled_via = CASE WHEN received_at < now() - interval '7 days' THEN COALESCE(handled_via, 'manual') ELSE handled_via END
 WHERE category = 'invoice'
   AND subject ~* '^\s*(re|odp|aw|r|antwort|sv)\s*:'
   AND subject !~* '(op[łl]ac|zap[łl]at|\mpay|zahlung|bezahl)'
   AND NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(attachments) a
      WHERE coalesce(a ->> 'filename', '') !~* '\.(png|jpe?g|gif|bmp|webp)$'
   );

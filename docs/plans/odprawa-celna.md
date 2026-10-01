# Odprawa celna importu — plan

Cel: z ZD (Subiekt) i faktury dostawcy spoza UE przygotować dane dla agencji celnej —
opis PL, materiał, kod CN, stawka VAT, załączniki — w formacie maila, którego już
używamy (przykład: Aswad, faktura AI/3177/26), plus Excel i edycja w aplikacji.

## Zasady

- **Źródło pozycji = faktura dostawcy** (to ją widzi urząd). ZD z Subiekta daje polskie
  nazwy i kontrolę ilości; dopasowanie po kodzie artykułu dostawcy (np. `DE-1196`), potem po nazwie.
- **Pamięć decyzji** — `customs_product_cards` (dostawca + kod artykułu). Zatwierdzona karta
  wypełnia pozycję w kolejnych odprawach i jest oznaczona „Zatwierdzone wcześniej”.
  Historia zmian: `customs_product_card_events`.
- **VAT 8% tylko z dokumentem** — artykuł musi być wymieniony w dokumencie z karty dostawcy
  (np. Annex A deklaracji zgodności → `customs_document_articles`). Taki dokument jest
  automatycznie dołączany do maila. Bez dokumentu: 23%. Rozbieżność karta ↔ dokument → ostrzeżenie.
- **Migawka wysłanych danych** — `customs_clearance_lines.sent_snapshot`; późniejsza edycja karty
  nie zmienia historii odprawy.

## Stany pozycji w widoku

| Stan | Znaczenie |
| --- | --- |
| Zatwierdzone wcześniej | karta zatwierdzona, zgodna z dokumentami |
| Zmieniło się | karta zatwierdzona, ale dokumenty dostawcy mówią co innego |
| Propozycja | AI / skopiowane z podobnego artykułu — do zatwierdzenia |
| Brak | nowy artykuł, trzeba uzupełnić |

## Etapy

1. **Fundament** ✅: migracja `158_customs_clearance.sql`, logika w `src/lib/customs/`
   (normalizacja kodów, reguła VAT, stany, mail w formacie Mikranu z zakresami „8-9.”, lista załączników), testy na Aswad.
2. **Widok odprawy** ✅ — `/zakupy/odprawy` (menu: Dostawcy → Odprawy celne): wybór dostawcy (IMPORT)
   i ZD z Subiekta (ostatnie 120 dni) lub wklejenie pozycji faktury z Excela/PDF → pozycje z edycją
   i zatwierdzaniem kart („Jak poz. N” kopiuje opis z poprzedniej) → lista artykułów z deklaracji
   (wklejana per dokument) → mail + załączniki → Excel → „Oznacz jako wysłane” (migawka w historii).
   Kod artykułu z ZD: `tw_DostSymbol` (symbol u dostawcy), gdy API go zwraca, inaczej `tw_Symbol`.
3. **AI (Gemini)** ✅ — działa, gdy ustawiony `GOOGLE_AI_API_KEY` (ten sam co OCR zębów):
   - „Faktura PDF / skan — odczyt AI” w nowej odprawie: numer, data, waluta, suma, kod HS, kraj
     pochodzenia i pozycje trafiają do formularza do przejrzenia; plik dołącza się do odprawy.
   - „Odczytaj kody (AI)” przy dokumencie dostawcy: lista artykułów z Annex A do przejrzenia i zapisu.
   - „Zaproponuj opisy (AI)”: opis PL / materiał / CN dla nowych pozycji, z przykładami zatwierdzonych
     kart dostawcy jako wzorcem. Karta dostaje status „Propozycja AI”; VAT nadal wynika z dokumentów.
     Karty ręczne i zatwierdzone są pomijane. AI nigdy nie zatwierdza — tylko proponuje.
4. **Dopracowanie** ✅ (migracja `159_customs_clearance_agency_email.sql`):
   - „Wyślij do agencji” — mail z treścią z podglądu, załączniki: faktura, dokumenty podstawy VAT 8%,
     opcjonalnie Excel; kopia i odpowiedzi do osoby wysyłającej; adres agencji zapamiętany z ostatniej
     wysyłki. Po wysyłce odprawa zamyka się jako wysłana (adres i Message-ID w historii).
   - „Wysłałem ręcznie” — zamknięcie bez wysyłki z aplikacji.
   - Historia: filtr listy po dostawcy, statusie i numerze faktury/ZD; data zatwierdzenia przy pozycji.

## Do sprawdzenia w Subiekt API (lokalnie, w sieci firmowej / VPN)

Chmura nie widzi `192.168.0.140`, więc te zapytania trzeba uruchomić u siebie:

```bash
B=http://192.168.0.140:5080/api/v1
curl -s $B/docs | head -c 2000                    # OpenAPI — lista pól
curl -s "$B/documents/zd?limit=5"                 # ostatnie ZD (id)
curl -s $B/documents/zd/<id_ZD_Aswad>             # pozycje: czy jest kod dostawcy?
curl -s $B/products/<ob_TowId_z_pozycji>          # karta towaru: pola dostawcy, CN/PKWiU, waga, kraj
```

Szukamy: numeru artykułu u dostawcy (np. `DE-1196`), kodu CN / PKWiU, stawki VAT, masy, kraju pochodzenia.

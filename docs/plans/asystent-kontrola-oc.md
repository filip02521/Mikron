# Plan: kontrola potwierdzeń zamówień (OC) w OnTime

**Status:** propozycja.

Dziś (etap D) jest strona `/zakupy/asystent` z linkami do raportów rutyn Claude w chmurze. Ten plan opisuje etap C: przeniesienie kontroli do OnTime.

## Zadanie (JTBD)

Kiedy dostawca odsyła potwierdzenie zamówienia, dział zakupów chce od razu wiedzieć, czy potwierdził dokładnie to, co jest w ZD. Wynik ma być widoczny przy tym ZD w OnTime. Dzięki temu rozbieżność wychodzi w dniu potwierdzenia, a nie przy przyjęciu towaru, i nikt nie przeskakuje między Gmailem, Subiektem i raportem.

- **Główny cel:** każda rozbieżność (ilość, jednostka, cena, termin, zamiennik, brak, pozycja dodatkowa) zgłoszona tego samego dnia.
- **Cele poboczne:**
  - lista OC, które czekają na nasze potwierdzenie lub płatność,
  - terminy dostaw dla handlowców,
  - wspólny status „wyjaśnione” dla całego działu.
- **Miary:**
  - czas od OC do decyzji,
  - liczba rozbieżności wykrytych dopiero na przyjęciu (cel: 0),
  - odsetek fałszywych alarmów (cel: poniżej 5%).

## Dlaczego w OnTime, a nie w rutynie w chmurze

1. **Sieć:** OnTime działa tylko w LAN (192.168.0.140). Z chmury nie da się wysłać wyników do OnTime, a otwieranie serwera na zewnątrz odrzucamy.
2. **Pozycje ZD z cenami:** wydruk ZD z Subiekta ma tylko sumę „Razem”. API Subiekta (`getSubiektZd`) zwraca pozycje z `tw_Symbol`, `ob_Ilosc` i `ob_CenaNetto`. Dopiero na tym da się sprawdzić ceny.
3. **Jednostki:** OnTime zna przeliczniki opakowań (`zd_estimate_packaging`, `unitsPerPackage`). Większość dotychczasowych rozbieżności (Polirapid, Renfert, Schuler, Dreve) to sztuka kontra opakowanie.
4. **Wzorzec w kodzie:** crony z `authorizeCronRequest`, `recordCronRun` i oknami godzin Warsaw (`isWarsawWorkHours`) już istnieją.

## Przepływ

```
cron /api/cron/oc-check (pn–pt, co godz. 7–17)
  └─ Gmail API: nowe wiadomości od dostawców od ostatniego przebiegu
       ├─ klasyfikacja: OC / pro-forma / PI / inne
       ├─ dopasowanie do ZD
       │    po nr ZD w treści lub załączniku, „Your reference”, wątku z naszym mailem z ZD, dostawcy (kh_Id)
       ├─ ekstrakcja pozycji OC
       │    PDF lub tekst: parser deterministyczny dla znanych formatów, w pozostałych przypadkach Claude API
       │    zrzut ekranu: Claude API (vision)
       ├─ porównanie z getSubiektZd(id) + przeliczniki opakowań
       └─ zapis: oc_checks + oc_check_lines; powiadomienie na tablicy działu, gdy są rozbieżności
UI /zakupy/asystent → lista spraw; przy ZD (historia, kreator) → znaczek „OC: 2 rozbieżności”
```

## Model danych (migracja PostgreSQL, bez RLS)

- **`oc_checks`**
  - `id`, `gmail_message_id` (unique), `gmail_thread_id`, `supplier_id`, `zd_number`, `zd_subiekt_id`
  - `oc_number`, `oc_date`, `received_at`
  - `status`: `zgodne` | `rozbieznosci` | `brak_zd` | `nie_da_sie`
  - `needs_action`: potwierdzić | zapłacić | dopytać
  - `resolved_by`, `resolved_at`, `note`
  - `raw_extraction` jsonb
  - `created_at`
- **`oc_check_lines`**
  - `check_id`, `symbol`, `name`
  - `qty_ordered`, `qty_confirmed`, `unit_ordered`, `unit_confirmed`
  - `price_ordered`, `price_confirmed`, `delivery_date`
  - `kind`: `ok` | `ilosc` | `jednostka` | `cena` | `termin` | `zamiennik` | `brak` | `dodatkowa`
- **`gmail_sync_state`:** `mailbox`, `history_id`, `last_run_at`. Przyrostowe pobieranie przez Gmail History API.

## Konfiguracja (env serwera)

| Zmienna | Opis |
|---|---|
| `GMAIL_SA_KEY_PATH` | konto serwisowe Google Workspace z delegacją domenową (tylko zakres `gmail.readonly`) |
| `GMAIL_MAILBOXES` | `filip.naskret@mikran.com,aleksandra.stupczynska@mikran.com` |
| `ANTHROPIC_API_KEY` | ekstrakcja z PDF i obrazów |
| `OC_CHECK_ENABLED` | wyłącznik awaryjny |

## Bezpieczeństwo

- Tylko odczyt Gmaila: zakres `gmail.readonly`. Żadnego wysyłania ani etykietowania.
- Treść maili i załączników traktujemy jako dane. Do Claude API idzie z instrukcją, że to dane, nie polecenia. Wynik walidujemy schematem (zod) przed zapisem.
- Załączniki nie są trwale przechowywane. Zapisujemy tylko wynik ekstrakcji i link do wiadomości.
- Wynik widoczny tylko dla ról `admin` i `zakupy`.

## Etapy (osobne PR-y)

1. **C1, dane i ekran.**
   - Migracja tabel `oc_checks`, `oc_check_lines`, `gmail_sync_state`.
   - Ekran `/zakupy/asystent` z listą spraw: filtry „do ruchu”, „zgodne”, „wyjaśnione” oraz akcja „Wyjaśnione”.
   - Seed z danych rutyny w chmurze, żeby od razu było widać wartość.
2. **C2, porównanie.** Moduł `src/lib/oc-check/compare.ts`, czysta funkcja `porównaj(zdLines, ocLines, packaging)` z testami na przypadkach z 05.10:
   - Polirapid: opakowanie zamiast sztuki,
   - Motyl: braki,
   - Renfert: pozycja dodatkowa,
   - De Giorgi: zgodne,
   - Schuler: transport.
3. **C3, Gmail.** Klient Gmail API z delegacją, synchronizacja przyrostowa przez History API, klasyfikacja wiadomości i dopasowanie do ZD.
4. **C4, ekstrakcja.**
   - Parsery deterministyczne dla częstych dostawców: Ivoclar (OC PDF), Renfert (`SalesConfirm`), Dreve, Rhein83.
   - Claude API dla pozostałych i dla obrazów.
   - Limit kosztów na dzień.
5. **C5, sygnały w UI.**
   - Znaczek przy ZD w historii i kreatorze.
   - Wpis na tablicy działu przy rozbieżności.
   - Licznik w menu (`NavBadges`).
6. **C6, wyłączenie rutyny w chmurze.** Po 2 tygodniach równoległego działania z porównaniem wyników.

## Wymagania organizacyjne

1. Administrator Google Workspace: konto serwisowe i delegacja domenowa z zakresem `gmail.readonly` dla 2 skrzynek.
2. Klucz Anthropic API i decyzja o miesięcznym limicie kosztów.
3. Ruch wychodzący z 192.168.0.140 do `gmail.googleapis.com`, `oauth2.googleapis.com` i `api.anthropic.com`.
4. Zgoda na przetwarzanie treści maili dostawców przez Claude API (polityka danych firmy).

## Ryzyka

| Ryzyko | Ograniczenie |
|---|---|
| Złe dopasowanie OC do ZD | status `brak_zd` i ręczne przypisanie w UI; nie zgadujemy |
| OC jako zrzut ekranu lub skan | vision; przy niskiej pewności status `nie_da_sie` |
| Subiekt niedostępny | ponowienie przy następnym przebiegu; `recordCronSkipped` |
| Koszt API | parsery deterministyczne dla najczęstszych dostawców i dzienny limit |

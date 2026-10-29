# Plan: comiesięczne zgłoszenia ROL do Ivoclara

**Status: plan zatwierdzony (2026-10-29), decyzje P1–P8 w §10.** Plasterki 1–2 w kodzie: migracja `204_rol_reports.sql`, `src/lib/rol/*` (skan, scalanie, walidacja, widok), akcje `src/app/actions/rol.ts`, zakładka „Zgłoszenia ROL” w Asystencie („Sprawdź ponownie”, Ustawienia ROL). Plasterek 3 w kodzie: wyłączanie FS i pozycji, ilość ręczna, numer katalogowy, przypisanie FS z konfliktem do klienta, „Zatwierdź listę” / „Edytuj listę” (`src/lib/rol/review.ts`, `RolBatchDetail.tsx`); ponowny skan zachowuje tylko jawne decyzje użytkownika. Plasterek 4 w kodzie: arkusz XLSX wg wzoru (`sheet.ts`), PDF-y FS pobierane w tle po skanie do `rol_fs_pdfs` (migracja 205, `pdfs.ts`), „Pobierz arkusz” i „Pobierz pliki (ZIP)” (`/api/zakupy/rol/[batchId]/pliki`). Plasterek 0 zrobiony (wyniki w §9); otwarte tylko: czy opis ZD (`uwagi`) widać w Subiekcie.

Nazwy klientów, adresy, NIP-y i adresy e-mail w tym pliku są zmyślone albo opisane rolą (repo jest publiczne). Prawdziwe wartości trafią do tabeli konfiguracji w bazie (`rol_programs`), nie do kodu.

## 1. Co dziś robimy ręcznie (wzór z Gmaila)

Przeanalizowane wysłane maile: marzec, lipiec, 1 i 15 października 2026 oraz notatka przekazania obowiązków z marca. Wnioski:

**Czym jest zgłoszenie.** To nie jest raport sprzedaży, tylko **zamówienie uzupełniające do Ivoclara** z dodatkowym rabatem **−25%** w programie *Regional Opinion Leader (ROL)*. Dwa laboratoria mają status ROL. Na początku miesiąca zamawiamy u Ivoclara dokładnie te produkty Ivoclar, które ten klient kupił od nas w poprzednim miesiącu, a jako dowód dokładamy jego faktury sprzedaży (FS).

**Mail.**

| Element | Wzór |
|---|---|
| Do | skrzynka zamówień Ivoclar (MB LI Orders PL) + opiekunka klienta i osoba z obsługi zamówień Ivoclar Polska |
| DW | czasem osoby z naszych zakupów |
| Temat | `New Order` (Ivoclar odpowiada w tym wątku, dopisując numery potwierdzeń: `AW: New Order / 38xxxxxx`) |
| Treść | po angielsku, blok na klienta: `ROL <Klient> <Miesiąc> -25%`, adres, NIP |
| Załączniki na klienta | arkusz `ROL <Klient> -25% <month> <rok>.xlsx` (produkty z jego FS jako zamówienie) + każda FS jako PDF `<nr FS> <klient>.pdf` |

Przykład treści (zmyślone dane):

```
Dear Sirs,

Please find attached our new order.

ROL Przykładowa September -25%
ul. Testowa 1, 00-001 Miasto
NIP: 000-000-00-00

ROL Wzorcowa September -25%
ul. Próbna 2, 00-002 Miasto
NIP: 000-000-00-00

Thank you,
<podpis z Ustawień → Gmail>
```

**Co dzieje się potem.** Ivoclar odsyła potwierdzenia zamówienia (OC, PDF) w tym samym wątku; trzeba sprawdzić, czy na OC jest dodatkowy rabat (notatka przekazania: „pilnujemy na potwierdzeniu, czy jest uwzględniony ten dodatkowy rabat”). Błąd kończy się korektą faktury Ivoclara.

**Gdzie dziś boli (z prawdziwych maili).**

1. Przegląd całego miesiąca FS ręcznie, klient po kliencie.
2. Ręczne przepisywanie pozycji FS do arkusza zamówienia i nazywanie plików.
3. **Pomylenie klientów:** 1 października lista jednego klienta trafiła do arkusza drugiego, a lista drugiego nie została wysłana wcale. Naprawa: mail z przeprosinami, korekta rabatu po stronie Ivoclara, osobne dosłanie zamówienia 15 października (dwa tygodnie opóźnienia).
4. ROL bywa doklejany do zwykłego zamówienia magazynowego (1 października: 15 załączników w jednym mailu), co sprzyja pomyłkom z pkt 3.
5. Ivoclar narzeka na brak swoich numerów katalogowych na naszych fakturach — arkusz zamówienia musi je mieć.

## 2. Praca (JTBD)

```
Rola: Zakupy / import (wysyła zgłoszenie) / Ivoclar — obsługa zamówień (przyjmuje, potwierdza rabat)
Job: Kiedy zaczyna się miesiąc, chcę zgłosić Ivoclarowi dokładnie to, co klienci ROL kupili u nas
     w poprzednim miesiącu, z dowodem w postaci ich faktur, żeby dostać należny rabat bez korekt
     i bez wracania do sprawy.
Kontekst: biurko, 1–5 dzień miesiąca, raz w miesiącu; często w zastępstwie (obowiązek przejęty
     od innej osoby), więc wiedza „jak to się robi” siedzi w starych mailach.
Dane: Gmail (maile 03–10.2026) — prawdziwe; Subiekt i produkcja OnTime — NIEDOSTĘPNE z tej sesji
     (LAN nie odpowiadał), więc liczby FS/miesiąc i identyfikatory klientów to hipotezy (§10).
Dziś: 1. Subiekt: lista FS za miesiąc, filtr po kliencie ⚠ ręcznie, łatwo przeoczyć FS
      2. Wybór pozycji Ivoclar z każdej FS ⚠ pamięć, który towar jest Ivoclara
      3. Przepisanie do arkusza zamówienia ⚠ tu doszło do pomylenia klientów
      4. Wydruk FS do PDF, nazwanie plików
      5. Mail w Gmailu ze wzoru, adresaci z poprzedniego maila
      6. Sprawdzenie OC Ivoclara (rabat) ⚠ łatwo odpuścić
Sukces: – Zminimalizować czas zgłoszenia (dziś ~1–2 h → cel < 10 min przeglądu)
        – Zminimalizować ryzyko pomylenia klientów lub plików (dziś 1 incydent / 3 mies. → 0)
        – Zminimalizować ryzyko pominięcia FS (dziś nie wiemy → 0; system pokazuje każdą FS)
        – Zminimalizować dni od 1. dnia miesiąca do wysłania (dziś 1–15 dni → do 3. dnia roboczego)
Siły: push — ręczne przeglądanie, pomyłka z października / pull — gotowy mail z plikami na klik
      nawyk — doklejanie do zwykłego zamówienia Ivoclar / obawa — że automat źle rozpozna klienta
      lub towar Ivoclara (stąd przegląd przed wysyłką i widoczne FS)
```

## 3. Co już istnieje

| Potrzeba | Jest w repo |
|---|---|
| Lista FS za okres, szczegóły FS z liniami | `searchSubiektOrdersFs`, `getSubiektOrdersFs` w `src/lib/subiekt/api.ts`; `khId` **nie filtruje** listy (docs/integrations/subiekt.md), filtrujemy po `dok_PlatnikId` / `dok_OdbiorcaId`; strona max 200 wierszy |
| Korekty sprzedaży (KFS) | `subiekt_sales_corrections` (migracja 202) — ma towar i ilość, **bez klienta**; trzeba dociągnąć nagłówek KFS |
| Produkty Ivoclar | zakres dostawcy w `zd_estimate_supplier_scopes` (cecha „Ivoclar” albo grupy „Ivoclar Technical/Clinical”); zęby: `manufacturer = ivoclar` w katalogu zębów |
| Wydruk PDF z Subiekta | tylko ZD: `GET /documents/zd/{id}/pdf`. **FS PDF nie ma** w naszej dokumentacji API (§10, P1) |
| Wysyłka z Gmaila osoby z załącznikami | `src/lib/google/gmail.ts` (`buildMimeMessage`, `sendGmailRaw` — upload `message/rfc822`, limit Gmaila 35 MB), połączenia w `gmail-connections.ts`, podpis z Ustawień |
| Wątek odpowiedzi dostawcy | Poczta dostawców (`src/lib/supplier-mail/*`) synchronizuje odpowiedzi; kontrola OC (`oc_checks`, `docs/plans/asystent-kontrola-oc.md`, etap C1) |
| Generowanie XLSX / PDF | `exceljs`, `pdf-lib` w zależnościach |
| Zadania okresowe | dopinamy krok do istniejącego crona (`catalog-zd-sync`), **bez nowego zadania harmonogramu** |
| Ekran | hub `/zakupy/asystent` (rail: Poczta dostawców, Kontrola OC, Raporty) |
| Wysyłki Ivoclar w `/admin/mail` | to inny proces (cotygodniowe raporty FS+PA w osobnym repo „OnTime Raporty”) — nie mieszamy |

## 4. Rekomendacja w jednym akapicie

Nowa sekcja **„Zgłoszenia ROL”** w hubie Asystent. Pierwszego dnia roboczego miesiąca krok w nocnym cronie skanuje FS z poprzedniego miesiąca, osobno dla każdego klienta ROL, wybiera pozycje Ivoclar i zapisuje **paczkę miesiąca** (klient × miesiąc). Osoba z zakupów przegląda listę FS i pozycji, może wyłączyć pozycję lub FS, zatwierdza, a przycisk „Przygotuj mail” składa **osobny mail dla tego klienta** według wzoru z gotowymi plikami (arkusz + PDF-y jego FS). Po edycji wysyła go ze swojego Gmaila, a OnTime w tym samym kroku tworzy w Subiekcie ZD do Ivoclara z tymi pozycjami i opisem „ROL <klient> <miesiąc>”. Na start wszystko idzie po zatwierdzeniu; w ustawieniach programu da się przełączyć na pełny automat (§5 „Tryb automatyczny”). Odpowiedź Ivoclara z OC trafia do Poczty dostawców; w ostatnim plasterku sprawdzamy na OC rabat −25%.

Odrzucone: (a) sam raport do pobrania — nie skraca kroków 3–5; (b) wysyłka bez przeglądu od pierwszego dnia — wbrew zasadzie „pewność danych przed szybkością” i obawie o rozpoznanie klienta; automat jest przełącznikiem na później, po miesiącach wysłanych ręcznie; (c) gotowe komponenty z 21st.dev — DESIGN.md wymaga komponentów z `src/components/ui/`, a ekran składa się z istniejących wzorów (rail Asystenta, `DataTable`, `Status Panel`, `ModalShell`).

## 5. Logika

### Źródło danych i filtr

1. **Okres:** gdy zaczyna się miesiąc, zgłaszamy cały poprzedni (decyzja P7): miesiąc kalendarzowy w strefie Warszawy, `dataOd = 1. dzień`, `dataDo = ostatni dzień`, po `dok_DataWyst` (data wystawienia FS).
2. **Lista FS:** `searchSubiektOrdersFs({ dataOd, dataDo, page, pageSize: 200 })`, strona po stronie do `totalPages` liczonego dla 200. Bez polegania na `khId`.
3. **Klient:** FS należy do programu, gdy `dok_PlatnikId` **albo** `dok_OdbiorcaId` ∈ `rol_programs.kh_ids` (lista, bo klient może mieć kilka kartotek). Gdy płatnik i odbiorca to dwa różne programy — FS idzie na listę „do decyzji”, nie do żadnej paczki.
4. **Linie:** `getSubiektOrdersFs(id)` tylko dla dopasowanych FS (kilka–kilkanaście na klienta).
5. **Produkt Ivoclar:** `ob_TowId` ∈ zbiór `tw_Id` z zakresu dostawcy Ivoclar (cecha/grupy z `zd_estimate_supplier_scopes`), pobierany raz na skan. Wchodzi **cały Ivoclar** (decyzja P4): suma zakresu dostawcy i zębów Ivoclar (`manufacturer = ivoclar` w katalogu zębów). Linie spoza zakresu pokazujemy zwinięte („3 pozycje innych producentów pominięte”), żeby było widać, że nic nie zginęło.
6. **Korekty:** KFS tego klienta z tego samego okresu (i KFS do FS z okresu, wystawione do dnia skanu) odejmujemy od ilości; ujemny wynik → 0 i ostrzeżenie przy pozycji.
7. **Bez progów** (decyzja P8): zgłaszamy każdą pozycję, nawet 1 szt.; programy to tylko skonfigurowani klienci ROL (dziś dwóch).
8. **Agregacja w arkuszu:** suma ilości po symbolu. Symbol w arkuszu to numer Ivoclar (6 cyfr, np. `673261`) — na wzorze zgadza się z symbolem towaru w Subiekcie (`tw_Symbol`); plasterek 0 sprawdza to dla zębów. Symbol pusty albo nie w formacie numeru Ivoclar → pozycja z ostrzeżeniem „bez nr kat. Ivoclar”, blokuje wysyłkę do czasu uzupełnienia w Subiekcie albo ręcznego wpisu.

### Harmonogram

- Krok `rol-month-scan` w istniejącym cronie `catalog-zd-sync` (codziennie): jeśli dziś ≥ 1. dzień roboczy miesiąca i dla poprzedniego miesiąca brak paczki danego programu → skanuj. Nadrabia sam po przerwie serwera.
- **Ponowny skan** automatycznie co noc, dopóki paczka nie jest wysłana (dochodzą FS wystawione z datą wsteczną i KFS). Zmiana po przeglądzie cofa paczkę do „wykryte” z widoczną różnicą („+1 FS od przeglądu”).
- Ręcznie: „Sprawdź ponownie” w sekcji, oraz wybór dowolnego wcześniejszego miesiąca (nadrabianie, test na danych z października).

### ZD w Subiekcie (decyzja P6)

- Każde zgłoszenie to też ZD do Ivoclara w Subiekcie: kontrahent Ivoclar, pozycje = pozycje arkusza (`towarId`, ilość), istniejące `POST /documents/zd/create`.
- Opis dokumentu: `ROL <etykieta programu> <miesiąc>` bez roku (np. „ROL Przykładowa wrzesień”), w polu `uwagi` — jedyne pole opisowe w body tworzenia ZD (`SubiektCreateZdInput`). Plasterek 0 sprawdza, czy to pole widać w Subiekcie tam, gdzie zakupy szukają ZD; jeśli nie, rozszerzamy API.
- Jedna ZD na klienta i miesiąc, nigdy wspólna. Numer ZD zapisany w paczce i widoczny w wierszu klienta.
- Kolejność przy wysyłce: ZD → pliki → mail. Gdy ZD powstała, a mail nie wyszedł, ponowienie nie tworzy drugiej ZD (sprawdza `rol_batches.zd_dok_id`).
- Jak każdy zapis do Subiekta: podgląd w oknie maila (pozycje i opis ZD), weryfikacja po zapisie (odczyt utworzonej ZD i porównanie pozycji).

### Tryb automatyczny (decyzja P5)

- Na start każdy program jest w trybie **„Po zatwierdzeniu”**: poprawki i wysyłka dopiero po „Zatwierdź listę” i „Wyślij”.
- Przełącznik w Ustawieniach ROL, per program: **„Pełny automat”**. Wtedy po nocnym skanie, jeśli paczka nie ma żadnej blokady (brak nr kat., FS „do decyzji”, brak PDF FS, zmiana od poprzedniego skanu), system sam tworzy ZD i wysyła mail z Gmaila osoby wskazanej w ustawieniach (`rol_programs.auto_sender_user_id`; jej połączenie Gmail musi być aktywne).
- Każda blokada zostawia paczkę do zwykłego przeglądu z powodem w Status Panelu. Automat wysyła dopiero po drugim skanie z tym samym wynikiem (FS z datą wsteczną zdążą dojść).
- Włączenie automatu wymaga `ConfirmDialog` i jest logowane; w wierszu klienta odznaka „Automat”.
- Wysłane automatem: `rol_sends.sent_by` = osoba z ustawień, `kind = 'automat'`.

### Stany paczki (klient × miesiąc)

```
            skan                przegląd               wysyłka            (plasterek 7)
  ────────► wykryte ──────────► przejrzane ──────────► wysłane ─────────► potwierdzone
              │  ▲                 │                     │                  │
              │  └─ nowa FS/KFS ───┘                     │                  └─► do korekty
              └─► brak zakupów (0 pozycji Ivoclar)        └─► nowa FS po wysyłce → „Dośli uzupełnienie”
```

| Stan | Znaczenie | Kto zmienia |
|---|---|---|
| `wykryte` | skan znalazł FS i pozycje; czeka na przegląd | cron / „Sprawdź ponownie” |
| `brak_zakupow` | klient nie kupił Ivoclar w miesiącu; nic do wysłania, widoczne dla pewności | cron |
| `przejrzane` | ktoś przejrzał i zatwierdził listę (zapisane kto i kiedy) | użytkownik, „Zatwierdź listę” |
| `wyslane` | ZD utworzona w Subiekcie i mail wyszedł z Gmaila; zapisane numer ZD, message-id, wątek, lista plików i ich suma kontrolna | system po udanej wysyłce (ręcznej albo automatu) |
| `potwierdzone` / `do_korekty` | OC Ivoclara zawiera / nie zawiera −25% (plasterek 7) | kontrola OC / użytkownik |

Cofnięcie z `przejrzane` do `wykryte`: „Edytuj listę”. Z `wyslane` nie ma cofnięcia — tylko „Dośli uzupełnienie” (nowy mail z samymi nowymi FS).

### Edycja przed wysłaniem

- Lista: wyłącz FS albo pojedynczą pozycję (z powodem, np. „zwrot poza systemem”), zmień ilość (stara przekreślona, nowa obok — wzór „Zmiana wartości” z DESIGN.md), dopisz numer katalogowy, gdy brak.
- Mail: adresaci, DW, temat i treść edytowalne w oknie; domyślne z programu (`rol_programs.to_emails` / `cc_emails` — każdy klient ma swoją opiekunkę w Ivoclarze), a gdy program ich nie ma, z `rol_mail_settings`. Załączniki widoczne jako lista plików z rozmiarem; arkusz można pobrać i podejrzeć, ale nie podmienić (zmiana pozycji = zmiana listy, nie pliku).
- **Osobna wiadomość na klienta** (decyzja P3, 2026-10-29). Okno maila dotyczy jednej paczki: jeden blok treści, tylko pliki tego klienta, nazwa klienta w tytule okna i na przycisku wysyłki. Pliki, nazwa pliku i blok treści biorą dane z tej samej paczki — pomyłka z października staje się niemożliwa, także na ekranie.
- Bez Gmaila albo do doklejenia do zwykłego zamówienia: „Pobierz pliki” (ZIP z arkuszami i PDF-ami); oznaczenie „Wysłane ręcznie” wymaga wybrania wysłanego maila z wątków Poczty dostawców albo wpisania daty.

### Błędy i przypadki brzegowe

| Przypadek | Zachowanie |
|---|---|
| Subiekt niedostępny / timeout | skan kończy się błędem z przyczyną, paczka bez zmian; cron ponowi następnej nocy; w sekcji `Alert` „Nie udało się sprawdzić FS — Subiekt nie odpowiada. Spróbuj ponownie.” |
| Część stron FS się nie wczytała | skan nie zapisuje wyniku częściowego (wszystko albo nic); liczba sprawdzonych FS widoczna przy paczce |
| FS anulowana / korekta zerująca | pomijana albo odjęta, z adnotacją przy FS |
| Klient bez zakupów Ivoclar | stan `brak_zakupow`, nic do wysłania |
| Ta sama FS u dwóch programów | lista „do decyzji”, blokuje wysyłkę obu |
| Brak numeru katalogowego Ivoclar | pozycja z ostrzeżeniem, blokuje wysyłkę z powodem widocznym obok przycisku |
| Błąd tworzenia ZD | mail nie wychodzi; komunikat z przyczyną z Subiekta, paczka zostaje `przejrzane`; timeout = stan nieznany, przed ponowieniem szukamy ZD z tym opisem u Ivoclara |
| Brak PDF FS (endpoint nie odpowiada) | paczka może iść bez tej FS tylko po świadomym „Wyślij bez PDF FS 1234”; domyślnie blokada |
| Gmail niepołączony / brak zgody | przycisk „Połącz Gmail” w miejscu wysyłki (Ustawienia → Gmail) |
| Timeout przy wysyłce | stan nieznany, nie „błąd”: sprawdzamy w Wysłanych po własnym Message-ID (`findGmailMessageByRfcId`) zanim pozwolimy wysłać drugi raz |
| Podwójne kliknięcie / dwie osoby naraz | wysyłka blokuje paczkę w bazie (`sending_at`), druga próba dostaje komunikat „Ktoś właśnie wysyła tę paczkę” |
| Rozmiar maila | suma załączników pokazana przed wysyłką; > 20 MB → podział zgłoszenia klienta na dwa maile |
| Nowa FS po wysłaniu | paczka zostaje `wyslane`, pas uwagi „Po wysłaniu doszła 1 FS — dośli uzupełnienie” |
| Zmiana statusu ROL klienta w trakcie roku | `rol_programs.active_from` / `active_to`; skan bierze tylko programy aktywne w danym miesiącu |

### Uprawnienia

- Widok i praca: `admin` i `zakupy` (te same role co hub Asystent; `requireOperations` + sprawdzenie roli w każdej akcji serwera).
- Konfiguracja programów (klienci, kartoteki, rabat, adresaci, szablon): `admin` i `zakupy`, zmiany logowane (kto, kiedy).
- Wysyłka zawsze z Gmaila zalogowanej osoby; nadawca zapisany w paczce. Zastępca widzi pełną historię i może wysłać.
- Po wdrożeniu przegląd agentem `authz-reviewer` dla nowych akcji i tras.

## 6. Model danych (migracja PostgreSQL, bez RLS, granty dla `ontime_app`)

```sql
-- konfiguracja (prawdziwe dane klientów tylko w bazie)
rol_programs (
  id uuid pk, label text,               -- „ROL Przykładowa”
  kh_ids int[] not null,                -- kartoteki klienta w Subiekcie
  discount_pct numeric not null,        -- 25
  address_lines text[], nip text,       -- blok w treści maila
  file_label text,                      -- nazwa w plikach („Przykładowa”)
  to_emails text[], cc_emails text[],   -- adresaci tego klienta (opiekunka w Ivoclarze); puste → domyślne
  send_mode text not null default 'review' check in ('review','auto'),
  auto_sender_user_id uuid null,        -- czyj Gmail wysyła w trybie automatu
  active_from date, active_to date null,
  updated_by uuid, updated_at timestamptz
)
rol_mail_settings (                     -- jeden wiersz, wartości domyślne
  to_emails text[], cc_emails text[], subject_template text, body_template text,
  updated_by uuid, updated_at timestamptz
)

-- paczka miesiąca
rol_batches (
  id uuid pk, program_id fk, period date,          -- 1. dzień miesiąca
  status text check in ('wykryte','brak_zakupow','przejrzane','wyslane','potwierdzone','do_korekty'),
  scanned_at timestamptz, fs_checked_count int,    -- ile FS przejrzał skan
  reviewed_by uuid, reviewed_at timestamptz,
  sending_at timestamptz null,                     -- blokada wysyłki
  zd_dok_id int null, zd_nr text null,             -- ZD do Ivoclara w Subiekcie (P6)
  unique (program_id, period)
)
rol_batch_invoices (batch_id fk, fs_dok_id int, fs_nr text, fs_date date,
                    excluded bool, excluded_reason text, kfs_dok_ids int[])
rol_batch_lines (batch_id fk, fs_dok_id int, subiekt_tw_id int, symbol text,
                 ivoclar_catalog_no text null, name text,
                 qty_fs numeric, qty_kfs numeric, qty_override numeric null,
                 excluded bool, note text)

-- wysyłka (jedna wiadomość = jedna paczka; uzupełnienie to kolejny wiersz tej samej paczki)
rol_sends (id uuid pk, batch_id fk, sent_by uuid, sent_at timestamptz,
           gmail_message_id text, gmail_thread_id text, rfc_message_id text,
           to_emails text[], cc_emails text[], subject text, body text,
           attachments jsonb,                       -- nazwa, rozmiar, sha256
           kind text check in ('zgloszenie','uzupelnienie','reczne','automat'))
```

Pliki (XLSX, PDF FS) generujemy w locie przy podglądzie i wysyłce, nie trzymamy ich w bazie; w `rol_sends.attachments` zostaje suma kontrolna, żeby było wiadomo, co dokładnie wyszło.

## 7. Interfejs

Mode: **Operate**. Ekran z istniejących warstw „Anatomii ekranu”; nowe są tylko treści.

**Miejsce:** `/zakupy/asystent?sekcja=rol`, nowa pozycja w railu Asystenta „Zgłoszenia ROL” z licznikiem paczek do ruchu (`wykryte` + `przejrzane` w bieżącym okresie). Licznik wlicza się do odznaki „Asystent” w menu. Bez nowej pozycji menu (DESIGN.md: „Nowa funkcja trafia do istniejącej strony…”).

**Brief (impeccable shape, zatwierdzony 2026-10-29).** Praca: osoba z zakupów, często w zastępstwie, raz w miesiącu (dni 1–5) przy biurku, wysyła Ivoclarowi dokładnie to, co każdy klient ROL kupił, bez pomylenia klientów. Sukces: osobny mail na klienta z jego arkuszem i wyłącznie jego FS, do 3. dnia roboczego, przegląd < 10 min. Dowód dla przeglądającego: lista FS, które skan znalazł, i liczba FS, które sprawdził. Kierunek: bez nowego świata wizualnego — wzór „Pulpit” + komponenty Asystenta; punkt skupienia to rozwinięcie wiersza klienta (tożsamość, FS, pozycje).

### Desktop (≥ 1024 px)

```
┌ Asystent ──────────────────────────────────────────────────────────────────────────┐
│ Poczta dostawców   (7) │  Zgłoszenia ROL · wrzesień 2026          [wrzesień ▾] [⋯]  │
│ Kontrola OC        (2) │                                                            │
│ Zgłoszenia ROL     (2) │ ┌ Status Panel ─────────────────────────────────────────┐  │
│ Raporty                │ │ 2 zgłoszenia czekają na przegląd                      │  │
│                        │ │ Skan FS 1.10 o 02:14 · sprawdzono 412 FS · Subiekt LIVE│  │
│                        │ │                         [Przejrzyj ROL Przykładowa]   │  │
│                        │ └───────────────────────────────────────────────────────┘  │
│                        │                                                            │
│                        │ ┌ Card ─────────────────────────────────────────────────┐  │
│                        │ │ Klient            FS   Pozycje Ivoclar        Stan     │  │
│                        │ │ ─────────────────────────────────────────────────────  │  │
│                        │ │ ▸ ROL Przykładowa  3   11 pozycji · 24 szt [Do przeglądu]│
│                        │ │ ▾ ROL Wzorcowa     4    9 pozycji · 17 szt [Przejrzane]│  │
│                        │ │   ROL Wzorcowa September -25% · ul. Próbna 2 … · NIP … │  │
│                        │ │   ┌ well ────────────────────────────────────────────┐ │  │
│                        │ │   │ FS 1201 · 04.09 · 3 poz. Ivoclar  [PDF] [Wyłącz]   │ │  │
│                        │ │   │   764338 IPS e.max Zirconia A2 98.5-18   2 szt   │ │  │
│                        │ │   │   …                                             │ │  │
│                        │ │   │   2 pozycje innych producentów pominięte  [Pokaż]│ │  │
│                        │ │   │ FS 1388 · 18.09 · KFS 211 odjęta (−1 szt)        │ │  │
│                        │ │   │ (ikona) 1 pozycja bez nr kat. Ivoclar [Uzupełnij] │ │  │
│                        │ │   └──────────────────────────────────────────────────┘ │  │
│                        │ │          [Edytuj listę]  [Przygotuj mail]              │  │
│                        │ └───────────────────────────────────────────────────────┘  │
│                        │ Historia: sierpień — wysłane 2.09 (J. Kowalska) · lipiec — … │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

- **Status Panel:** zdanie stanu z odmianą liczebnika i wiersz skanu („Skan FS 1.10 o 02:14 · sprawdzono 412 FS”). Jedna główna akcja prowadzi do następnego klienta, który wymaga ruchu: „Przejrzyj ROL Przykładowa” (rozwija jego wiersz) albo „Przygotuj mail · ROL Wzorcowa” (otwiera okno). Gdy nic nie czeka — bez akcji.
- **Tabela:** jeden wiersz na klienta (`DataTable`): klient, FS, „11 pozycji · 24 szt”, stan, a w linii Meta ostatnia zmiana („+1 FS od przeglądu”). **Bez kolumny wartości** (decyzja 2026-10-29): Ivoclar zamawia po nr kat. i ilości, a nasza cena sprzedaży sugerowałaby wartość zamówienia. Szczegóły rozwijane pod wierszem (wzór „Pulpit”), bez drugiej tabeli z tymi samymi danymi.
- **Rozwinięcie:** na górze blok klienta dokładnie tak, jak zobaczy go Ivoclar (etykieta, adres, NIP) — przeglądający sprawdza tożsamość, zanim spojrzy na pozycje. Pod nim FS jako bloki `well` (bez karty w karcie). Akcje zależą od stanu: `wykryte` → „Zatwierdź listę” (outline); `przejrzane` → „Przygotuj mail” (outline) + „Edytuj listę” (ghost). Blokada (brak nr kat., FS „do decyzji”, brak PDF FS) ma powód tekstem obok przycisku; ostrzeżenia ikoną z `StrokeIcons`, nie znakiem ⚠.
- **Stany jako `Badge`:** `wykryte` → `warning` „Do przeglądu” (DESIGN.md: bursztyn = do przejrzenia), `przejrzane` → `info`, `wyslane` → `success`, `brak_zakupow` → `default` „Brak zakupów”, `do_korekty` → `danger`.
- `[⋯]` (`OverflowMenu`): „Sprawdź ponownie”, „Pobierz pliki (ZIP)” — osobno na klienta, „Oznacz jako wysłane ręcznie”, „Ustawienia ROL”.
- **Licznik** w railu i w odznace „Asystent” = liczba wierszy w stanie `wykryte` + `przejrzane`.
- Ładowanie skanu: wiersz stanu z `BrandLoader size="sm"` „Sprawdzam FS za wrzesień w Subiekcie — zwykle ok. 30 s”.

### Okno „Przygotuj mail” (`ModalShell`, szerokie, jeden klient)

```
┌ Zgłoszenie ROL Wzorcowa · wrzesień 2026 ────────────────────────── [×] ┐
│ Od:   jan.kowalski@… (Twój Gmail)                                      │
│ Do:   [skrzynka zamówień Ivoclar] [opiekunka klienta] [+]              │
│ DW:   [+]                                                              │
│ Temat:[New Order                                                    ]  │
│ ┌ Treść ───────────────────────────────────────────────────────────┐   │
│ │ Dear Sirs,                                                        │   │
│ │ Please find attached our new order.                               │   │
│ │ ROL Wzorcowa September -25%                                       │   │
│ │ ul. Próbna 2, 00-002 Miasto · NIP: 000-000-00-00                  │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│ Załączniki (5 · 0,9 MB)                                                │
│   ROL Wzorcowa -25% September 2026.xlsx      15 KB   [Podgląd]         │
│   1201 Wzorcowa.pdf   1244 Wzorcowa.pdf   1388 Wzorcowa.pdf   …        │
│                              [Anuluj]  [Wyślij zgłoszenie ROL Wzorcowa] │
└────────────────────────────────────────────────────────────────────────┘
```

Okno zawsze dotyczy jednej paczki: nazwa klienta w tytule, w treści, w nazwach plików i na przycisku. Adresaci domyślnie z programu klienta. Bez Gmaila w miejscu przycisku jest „Połącz Gmail”. Po „Wyślij” — `ConfirmDialog` („Wyślesz zamówienie ROL Wzorcowa do Ivoclara, 5 załączników”), potem w oknie oś kroków (`ActionTimeline` / `BrandStepMark`): „Pobieram PDF FS z Subiektu” → „Składam arkusz” → „Wysyłam z Gmaila” → „Zapisuję w historii”. Wynik: `NoticeToast` „Wysłano zgłoszenie ROL Wzorcowa za wrzesień · odpowiedź Ivoclara trafi do Poczty dostawców”. Timeout wysyłki → stan nieznany i sprawdzenie w Wysłanych, zanim przycisk znów zadziała.

### Telefon (375 px)

Rail Asystenta zamienia się w przełącznik segmentowy nad treścią (jak dziś). Tabela klientów → lista wierszy (klient, stan, „11 poz. · 3 FS”), rozwinięcie pełnej szerokości; akcja Status Panelu schodzi pod tekst. Okno maila na pełny ekran, przyciski 44 px. Wysyłka z telefonu jest możliwa, ale to scena rzadka — nie optymalizujemy pod nią edycji listy.

### Puste i pierwsze uruchomienie

- Brak skonfigurowanych programów: `EmptyState` „Tu pojawią się comiesięczne zgłoszenia ROL” + akcja „Dodaj klienta ROL”.
- Przed 1. dniem roboczym nowego miesiąca: ostatni wysłany miesiąc + zdanie „Następny skan: 1.11 w nocy”.

## 8. Przepływ (całość)

```
cron catalog-zd-sync (noc) ──► krok rol-month-scan
   └─ dla każdego aktywnego programu, okres = poprzedni miesiąc
        ├─ FS strony po 200 → filtr kh → szczegóły FS → linie Ivoclar → KFS
        └─ upsert rol_batches (+ invoices, lines); różnica po przeglądzie → „wykryte” + diff
UI Asystent → Zgłoszenia ROL
   ├─ przegląd → „Zatwierdź listę” → przejrzane
   └─ „Przygotuj mail” → podgląd i edycja → ConfirmDialog
        ├─ ZD do Ivoclara w Subiekcie (opis „ROL <klient> <miesiąc>”) + weryfikacja
        ├─ PDF FS z Subiekta + XLSX (exceljs) dla tego klienta
        ├─ sendGmailRaw (Gmail osoby) → rol_sends (+ message-id, wątek, sumy plików)
        └─ paczki → wyslane; wątek widoczny w Poczcie dostawców
Poczta dostawców: odpowiedź „AW: New Order / 38…” z OC
   └─ (plasterek 7) porównanie OC z paczką: pozycje i rabat −25% → potwierdzone / do_korekty
```

## 9. Plasterki wdrożenia

Każdy plasterek kończy się zielonym `tsc`, lintem i pełnym zestawem testów jednostkowych; to, co widać w aplikacji, sprawdzamy w podglądzie przy 375 px i na desktopie.

| # | Plasterek | Kryterium akceptacji |
|---|---|---|
| 0 | **Rozpoznanie (bez kodu produkcyjnego)** w LAN | Zapisane w tym pliku: dokładna ścieżka PDF FS w API (P1: endpoint jest) na :5080 i :5082; `kh_Id` obu klientów; czy `tw_Symbol` = numer Ivoclar także dla zębów (P2); czy `uwagi` ZD widać w Subiekcie jako opis (P6); liczba FS w 09.2026 |
| 1 | **Model i konfiguracja**: migracja `NNN_rol_*` (następny wolny numer w chwili wdrożenia; dziś ostatnia to 203), okno „Ustawienia ROL” (programy, adresaci, szablon) | Migracja przechodzi na czystym PostgreSQL i na kopii dev; `ontime_app` ma granty; w UI da się dodać program i adresatów; akcje odrzucają rolę `sales` (test) |
| 2 | **Skaner** (czysta funkcja + odczyt Subiekta), przycisk „Sprawdź miesiąc”, wynik tylko do odczytu | Testy na zmyślonych fixture'ach: stronicowanie po 200 przy `totalPages` > 1, FS po płatniku i po odbiorcy, FS dwóch programów → „do decyzji”, linie spoza Ivoclar pominięte i policzone, KFS odjęta, częściowy błąd strony → brak zapisu. Na LIVE za wrzesień 2026 lista FS zgadza się z FS z maila z 1 i 15.10 (ręczne porównanie numerów) |
| 3 | **Przegląd i stany**: tabela, rozwinięcie, wyłączanie FS/pozycji, zmiana ilości, `wykryte → przejrzane`, ponowny skan z różnicą | Testy przejść stanów (w tym cofnięcie przy nowej FS); w podglądzie: wyłączenie pozycji zmienia liczniki w wierszu i w Status Panelu; brak nr kat. blokuje z widocznym powodem |
| 4 | **Pliki**: XLSX jak wzór (P2) + PDF FS, „Pobierz pliki (ZIP)” | Arkusz „Arkusz1” z kolumnami `Lp, Symbol, Nazwa, Ilość, Jm`, bez cen i bez nagłówka klienta, otwiera się w Excelu; nazwy plików wg wzoru; plik klienta A nigdy nie zawiera pozycji klienta B (test na dwóch paczkach z tym samym towarem) |
| 5 | **ZD i mail**: okno z edycją (jeden klient), podgląd ZD, ConfirmDialog, oś kroków (ZD → pliki → Gmail → historia), `rol_sends`, blokada podwójnej wysyłki, sprawdzenie po timeoucie | Test MIME (adresaci, temat, załączniki, nazwy); okno nie pokazuje plików innego klienta (test); ZD na hoście testowym :5082 z opisem „ROL … wrzesień”; ponowienie po błędzie maila nie tworzy drugiej ZD; wysyłka testowa na własny adres; druga równoległa wysyłka odrzucona |
| 6a | **Tryb automatyczny**: przełącznik per program, `auto_sender_user_id`, wysyłka po skanie bez blokad | Testy: blokada → paczka czeka na przegląd; brak połączenia Gmail → przegląd z powodem; automat nie wysyła drugi raz; włączenie wymaga potwierdzenia |
| 6 | **Harmonogram i licznik**: krok w `catalog-zd-sync`, nocny ponowny skan do wysłania, licznik w railu i menu | Testy „czy należy skanować” (1. dzień roboczy, nadrabianie po przerwie, brak skanu po wysłaniu); liczba w menu = liczba wierszy do ruchu w sekcji |
| 7 | **Kontrola OC rabatu** (po etapie C kontroli OC): dopasowanie odpowiedzi Ivoclara do `rol_sends.gmail_thread_id`, porównanie pozycji i rabatu | Na zmyślonym OC: zgodne → `potwierdzone`; brak −25% → `do_korekty` z pozycjami; ręczne „Potwierdź” działa bez parsera |

**Wynik plasterka 0 (2026-10-29, LIVE :5080, tylko odczyt):**

- **Kartoteki:** oba klienci znalezieni po NIP z wysłanych maili, po jednej kartotece; na FS płatnik = odbiorca. Wartości `kh_Id` wpisuje się w Ustawieniach ROL (nie w repo).
- **Parzystość z wrześniem:** skan po regułach z §5 znajduje dokładnie 7 FS wysłanych mailami z 1 i 15.10 (3 + 4). Pozostałe 17 FS tych klientów we wrześniu nie ma pozycji Ivoclar. Zakres Ivoclar: cecha Kreatora (1607 towarów) + zęby.
- **Symbol:** wszystkie 19 symboli na tych FS i symbole zębów Ivoclar to 6 cyfr = numer Ivoclar (P2 potwierdzone).
- **FS w miesiącu:** 4225 we wrześniu, 3463 w sierpniu (numeracja FS liczy się od nowa co miesiąc — hipoteza „~400” była błędna). Skan miesiąca: 22 strony po 200, ok. 20 s.
- **KFS:** `dok_DoDokId` wskazuje korygowaną FS (typ 2, ten sam klient). `ob_Ilosc` na KFS to ilość zwrócona: suma `ilość × cena FS` zgadza się z wartością netto KFS (sprawdzone na 12 KFS).
- **PDF FS:** `GET /documents/fs/{id}/pdf` działa na :5080 (PDF ok. 70 KB), ale trwa **ok. 45 s na fakturę**; :5082 nie odpowiedział. Subiekt drukuje **po kolei**: przy 2 wydrukach naraz drugi czekał w kolejce i przekroczył 90 s — pobieramy jedną FS naraz. Plasterek 4: pobierać PDF-y w tle zaraz po skanie (kolejka, ponowienia) i trzymać je do wysyłki — nie przy kliknięciu „Wyślij”.
- **Opis ZD:** pole `dok_Uwagi` jest w API dokumentów; czy zakupy widzą je na liście ZD w Subiekcie — do potwierdzenia przez użytkownika przed plasterkiem 5.

Kolejność: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 6a, plasterek 7 osobno. Automat włączamy dopiero po co najmniej jednym miesiącu wysłanym ręcznie przez OnTime. Pierwszy realny użytek: po plasterku 4 („Pobierz pliki” zastępuje kroki 1–4 nawet bez wysyłki z OnTime).

## 10. Decyzje (2026-10-29)

| # | Pytanie | Decyzja |
|---|---|---|
| P1 | PDF FS | Endpoint PDF FS jest już w API Subiekta. Do dopisania w `src/lib/subiekt/api.ts` (wzór: wydruk ZD, `GET /documents/zd/{id}/pdf`); ścieżkę i hosty potwierdza plasterek 0. |
| P2 | Format arkusza | Wzór z września: jeden arkusz „Arkusz1”, kolumny `Lp \| Symbol \| Nazwa \| Ilość \| Jm` (szer. ok. 9 / 7 / 38), Symbol = numer Ivoclar (6 cyfr), Jm „szt.”, bez cen, bez danych klienta w arkuszu. |
| P3 | Jeden mail czy osobno | Osobny mail na klienta, nie doklejamy do zwykłego zamówienia. |
| P4 | Zakres produktów | Cały Ivoclar, łącznie z zębami. |
| P5 | Szkic czy wysyłka | Wysyłka z OnTime; na start poprawki i wysyłka dopiero po zatwierdzeniu, z przełącznikiem programu na pełny automat. |
| P6 | ZD w Subiekcie | Tak: ZD do Ivoclara dla każdego klienta osobno, opis „ROL <klient> <miesiąc>” bez roku. |
| P7 | Data FS | Po wybiciu nowego miesiąca zgłaszamy cały poprzedni (data wystawienia FS). |
| P8 | Progi | Bez progów: zgłaszamy wszystko, tylko dla klientów ROL (dziś dwóch). |
| UI | Kolumna wartości | Bez wartości: ilości i liczba pozycji (shape 2026-10-29). |

Hipotezy z LAN rozstrzygnięte w plasterku 0 (§9).

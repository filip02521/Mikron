# Plan: comiesięczne zgłoszenia ROL do Ivoclara

**Status: plan do akceptacji (2026-10-29). Kodu brak.** Nic z tego nie jest wdrożone; plasterki niżej czekają na decyzję.

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

Nowa sekcja **„Zgłoszenia ROL”** w hubie Asystent. Pierwszego dnia roboczego miesiąca krok w nocnym cronie skanuje FS z poprzedniego miesiąca, osobno dla każdego klienta ROL, wybiera pozycje Ivoclar i zapisuje **paczkę miesiąca** (klient × miesiąc). Osoba z zakupów przegląda listę FS i pozycji, może wyłączyć pozycję lub FS, zatwierdza, a przycisk „Przygotuj mail” składa mail według wzoru z gotowymi plikami (arkusz + PDF-y FS). Po edycji wysyła go ze swojego Gmaila. Odpowiedź Ivoclara z OC trafia do Poczty dostawców; w ostatnim plasterku sprawdzamy na OC rabat −25%.

Odrzucone: (a) sam raport do pobrania — nie skraca kroków 3–5; (b) wysyłka bez przeglądu — wbrew zasadzie „pewność danych przed szybkością” i obawie o rozpoznanie klienta; (c) gotowe komponenty z 21st.dev — DESIGN.md wymaga komponentów z `src/components/ui/`, a ekran składa się z istniejących wzorów (rail Asystenta, `DataTable`, `Status Panel`, `ModalShell`).

## 5. Logika

### Źródło danych i filtr

1. **Okres:** poprzedni miesiąc kalendarzowy w strefie Warszawy, `dataOd = 1. dzień`, `dataDo = ostatni dzień`, po `dok_DataWyst` (data wystawienia FS).
2. **Lista FS:** `searchSubiektOrdersFs({ dataOd, dataDo, page, pageSize: 200 })`, strona po stronie do `totalPages` liczonego dla 200. Bez polegania na `khId`.
3. **Klient:** FS należy do programu, gdy `dok_PlatnikId` **albo** `dok_OdbiorcaId` ∈ `rol_programs.kh_ids` (lista, bo klient może mieć kilka kartotek). Gdy płatnik i odbiorca to dwa różne programy — FS idzie na listę „do decyzji”, nie do żadnej paczki.
4. **Linie:** `getSubiektOrdersFs(id)` tylko dla dopasowanych FS (kilka–kilkanaście na klienta).
5. **Produkt Ivoclar:** `ob_TowId` ∈ zbiór `tw_Id` z zakresu dostawcy Ivoclar (cecha/grupy z `zd_estimate_supplier_scopes`), pobierany raz na skan. Zęby Ivoclar — według decyzji P4. Linie spoza zakresu pokazujemy zwinięte („3 pozycje innych producentów pominięte”), żeby było widać, że nic nie zginęło.
6. **Korekty:** KFS tego klienta z tego samego okresu (i KFS do FS z okresu, wystawione do dnia skanu) odejmujemy od ilości; ujemny wynik → 0 i ostrzeżenie przy pozycji.
7. **Agregacja w arkuszu:** suma ilości po numerze katalogowym Ivoclar. Numer katalogowy: pole symbolu u dostawcy w kartotece (do potwierdzenia, P2); brak numeru → pozycja „bez nr kat. Ivoclar”, blokuje wysyłkę do czasu uzupełnienia w Subiekcie albo ręcznego wpisu.

### Harmonogram

- Krok `rol-month-scan` w istniejącym cronie `catalog-zd-sync` (codziennie): jeśli dziś ≥ 1. dzień roboczy miesiąca i dla poprzedniego miesiąca brak paczki danego programu → skanuj. Nadrabia sam po przerwie serwera.
- **Ponowny skan** automatycznie co noc, dopóki paczka nie jest wysłana (dochodzą FS wystawione z datą wsteczną i KFS). Zmiana po przeglądzie cofa paczkę do „wykryte” z widoczną różnicą („+1 FS od przeglądu”).
- Ręcznie: „Sprawdź ponownie” w sekcji, oraz wybór dowolnego wcześniejszego miesiąca (nadrabianie, test na danych z października).

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
| `wyslane` | mail wyszedł z Gmaila; zapisane message-id, wątek, lista plików i ich suma kontrolna | system po udanej wysyłce |
| `potwierdzone` / `do_korekty` | OC Ivoclara zawiera / nie zawiera −25% (plasterek 7) | kontrola OC / użytkownik |

Cofnięcie z `przejrzane` do `wykryte`: „Edytuj listę”. Z `wyslane` nie ma cofnięcia — tylko „Dośli uzupełnienie” (nowy mail z samymi nowymi FS).

### Edycja przed wysłaniem

- Lista: wyłącz FS albo pojedynczą pozycję (z powodem, np. „zwrot poza systemem”), zmień ilość (stara przekreślona, nowa obok — wzór „Zmiana wartości” z DESIGN.md), dopisz numer katalogowy, gdy brak.
- Mail: adresaci, DW, temat i treść edytowalne w oknie; domyślne z `rol_programs` i ostatniego wysłanego maila. Załączniki widoczne jako lista plików z rozmiarem; arkusz można pobrać i podejrzeć, ale nie podmienić (zmiana pozycji = zmiana listy, nie pliku).
- Jedna wiadomość na miesiąc z blokiem na każdego klienta w stanie `przejrzane` (jak 1 października), z możliwością odznaczenia klienta. Pliki każdego klienta powstają wyłącznie z jego paczki, a nazwa pliku i blok treści biorą nazwę z tej samej paczki — to usuwa pomyłkę z października u źródła.
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
| Brak PDF FS (endpoint nie odpowiada) | paczka może iść bez tej FS tylko po świadomym „Wyślij bez PDF FS 1234”; domyślnie blokada |
| Gmail niepołączony / brak zgody | przycisk „Połącz Gmail” w miejscu wysyłki (Ustawienia → Gmail) |
| Timeout przy wysyłce | stan nieznany, nie „błąd”: sprawdzamy w Wysłanych po własnym Message-ID (`findGmailMessageByRfcId`) zanim pozwolimy wysłać drugi raz |
| Podwójne kliknięcie / dwie osoby naraz | wysyłka blokuje paczkę w bazie (`sending_at`), druga próba dostaje komunikat „Ktoś właśnie wysyła tę paczkę” |
| Rozmiar maila | suma załączników pokazana przed wysyłką; > 20 MB → podział na dwa maile per klient |
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
  active_from date, active_to date null,
  updated_by uuid, updated_at timestamptz
)
rol_mail_settings (                     -- jeden wiersz
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
  unique (program_id, period)
)
rol_batch_invoices (batch_id fk, fs_dok_id int, fs_nr text, fs_date date,
                    excluded bool, excluded_reason text, kfs_dok_ids int[])
rol_batch_lines (batch_id fk, fs_dok_id int, subiekt_tw_id int, symbol text,
                 ivoclar_catalog_no text null, name text,
                 qty_fs numeric, qty_kfs numeric, qty_override numeric null,
                 excluded bool, note text)

-- wysyłka (jedna wiadomość może nieść kilka paczek)
rol_sends (id uuid pk, sent_by uuid, sent_at timestamptz,
           gmail_message_id text, gmail_thread_id text, rfc_message_id text,
           to_emails text[], cc_emails text[], subject text, body text,
           attachments jsonb,                       -- nazwa, rozmiar, sha256
           kind text check in ('zgloszenie','uzupelnienie','reczne'))
rol_send_batches (send_id fk, batch_id fk)
```

Pliki (XLSX, PDF FS) generujemy w locie przy podglądzie i wysyłce, nie trzymamy ich w bazie; w `rol_sends.attachments` zostaje suma kontrolna, żeby było wiadomo, co dokładnie wyszło.

## 7. Interfejs

Mode: **Operate**. Ekran z istniejących warstw „Anatomii ekranu”; nowe są tylko treści.

**Miejsce:** `/zakupy/asystent?sekcja=rol`, nowa pozycja w railu Asystenta „Zgłoszenia ROL” z licznikiem paczek do ruchu (`wykryte` + `przejrzane` w bieżącym okresie). Licznik wlicza się do odznaki „Asystent” w menu. Bez nowej pozycji menu (DESIGN.md: „Nowa funkcja trafia do istniejącej strony…”).

### Desktop (≥ 1024 px)

```
┌ Asystent ──────────────────────────────────────────────────────────────────────────┐
│ Poczta dostawców   (7) │  Zgłoszenia ROL · wrzesień 2026          [wrzesień ▾] [⋯]  │
│ Kontrola OC        (2) │                                                            │
│ Zgłoszenia ROL     (2) │ ┌ Status Panel ─────────────────────────────────────────┐  │
│ Raporty                │ │ 2 zgłoszenia czekają na przegląd                      │  │
│                        │ │ Skan FS 1.10 o 02:14 · sprawdzono 412 FS · Subiekt LIVE│  │
│                        │ │                                   [Przygotuj mail (2)] │  │
│                        │ └───────────────────────────────────────────────────────┘  │
│                        │                                                            │
│                        │ ┌ Card ─────────────────────────────────────────────────┐  │
│                        │ │ Klient          FS   Pozycje Ivoclar  Wartość    Stan  │  │
│                        │ │ ─────────────────────────────────────────────────────  │  │
│                        │ │ ▸ ROL Przykładowa  3    11 (24 szt)    4 812 zł [Wykryte]│
│                        │ │ ▾ ROL Wzorcowa     4     9 (17 szt)    3 105 zł[Przejrzane]
│                        │ │   ┌ well ────────────────────────────────────────────┐ │  │
│                        │ │   │ FS 1201 · 04.09 · 3 poz. Ivoclar  [PDF] [Wyłącz]   │ │  │
│                        │ │   │   764338 IPS e.max Zirconia A2 98.5-18   2 szt   │ │  │
│                        │ │   │   …                                             │ │  │
│                        │ │   │   2 pozycje innych producentów pominięte  [Pokaż]│ │  │
│                        │ │   │ FS 1388 · 18.09 · KFS 211 odjęta (−1 szt)        │ │  │
│                        │ │   │ ⚠ 1 pozycja bez nr kat. Ivoclar   [Uzupełnij]    │ │  │
│                        │ │   │                         [Edytuj listę]           │ │  │
│                        │ │   └──────────────────────────────────────────────────┘ │  │
│                        │ └───────────────────────────────────────────────────────┘  │
│                        │ Historia: sierpień — wysłane 2.09 (J. Kowalska) · lipiec — … │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

- Status Panel: zdanie stanu z odmianą liczebnika, jedna główna akcja. Gdy nic nie jest `przejrzane`, główną akcją jest „Przejrzyj 2 zgłoszenia” (rozwija pierwszy wiersz), a „Przygotuj mail” jest wyłączony z powodem tekstem obok.
- Tabela: jeden wiersz na klienta (`DataTable`), szczegóły rozwijane pod wierszem (wzór „Pulpit”), bez drugiej tabeli z tymi samymi danymi. W rozwinięciu FS jako bloki `well` (bez karty w karcie).
- Stany jako `Badge`: `wykryte` → `info`, `przejrzane` → `default` z ikoną, `wyslane` → `success`, `brak_zakupow` → `default` „Brak zakupów”, `do_korekty` → `danger`.
- `[⋯]` (`OverflowMenu`): „Sprawdź ponownie”, „Pobierz pliki (ZIP)”, „Oznacz jako wysłane ręcznie”, „Ustawienia ROL”.
- Ładowanie skanu: wiersz stanu z `BrandLoader size="sm"` „Sprawdzam FS za wrzesień w Subiekcie — zwykle ok. 30 s”.

### Okno „Przygotuj mail” (`ModalShell`, szerokie)

```
┌ Mail do Ivoclara · wrzesień 2026 ───────────────────────────────── [×] ┐
│ Od:   jan.kowalski@… (Twój Gmail)                                      │
│ Do:   [skrzynka zamówień Ivoclar] [obsługa zamówień] [+]               │
│ DW:   [+]                                                              │
│ Temat:[New Order                                                    ]  │
│ ┌ Treść ───────────────────────────────────────────────────────────┐   │
│ │ Dear Sirs,                                                        │   │
│ │ Please find attached our new order.                               │   │
│ │ ROL Przykładowa September -25%  …                                 │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│ Klienci w tym mailu:  [✓] ROL Przykładowa   [✓] ROL Wzorcowa            │
│ Załączniki (7 · 1,4 MB)                                                │
│   ROL Przykładowa -25% September 2026.xlsx   18 KB   [Podgląd]         │
│   1201 Przykladowa.pdf · 1244 Przykladowa.pdf · …                      │
│   ROL Wzorcowa -25% September 2026.xlsx      15 KB   [Podgląd]         │
│   …                                                                    │
│                                   [Anuluj]  [Wyślij z Gmaila (2 klientów)]│
└────────────────────────────────────────────────────────────────────────┘
```

Po „Wyślij” — `ConfirmDialog` („Wyślesz zamówienie ROL dla 2 klientów do Ivoclara, 7 załączników”), potem w oknie oś kroków (`ActionTimeline` / `BrandStepMark`): „Pobieram PDF FS z Subiektu” → „Składam arkusze” → „Wysyłam z Gmaila” → „Zapisuję w historii”. Wynik: `NoticeToast` „Wysłano zgłoszenie ROL za wrzesień · odpowiedź Ivoclara trafi do Poczty dostawców”.

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
        ├─ PDF FS z Subiekta (P1) + XLSX (exceljs) per klient
        ├─ sendGmailRaw (Gmail osoby) → rol_sends (+ message-id, wątek, sumy plików)
        └─ paczki → wyslane; wątek widoczny w Poczcie dostawców
Poczta dostawców: odpowiedź „AW: New Order / 38…” z OC
   └─ (plasterek 7) porównanie OC z paczką: pozycje i rabat −25% → potwierdzone / do_korekty
```

## 9. Plasterki wdrożenia

Każdy plasterek kończy się zielonym `tsc`, lintem i pełnym zestawem testów jednostkowych; to, co widać w aplikacji, sprawdzamy w podglądzie przy 375 px i na desktopie.

| # | Plasterek | Kryterium akceptacji |
|---|---|---|
| 0 | **Rozpoznanie (bez kodu produkcyjnego)**: odpowiedzi na P1–P5 w LAN | Zapisane w tym pliku: czy jest `GET /documents/fs/{id}/pdf` na :5080/:5082; kolumny wysłanego arkusza ROL; `kh_Id` obu klientów; liczba FS w 09.2026 (do czasu skanu); czy zęby Ivoclar wchodzą |
| 1 | **Model i konfiguracja**: migracja `NNN_rol_*` (następny wolny numer w chwili wdrożenia; dziś ostatnia to 203), okno „Ustawienia ROL” (programy, adresaci, szablon) | Migracja przechodzi na czystym PostgreSQL i na kopii dev; `ontime_app` ma granty; w UI da się dodać program i adresatów; akcje odrzucają rolę `sales` (test) |
| 2 | **Skaner** (czysta funkcja + odczyt Subiekta), przycisk „Sprawdź miesiąc”, wynik tylko do odczytu | Testy na zmyślonych fixture'ach: stronicowanie po 200 przy `totalPages` > 1, FS po płatniku i po odbiorcy, FS dwóch programów → „do decyzji”, linie spoza Ivoclar pominięte i policzone, KFS odjęta, częściowy błąd strony → brak zapisu. Na LIVE za wrzesień 2026 lista FS zgadza się z FS z maila z 1 i 15.10 (ręczne porównanie numerów) |
| 3 | **Przegląd i stany**: tabela, rozwinięcie, wyłączanie FS/pozycji, zmiana ilości, `wykryte → przejrzane`, ponowny skan z różnicą | Testy przejść stanów (w tym cofnięcie przy nowej FS); w podglądzie: wyłączenie pozycji zmienia liczniki w wierszu i w Status Panelu; brak nr kat. blokuje z widocznym powodem |
| 4 | **Pliki**: XLSX z pozycjami (nr kat. Ivoclar, nazwa, ilość) + PDF FS, „Pobierz pliki (ZIP)” | Arkusz otwiera się w Excelu i ma kolumny jak wzór z P2; nazwy plików wg wzoru; plik klienta A nigdy nie zawiera pozycji klienta B (test na dwóch paczkach z tym samym towarem) |
| 5 | **Mail i wysyłka**: okno z edycją, ConfirmDialog, oś kroków, `rol_sends`, blokada podwójnej wysyłki, sprawdzenie po timeoucie | Test MIME (adresaci, temat, załączniki, nazwy); wysyłka testowa na własny adres z kopii dev; druga równoległa wysyłka odrzucona; po timeoucie bez drugiego maila |
| 6 | **Harmonogram i licznik**: krok w `catalog-zd-sync`, nocny ponowny skan do wysłania, licznik w railu i menu | Testy „czy należy skanować” (1. dzień roboczy, nadrabianie po przerwie, brak skanu po wysłaniu); liczba w menu = liczba wierszy do ruchu w sekcji |
| 7 | **Kontrola OC rabatu** (po etapie C kontroli OC): dopasowanie odpowiedzi Ivoclara do `rol_sends.gmail_thread_id`, porównanie pozycji i rabatu | Na zmyślonym OC: zgodne → `potwierdzone`; brak −25% → `do_korekty` z pozycjami; ręczne „Potwierdź” działa bez parsera |

Kolejność: 0 → 1 → 2 → 3 → 4 → 5 → 6, plasterek 7 osobno. Pierwszy realny użytek: po plasterku 4 („Pobierz pliki” zastępuje kroki 1–4 nawet bez wysyłki z OnTime).

## 10. Otwarte pytania (do decyzji przed kodem)

- **P1 — PDF FS.** API Subiekta ma wydruk tylko dla ZD. Czy dopisujemy `GET /documents/fs/{id}/pdf` po stronie API (zalecane: to ten sam wydruk co z Subiekta), czy generujemy własne zestawienie FS w PDF (nie jest fakturą — Ivoclar prosi o faktury)? Sprawdzić też host `:5082`.
- **P2 — format arkusza.** Nie mam treści wysłanych plików `ROL … .xlsx` (Gmail connector nie pobiera załączników). Potrzebny jeden wysłany arkusz: jakie kolumny (nr kat. Ivoclar, nazwa, ilość, cena?) i czy to formularz Ivoclara, czy nasz układ. Skąd brać numer katalogowy Ivoclar (symbol dostawcy w kartotece?).
- **P3 — jeden mail czy doklejanie.** Czy ROL ma iść osobnym mailem (rekomendacja: tak, mniej pomyłek), czy nadal razem ze zwykłym zamówieniem Ivoclar? Jeśli razem — wystarczy „Pobierz pliki”, a wysyłka z OnTime jest opcjonalna.
- **P4 — zakres produktów.** Czy do ROL liczą się wszystkie produkty Ivoclar (łącznie z zębami z szafki konsygnacyjnej), czy tylko technika? Jeden przypadek z marca miał zęby w osobnych formularzach.
- **P5 — „przygotuj” znaczy wyślij czy szkic?** Plan zakłada wysyłkę z OnTime (zakres `gmail.send` już jest). Szkic w Gmailu wymaga nowej zgody `gmail.compose` i ponownego połączenia Gmaila przez każdą osobę.
- **P6 — ZD w Subiekcie.** Czy dla zamówienia ROL tworzymy ZD do Ivoclara w Subiekcie (Kreator ma „Utwórz ZD”), czy ROL żyje tylko w mailu?
- **P7 — data FS.** Miesiąc liczymy po dacie wystawienia czy po dacie sprzedaży (`dok_DataMag`/sprzedaży)? FS wystawiona 1.10 za wrzesień — do którego miesiąca?
- **P8 — progi.** Czy jest minimalna wartość lub ilość, poniżej której nie zgłaszamy?

Hipotezy do sprawdzenia na produkcji / w LAN (ta sesja nie miała dostępu): liczba FS w miesiącu (~400 wg numeracji), czas skanu, to, czy klienci mają po jednej kartotece.

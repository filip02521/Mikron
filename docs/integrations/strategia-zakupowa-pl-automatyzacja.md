# Strategia zakupowa — automatyczne ZD do polskich dostawców (Faza I)

**Dla:** Filip / Tomasz · **Stan na:** 2026-10-23 · **API:** `http://192.168.0.140:5080/api/v1` v2.1.7
**Buduje na:** [`subiekt-abc-xyz-architecture.md`](./subiekt-abc-xyz-architecture.md) (podział API ↔ OnTime),
[`subiekt-abc-xyz-api-gaps.md`](./subiekt-abc-xyz-api-gaps.md) (braki endpointów),
[`../zamowienia-jeden-silnik.md`](../zamowienia-jeden-silnik.md) (silnik `zd-order-engine.ts`).
Ten dokument nie powtarza tamtych — dokłada to, czego brakowało: zakres PL, model zamawiania
okresowego, okno korekty handlowców, auto-tworzenie ZD, bezpieczniki i KPI.

> **Decyzja 2026-10-23 (Filip):** dla polskich dostawców idziemy w automatyzację, świadomie
> odwracając decyzję z 2026-10-03 („ZD tylko świadomie”) — z pełną świadomością stawki: błąd silnika
> to realne braki u klientów albo zamrożony kapitał. Dlatego stopnie autonomii (§4.4), bezpieczniki
> (§3.5) i backtest (§8) są warunkiem, nie dodatkiem.

---

## 1. Podsumowanie menedżerskie

1. **Silnik i automat już istnieją.** OnTime liczy „Do ZD” jednym silnikiem (Kreator, noc, panel Braki)
   i od 21.10 ma automat: strategię per dostawca (`zd_supplier_order_policy`, `max30_90`), propozycje
   ZD co N dni (`zd_auto_proposals`) i akceptację z atomową blokadą tworzenia ZD
   (`create_attempted_at`). Faza I nie buduje nowego silnika — **rozszerza automat z Polkardu
   na polskich dostawców** i dokłada okno handlowców, auto-zatwierdzanie, bezpieczniki i KPI.
2. **Backtest (§8) rozstrzygnął wzór:** `max30_90` (tempo = max(30 d, 90 d), cel = tempo ×
   max(25 d, cykl + L₉₀ + 25% L₉₀)) z **cyklem 7 dni** daje na 10 polskich dostawcach **4,1% towarów
   z zerowym stanem wobec 6,6% w rzeczywistości, przy zapasie o 4% mniejszym**. Podręcznikowy wzór
   (R,S) z zapasem bezpieczeństwa z odchylenia popytu **przegrał** (7,8% dni z brakiem — prawie jak dziś):
   80% towarów to popyt rzadki/nieregularny (*Z) i nowości, dla których założenie normalności nie działa.
3. **ABC/XYZ (wg marży) nie steruje ilościami** — dni celu zależne od klasy nic nie poprawiły (§8).
   Klasy służą do KPI, kolejności przeglądu i flag (np. nowość, AZ z dużą wartością).
4. **Automatyzacja per dostawca, bramkowana per linia.** Linia idzie bez człowieka, chyba że
   złapie ją bezpiecznik (§3.5); dostawca przechodzi na wyższy stopień po 4 cyklach z korektą
   < 10% wartości (§4.4).
5. **Handlowcy dokładają przez istniejące Prośby**, do 14:00 dnia przed wysyłką; sygnał w aplikacji
   (bez maili). Limit +50% ponad wyliczenie, chyba że prośba wskazuje ZK.

## 2. Macierz danych: Subiekt API i OnTime

Sprawdzone na żywo 2026-10-23 (`/api/v1/examples`, `/schema`). „Brak” = nie ma w katalogu
`/examples` v2.1.7.

### 2.1. Co już jest

| Dana | Źródło | Pole | Do czego |
|---|---|---|---|
| Kraj dostawcy | `GET /kontrahenci/dostawcy` | `adr_Panstwo`, `adr_IdPanstwo` (1 = Polska) | **filtr Fazy I** — na pierwszej stronie 185/200 to Polska |
| Stan, rezerwacje, dostępne | `GET /orders/zd/estimate` | `tw_Stan`, `tw_StanRez`, `dostepne` | pozycja zapasu |
| Sprzedaż w oknie | estimate | `sprzedazOkres` (FS+PA+WZ niepowiązane), `sprzedazDziennie` | popyt średni |
| Otwarte ZD (w drodze) | estimate | `otwarteZd` | pozycja zapasu |
| Otwarte ZK | estimate | `otwarteZkBezRez`, `otwarteZkZarezerwowane` | popyt zatwierdzony (dziś tylko info) |
| Dokumenty sprzedaży towaru | `GET /orders/zd/estimate/{towarId}` | linie z `rola`, kontrahent, data | wykrywanie pików z jednego dokumentu |
| Sprzedaż i marża | `GET /reports/sprzedaz/asortyment` | wartość, koszt `ob_WartMag`, zysk, marża; `okres=rok` | **ABC wg wartości i marży** — nowe, nie było w analizie braków |
| Stan na dzień | `GET /products/remanent?naDzien=` | stan + partie | backtest, rotacja w dniach, OOS wstecz |
| ZD / FZ z datami | `GET /documents/zd`, `/documents?typ=1` | `dok_DataWyst`, `dok_DataMag`, `dok_TerminRealizacji` | lead time, OTIF |
| Utworzenie ZD | `POST /documents/zd/create` | Sfera DodajZD | wykonanie |
| PDF ZD | `GET /documents/zd/{id}/pdf` | — | wysyłka do dostawcy |

### 2.2. Co jest w MSSQL, ale API tego nie wystawia

`/schema` pokazuje w `tw__Towar`: `tw_IdPodstDostawca`, `tw_DostSymbol`, `tw_CzasDostawy`,
`tw_StanMin`, `tw_StanMaks`; w `tw_Stan`: `st_StanMin`, `st_StanMax`. `GET /products/{id}` zwraca
tylko id, symbol, nazwę, grupę i stany. **Prośba do Tomasza (P1):** dodać te pola do `/products`
i do linii estimate. `tw_StanMaks` to gotowy sufit (§3.5), `tw_IdPodstDostawca` — kontrola zakresów.

### 2.3. Czego brakuje (bez zmian względem `subiekt-abc-xyz-api-gaps.md`)

| Endpoint | Priorytet | Po co |
|---|---|---|
| `GET /orders/sales/weekly` (tygodnie z zerami, qty + wartość, **max ilość z jednego dokumentu w tygodniu**) | P0 | σ popytu, XYZ, odrzucanie pików bez pobierania dokumentów per towar |
| cena zakupu na towarze (ostatnia z FZ / kartotekowa) | P1 | wartość zapasu, KPI rotacji |
| `GET /products/komplety` | P1 | opakowania z Subiekta |
| `GET /orders/lead-time/stats` | P2 — **zbędny** | OnTime ma już próbki ZD→FZ w `delivery_stats_samples`; σ_L liczymy u siebie |

Nowe względem tamtego dokumentu: pole „max z jednego dokumentu” w weekly — jedno zapytanie
zamiast 4–5 tys. wywołań `estimate/{towarId}`.

### 2.4. OnTime (PostgreSQL)

| Dana | Tabela / moduł | Stan |
|---|---|---|
| Czas dostawy — próbki | `delivery_stats_samples` (`business_days_full`, `order_type`) | jest; p50/p90 w silniku |
| OTIF | próbki + linie ZD vs FZ | **do zbudowania** (on-time jest, in-full nie) |
| Rytm zamówień | `suppliers.interval_weeks`, `computed_next_date` | jest |
| Minimum zamówienia | `suppliers.min_order_value`, `min_order_currency` | jest |
| Próg darmowej dostawy | — | **brak kolumny** (`free_shipping_threshold`) |
| Zakres towarów dostawcy | `zd_estimate_supplier_scopes` (grupa/cecha) | jest; tylko zmapowane (zasada) |
| Profil sprzedaży 12 okien | `zd_sales_profiles` | jest |
| Prośby handlowców | `individual_orders` + ZK watch | jest |
| Wykluczenia, opakowania, pary, BOM | tabele Kreatora | jest |
| Klasy ABC/XYZ | — | **do zbudowania** (`zd_sku_class`, cron miesięczny) |
| Strategia per dostawca | `zd_supplier_order_policy` (`strategy`, `target_days`, `cycle_days`, `auto_proposals`) | jest (mig. 190) |
| Propozycje ZD automatu | `zd_auto_proposals` (linie, wartość, `pending/accepted/rejected/expired`, `final_lines`, `create_attempted_at`) | jest (mig. 190, 193); brakuje statusów okna i dziennika zmian per linia |

## 3. Algorytm

Jednostki: sztuki karty Subiekta; czas w dniach kalendarzowych (dni robocze z próbek przeliczane
jak dziś — weekendy i polskie święta).

### 3.1. Ilość — strategia `max30_90` (istniejąca, `zd-demand-policy.ts`)

```text
tempo  = max(sprzedaż 30 d / 30, sprzedaż 90 d / 90)         podłoga 90 d
R      = cykl propozycji (domyślnie 7 dni; 3 dni tam, gdzie liczba dostaw nie kosztuje)
L      = p90 czasu dostawy (próbki Główne ≥ 5, inaczej 7 dni)
dni    = max(25, R + L + round(0,25·L))
cel    = tempo × dni
Do ZD  = cel − dostępne − otwarte ZD   → opakowania, pary, BOM, prośby, wykluczenia jak dziś
```

Otwarte ZK bez rezerwacji **nie** wchodzą do pozycji (decyzja 2026-10-23): to często same wyceny
i martwe pozycje. Towar pod konkretnego klienta idzie przez prośby.

Odrzucony wariant: `S = d̄·(R+L̄) + z·√((R+L̄)·σ_d² + d̄²·σ_L²)` z poziomem obsługi wg ABC/XYZ.
Przy tym samym zapasie miał 2× więcej dni z brakiem niż `max30_90` (§8). Wraca do rozważenia
dopiero dla klas X, gdy będzie `sales/weekly` — dziś X to 1% towarów.

### 3.2. Klasyfikacja ABC / XYZ (do KPI i flag, nie do ilości)

- **ABC** — zysk z `/reports/sprzedaz/asortyment` za 12 mies. w obrębie zmapowanych zakresów:
  A = do 80% skumulowanego zysku, B = 80–95%, C = reszta (decyzja: marża, nawet kosztem czasu).
- **XYZ** — CV sprzedaży tygodniowej z 52 tygodni: X < 0,5; Y 0,5–1,0; Z > 1,0 albo sprzedaż
  w < 13 tygodniach. **N** = pierwsza sprzedaż < 13 tygodni temu.
- Rozkład w 10 dostawcach (2 302 SKU): AX 13, AY 113, AZ 142, BY 29, BZ 392, CZ 796, N 610.
- Przeliczenie raz w miesiącu w nocy (`zd_sku_class`); ręczne nadpisanie w adminie z powodem.

### 3.3. Piki sprzedaży

`max30_90` sam tłumi jednorazowy pik (cel = 25–30 dni tempa, więc zamawia ułamek dużej faktury,
nie całość). Dodatkowo bezpiecznik „skok” (§3.5) i istniejąca opcja „Wygładź skoki” (profil 12 okien).
Gdy będzie `sales/weekly` z max-z-dokumentu: tydzień, w którym jeden dokument > 60% sprzedaży
i > mediana + 3·MAD, liczony jako mediana + 3·MAD.

### 3.4. Partia: minima i darmowa dostawa (poziom zamówienia, nie towaru)

Po policzeniu wszystkich linii dostawcy:

1. `wartość = Σ qty × cena_zakupu`.
2. Jeśli `wartość < min_order_value` → **nie wysyłać**, chyba że jest linia „pilna”
   (pokrycie < L̄). Bez pilnych: przesunąć na kolejny cykl i zapisać powód.
3. Jeśli `wartość < free_shipping_threshold` i brakuje ≤ 15% → **dopełnić** towarami A/B tego
   dostawcy w kolejności „najmniej dni pokrycia”, każdy najwyżej do `S + d̄·R` (jeden cykl zapasu
   więcej). Jeśli brakuje > 15% → koszt dostawy zamiast mrożenia kapitału; wysłać bez dopełnienia.

### 3.5. Bezpieczniki

| Bezpiecznik | Reguła | Skutek |
|---|---|---|
| **Sufit towaru** | `pozycja + qty ≤ min(tw_StanMaks, tempo · (dni + 30))` | ilość ucięta, znacznik „sufit” |
| **Nowość (N)** | pierwsza sprzedaż < 13 tyg. i wartość linii > 500 zł | linia do akceptacji |
| **Pik sprzedaży** | jeden dokument > 60% sprzedaży 30 d i qty > 2× tempa 90 d × dni | linia do akceptacji |
| **Skok vs ostatni cykl** | qty > 3× średniej z 4 ostatnich ZD tego towaru | linia do ręcznej akceptacji |
| **Wartość ZD** | wartość > 2× mediany 6 ostatnich ZD dostawcy | całe ZD do ręcznej akceptacji |
| **Brak danych** | brak `sprzedazDziennie`, σ albo ceny | fallback do warstwy 0 + flaga; nigdy pusta lista |
| **Korekta handlowca** | §4.3 | — |
| **Subiekt offline** | `isSubiektReachable` = false | brak auto; propozycja zostaje w szkicu |

## 4. Przebieg automatyzacji

### 4.1. Dzień dostawcy (D = dzień wysyłki ZD z harmonogramu)

```text
D−1 06:00  cron „proposals”: dla polskich dostawców z D jutro
           → silnik (§3.1) → zd_auto_proposals (pending)
D−1 06:05  sygnał w panelu handlowców i zakupów: „Jutro ZD do X — dorzuć do 14:00”
D−1 …14:00 handlowcy: Prośby (dokładanie, +qty); zakupy: edycja, wstrzymanie
D−1 14:00  odcięcie: propozycja zamrożona; przeliczenie na świeżych stanach (Przelicz)
D   08:00  auto-zatwierdzenie (tylko dostawca w trybie auto i bez flag ręcznych)
           → POST /documents/zd/create → PDF → mail do dostawcy z istniejącej poczty dostawców
           → post-create jak dziś: harmonogram, prośby, historia ZD
D   08:00  dostawca w trybie „okno”/„ręcznie”: propozycja czeka w panelu dziennym
```

Przy cyklu 7 dni „D” to stały dzień tygodnia dostawcy, nie obecny `interval_weeks` (2–5 tyg.):
backtest pokazał, że cykl dostawcy (P2_Rint) daje 5,5% dni z brakiem wobec 4,1% przy 7 dniach.
Dla dostawców z kosztem dostawy decyduje próg darmowej dostawy (§3.4) — ZD poniżej progu
bez pilnych linii przechodzi na kolejny tydzień.

Godzina odcięcia per dostawca (domyślnie 14:00 dnia poprzedniego) — dla dostawców z dostawą
24 h odcięcie może być w dniu D o 10:00.

### 4.2. Statusy propozycji

Rozszerzenie `zd_auto_proposals.status` (dziś `pending/accepted/rejected/expired`):
`pending → open_for_sales → frozen → accepted (dok_Id) → sent`, boczne `held` (bezpiecznik / ręcznie)
i `deferred` (minimum nieosiągnięte). Każda zmiana linii to wiersz w nowej `zd_auto_proposal_events`
(kto, linia, z ilu na ile, powód) — audyt i źródło KPI „korekta człowieka”. Dzisiejsze
`final_lines` (propozycja vs ZD) zostaje jako podsumowanie.

### 4.3. Handlowcy

- **Wejście:** istniejące Prośby (`/prosba`, ZK watch). Prośba z towarem dostawcy, który ma
  otwartą propozycję, trafia do niej jako linia „prośba” z autorem — nie trzeba nowego ekranu.
- **Limit:** handlowiec może podnieść ilość linii o najwyżej **+50% wyliczenia** (min. +1 opakowanie);
  więcej tylko, gdy prośba wskazuje ZK (numer z ZK watch) — wtedy bez limitu, ale do wysokości
  ilości z ZK. Ponad to → akceptacja zakupów.
- **Nie może:** obniżać ilości poniżej wyliczenia ani usuwać linii (to robią zakupy).
- **Sygnał:** w aplikacji (Pilne sprawy / panel), bez maili — zgodnie z decyzją 2026-10-10.

### 4.4. Stopnie autonomii (dojście do pełnej automatyzacji)

| Stopień | Co robi system | Kto klika | Warunek wejścia |
|---|---|---|---|
| 0 | dziś: Przygotuj ZD liczy na żywo | zakupy | — |
| 1 | propozycja gotowa D−1 (dziś działa dla Polkardu) | zakupy | strategia ustawiona dla dostawcy |
| 2 | okno handlowców, zamrożenie, przeliczenie | zakupy zatwierdzają | 4 tygodnie stopnia 1 |
| 3 | auto-zatwierdzenie linii bez flag bezpieczników (§3.5), reszta czeka | zakupy tylko wyjątki | dostawca: 4 cykle z korektą < 10% wartości |
| 4 | auto-wysyłka maila z PDF | nikt | dostawca: 4 cykle stopnia 3 bez reklamacji |

Każdy dostawca ma własny stopień (kolumna `zd_supplier_order_policy.auto_level`), przełączany w karcie dostawcy.
Cofnięcie stopnia jest automatyczne po: brakach (OOS) w klasie A u tego dostawcy, reklamacji
treści ZD albo nieudanym create.

### 4.5. Zapis i wysyłka

- `POST /documents/zd/create` — istniejąca atomowa blokada `create_attempted_at` (mig. 193):
  propozycja tworzy ZD najwyżej raz, a timeout 180 s ma wynik nieznany — nie ponawiać, nowe
  przeliczenie daje nową propozycję. Auto-zatwierdzenie używa tej samej ścieżki co klik.
- Mail: istniejąca poczta dostawców + `GET /documents/zd/{id}/pdf`. EDI — brak u polskich
  dostawców w tej skali; nie budować.

## 5. KPI

| KPI | Definicja | Źródło | Cel startowy |
|---|---|---|---|
| **OOS klasy A** | % dni-towarów A z `dostepne = 0`, przy sprzedaży w ostatnich 90 dniach | `remanent?naDzien` (dziennie) lub snapshot stock-watch | < 2% |
| **Fill rate z półki** | % ilości z ZK wydanej bez czekania na dostawę | ZK → WZ/FS | > 95% A, > 90% B |
| **Rotacja w dniach** | wartość zapasu / dzienny koszt sprzedaży, per klasa | `remanent` + `asortyment` (koszt) | spadek o 10% w C bez wzrostu OOS A |
| **Martwy zapas** | wartość towarów bez sprzedaży 180 dni | `remanent` + estimate | trend malejący |
| **OTIF dostawcy** | % ZD przyjętych w terminie L̄ + 2 dni **i** w ≥ 98% ilości | ZD vs FZ (`dok_DataMag`, linie) | raportować; próg do degradacji stopnia |
| **Minima osiągnięte** | % ZD ≥ `min_order_value`; % ZD ≥ progu darmowej dostawy | `zd_auto_proposals` | > 90% |
| **Korekta człowieka** | % wartości propozycji zmienionej przez zakupy / handlowców | `zd_auto_proposal_events` | < 10% → kwalifikacja do stopnia 3 |
| **Czas zakupów** | minuty od otwarcia do utworzenia ZD | eventy | spadek |
| **Bezpieczniki** | liczba wstrzymań wg powodu | eventy | obserwować; dużo „sufit” = zły parametr |

## 6. Wdrożenie

Backtest zrobiony (§8). Kolejność: najpierw tryb z akceptacją na 10 dostawcach, automat dopiero
po pomiarze na żywo. Szczegółowy plan zadań: `TASKS.md` → „Automat ZD — polscy dostawcy”.

| # | Krok | Kryterium odbioru |
|---|---|---|
| 0 | Domknąć Polkard (TASKS F): testy, review, authz, migracje 190/193 na produkcji | migracje na produkcji, propozycje Polkardu powstają |
| 1 | Flaga „polski dostawca” z `adr_IdPanstwo = 1`; `free_shipping_threshold`, `auto_level`, `cutoff_time` | lista PL w karcie dostawcy = Subiekt |
| 2 | `max30_90`, cykl 7 d, `auto_proposals` dla 10 dostawców z backtestu (stopień 1) | propozycja co tydzień; Kreator i propozycja dają tę samą listę |
| 3 | Bezpieczniki §3.5 jako flagi linii w propozycji | linia z flagą widoczna i liczona w KPI |
| 4 | Okno handlowców: statusy §4.2, prośby → propozycja, limit +50%, sygnał w aplikacji (stopień 2) | prośba trafia do otwartej propozycji z autorem |
| 5 | Klasy ABC/XYZ (`asortyment` + 52 tyg.) → `zd_sku_class`, KPI | panel KPI z §5 liczony co tydzień |
| 6 | Auto-zatwierdzenie (stopień 3) na 2–3 dostawcach po 4 cyklach z korektą < 10% | 4 cykle bez duplikatu ZD |
| 7 | Auto-mail z PDF (stopień 4) | 4 cykle bez reklamacji |
| — | API (Tomasz): `sales/weekly` z max-z-dokumentu, cena zakupu, `tw_StanMin/Maks/IdPodstDostawca` | równolegle; potrzebne dla §3.3 i sufitu |

## 7. Decyzje (2026-10-23)

1. **Automatyzacja PL — tak**, z ryzykiem branym świadomie; stopnie §4.4 i bezpieczniki §3.5 obowiązkowe.
2. **ABC wg marży** (`/reports/sprzedaz/asortyment`, zysk za 12 mies.) — także jeśli przeliczenie trwa długo
   (cron miesięczny w nocy).
3. **Bez limitu kapitału na grupę/cechę** dla polskich dostawców. Sufit na pojedynczym towarze zostaje
   jako ochrona przed błędem danych, nie jako limit budżetu.
4. **Otwarte ZK bez rezerwacji pomijamy** — wyceny i martwe pozycje.
5. **Odcięcie 14:00 dnia przed wysyłką**; handlowcy widzą propozycje **wszystkich** dostawców.

## 8. Backtest — 10 polskich dostawców (2026-10-23)

**Skrypt:** `scripts/backtest-zd-pl/` (`fetch.mjs` — tylko GET do Subiekta; `sim.mjs`; `sim.test.mjs`).
**Okres:** 26 tygodni, 23.04–22.10.2026; uczenie na 12 mies. przed każdym dniem decyzji (bez zaglądania w przyszłość).
**Dostawcy (kraj `Polska` w Subiekcie, zakres zmapowany, ≥ 31 próbek czasu dostawy):** Everall7, Ivoclar (EXCEL),
Denon Dental, Polkard BIS, Amadar, Kol-Dental, POL-INTECH, Hansen Dental, Makromed, Formed — 2 302 SKU.
DT Shop odpadł (adres w Niemczech).

**Metoda.** Start ze stanem z remanentu na 22.04. Codziennie: przyjęcie dostaw, potem prawdziwa sprzedaż
(FS+PA+WZ niepowiązane, z `estimate/{towarId}`); czego nie ma na stanie — brak. W dniu cyklu każda
strategia liczy Do ZD; dostawa przychodzi po czasie wylosowanym z prawdziwych próbek dostawcy
(`delivery_stats_samples`, te same losowania dla każdej strategii). Wycena zapasu: `cenaMag` z remanentu.
Rzeczywistość: tygodniowe remanenty z tego samego okresu.

### 8.1. Wynik — tygodniowe zdjęcie jak remanent (aktywne SKU = sprzedaż w 6 mies. przed startem)

| Strategia | SKU z zerowym stanem | Śr. zapas | Sprzedaż obsłużona (wart.) | ZD w 26 tyg. | Mediana ZD |
|---|---|---|---|---|---|
| **Rzeczywistość** | **6,6%** | **2,61 mln** | — | — | — |
| P0 Kreator dziś (30 dni) | 10,6% | 1,85 mln | 87,6% | 117 | 16,6 tys. |
| P0 z 45 dniami | 5,6% | 2,37 mln | 93,4% | 118 | 22,1 tys. |
| P0 z 60 dniami | 4,7% | 2,81 mln | 94,8% | 118 | 25,5 tys. |
| P1 (R,S) + zapas bezp. ABC/XYZ | 7,8%¹ | 1,81 mln | 89,2% | 120 | 16,4 tys. |
| **P2 `max30_90`, cykl 7 d** | **4,1%** | **2,50 mln** | 94,6% | 251 | 3,9 tys. |
| P2 `max30_90`, cykl 3 d | 3,4% | 2,42 mln | 95,2% | 495 | 1,8 tys. |
| P2 `max30_90`, cykl dostawcy | 5,5%¹ | 2,46 mln | 92,9% | 118 | 18,4 tys. |
| P3 = P2 + dni wg ABC (30/25/15), cykl 7 d | 4,5%¹ | 2,52 mln | 94,8% | 250 | 4,0 tys. |

¹ dni z brakiem w symulacji dziennej (bez zdjęcia tygodniowego). Stabilność: P2 bije P0 w obu połowach okresu
(obsłużona sprzedaż H1 92,6% vs 88,4%; H2 96,7% vs 86,7%).

**Na dostawcę (P2, cykl 7 d, vs rzeczywistość):** nie gorszy w brakach **i** zapasie u 7 z 10.
Gorszy w brakach: Denon (12,4% vs 8,1%, przy zapasie 166 tys. vs 212 tys.) i Amadar (6,3% vs 2,2%).
Ivoclar (82% wartości zapasu): 2,2% vs 4,0% przy 2,13 vs 2,15 mln. Hansen: 1,5% vs 28,6%.

### 8.2. Wnioski

1. **Silnik: `max30_90` z cyklem 7 dni** dla polskich dostawców. Cykl 3 dni jest o 0,7 pp lepszy, ale
   daje 2× więcej ZD (mediana 1,8 tys. zł) — tylko dla dostawców bez kosztu dostawy i z krótkim czasem.
2. **P2 dominuje „kupuj więcej”:** przy zapasie o 5% większym niż P0+45 dni ma o 27% mniej braków; mniej braków
   niż P0+60 dni przy 11% mniejszym zapasie. To nie efekt większego zapasu, tylko częstszego dopełniania.
3. **Wzór (R,S) z odchyleniem popytu odrzucony** — 80% SKU to *Z i nowości (CZ 796, N 610, BZ 392).
4. **ABC/XYZ nie do ilości** (P3 ≈ P2) — do KPI, flag i kolejności przeglądu.
5. **Denon i Amadar startują w stopniu 1 z przeglądem linii** — przed automatem sprawdzić, które SKU
   tracą (Denon: 178 SKU, L₉₀ 7,8 d).

### 8.3. Ograniczenia — czego backtest nie widzi

- **Popyt ucięty brakami:** sprzedaż, której nie było, bo w rzeczywistości brakowało towaru, nie istnieje
  w danych. Liczby obsłużonej sprzedaży są zawyżone dla wszystkich strategii jednakowo; porównanie względne trzyma.
- Bez opakowań, par, BOM, minimum, wykluczeń i próśb — Kreator zaokrągla w górę, więc realny zapas będzie
  nieco wyższy dla każdej strategii.
- ZD otwarte na 22.04 pominięte (start z samym stanem) — pierwsze tygodnie zaniżają zapas wszystkich strategii.
- Rytm, czasy dostaw i zakresy z lokalnej kopii bazy (próbki do 03.10.2026), nie z produkcji.
- Koszt dostawy na ZD nieuwzględniony (brak danych) — dlatego cykl 7 d, nie 3 d.

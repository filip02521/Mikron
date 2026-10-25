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
2. **Linia pilna** = (dostępne + otwarte ZD) / tempo < cykl + czas dostawy — odłożenie przesuwa
   zamówienie o cały cykl, więc towar musi wytrzymać do kolejnej dostawy.
3. `wartość < min_order_value` (PLN; inna waluta → reguła pominięta) albo `wartość < free_shipping_threshold`:
   - brakuje do progu darmowej dostawy ≤ 15% → **dopełnić** towarami A/B tego dostawcy w kolejności
     „najmniej dni pokrycia”, każdy najwyżej do celu + tempo × cykl; dopełnienie, które nie dojdzie do progu,
     nic nie dodaje;
   - inaczej, bez linii pilnych → **odłożyć** (`deferred`) na kolejny cykl z powodem;
   - z liniami pilnymi → wysłać mimo minimum/progu, powód w logu.
   Linia bez ceny → propozycji nie odkładamy i nie dopełniamy (wartość nieznana).

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

**Skrypt:** `scripts/backtest-zd-pl/` (`fetch.mjs` — tylko GET do Subiekta; `sim.mjs`; `sim.check.mjs` — self-check, `node sim.check.mjs`).
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

## 9. Backtest roczny i weryfikacja danych (2026-10-23)

**Skrypty:** `scripts/backtest-zd-pl/sim1y.mjs`, `verify1y.mjs`, test zgodności z silnikiem `engine-parity.test.ts`
(dni celu = `effectiveDniZapasu`, zaokrąglenie = `computeZdPackOrderQty`, p90 nearest-rank — 3/3).
Dane: `BT_DATA=data-1y BT_SALES_FROM=2024-10-01 BT_SIM_START=2025-10-22 node fetch.mjs`.
**Okres:** 365 dni, 23.10.2025–22.10.2026, te same 10 dostawców (2 284 SKU, 1 331 aktywnych).

Wierniej niż §8: czas dostawy jak silnik (p90 z próbek z 24 mies. **sprzed** dnia decyzji, wszystkie typy
zamówień — statystyka „łącznie”), realizacja = czas prawdziwego zamówienia złożonego najbliżej tego dnia,
zaokrąglenie do opakowań i wielokrotności z Kreatora, popyt kompletów „explode” rozpisany na składniki.

### 9.1. Weryfikacja danych

| Kontrola | Wynik | Wniosek |
|---|---|---|
| Bilans: stan(t+7) − stan(t) + sprzedaż = przyjęcia | rozchód bez sprzedaży 5,9% sztuk, **15% wartości**; 2,7% tygodni-SKU | głównie **kompletacja** (P310 + VP3, Vertex 4 kg + płyn, ProBase polimer + monomer): składnik schodzi ze stanu, sprzedaje się komplet |
| Nasza sprzedaż / raport asortymentowy (rok uczenia) | 111% | różnica = WZ niepowiązane (my liczymy, raport nie) i korekty/zwroty (raport odejmuje) — zgodne z definicją silnika |
| Linie ujemne w danych | 0 z 116 148 | zwroty nie zaniżają popytu |
| Towary bez ceny magazynowej | 155 z 2 284 (6,8%) | pominięte w wycenie zapasu — tak samo dla każdej strategii |

### 9.2. Wynik roczny

| Strategia | Zero na zdjęciu tyg. | Dni z brakiem | Obsłużona sprzedaż | Śr. zapas | ZD / rok | Mediana ZD |
|---|---|---|---|---|---|---|
| **Rzeczywistość** | **6,1%** | — | — | **2,73 mln** | — | — |
| Kreator dziś (30 d) | 12,1% | 12,7% | 84,9% | 1,22 mln | 231 | 13,5 tys. |
| Kreator 60 d | 6,2% | 6,5% | 93,4% | 1,82 mln | 232 | 16,3 tys. |
| `max30_90`, cykl dostawcy | 5,0% | 5,4% | 93,3% | 2,26 mln | 231 | 14,3 tys. |
| **`max30_90`, cykl 7 d, cel 25** | **3,6%** | **3,9%** | **95,5%** | **2,29 mln** | 482 | 3,8 tys. |
| `max30_90`, cykl 7 d, cel 20 / 30 | 4,2% / 3,4% | 4,7% / 3,7% | 94,3% / 96,1% | 2,23 / 2,33 mln | 483 | 3,7 tys. |
| `max30_90`, cykl 3 d | 2,9% | 3,3% | 96,2% | 2,25 mln | 979 | 1,7 tys. |
| cykl 7 d bez podłogi 90 d | 4,4% | 4,8% | 95,1% | 2,26 mln | 479 | 3,8 tys. |

- **Kwartały (dni z brakiem, cykl 7 d):** 4,7% · 4,0% · 5,0% · 2,1% — wygrywa z Kreatorem (10,3 · 13,6 · 17,7 · 9,4)
  w każdym kwartale, także w lecie (Q3), gdzie Kreator ma najgorszy wynik.
- **Na dostawcę (cykl 7 d vs rzeczywistość):** nie gorszy w brakach **i** zapasie u **8/10**. Nie zaliczają:
  **Denon** — więcej braków (10,5% vs 7,5%) przy zapasie 101 vs 191 tys., i **Makromed** — braki niższe (3,1% vs 3,4%),
  zapas minimalnie wyższy (34 vs 34 tys. po zaokrągleniu).
  Denon ma najwięcej kompletów (Vertex) — popyt składników jest w danych najsłabiej widoczny.
- **Test odporności (BT_OUTFLOW=1, cały rozchód bez sprzedaży doliczony jako popyt):** cykl 7 d 3,4% zera
  przy 2,53 mln vs rzeczywistość 6,1% przy 2,73 mln; 7/10 dostawców nie gorszych. Wniosek się trzyma.
- **Podłoga 90 d** daje −0,8 pp zera przy +1% zapasu; **cel 25 d** jest punktem przegięcia (20 → 25: −0,6 pp,
  25 → 30: −0,2 pp przy +2% zapasu).

### 9.3. Wnioski i warunki wdrożenia

1. **Strategia potwierdzona na roku:** `max30_90`, cykl 7 dni, cel 25 dni — ok. −40% braków wobec rzeczywistości
   przy −16% zapasu; −70% braków wobec dzisiejszego Kreatora (który trzyma za mało).
2. **Denon — korekta 2026-10-23:** komplety i pary są w OnTime skonfigurowane (zestawy Vertex 4 kg + 2×1 L jako
   „zamawiaj jak sprzedany” — RS, CP i Castavaria są na ZD od Denonu jako zestawy; kartony Wirofine/Bellavest i stopy
   1 kg ↔ 1 szt jako pary). Rozchód bez sprzedaży (15% wartości) to przeliczenia karton ↔ sztuka i kompletacja,
   których **backtest** nie odwzorowuje (silnik tak) — słabszy wynik Denonu to ograniczenie backtestu, nie braki
   w konfiguracji. Do sprawdzenia: zestaw Orthoplast (bez ZD od roku, 109 szt przyjęć) — jeśli składany w Subiekcie,
   ustawić „rozpisz na składniki”.
3. **Komplety:** w lokalnej bazie 10 kompletów „explode”; rozchód kompletacji na produkcji trzeba sprawdzić
   (zakres kompletów w Kreatorze) przed stopniem 3 u dostawców z zestawami (Ivoclar, Denon).
4. Cykl 3 d jest lepszy o 0,7 pp, ale daje 2× więcej ZD (mediana 1,7 tys. zł) — tylko bez kosztu dostawy.

## 10. Audyt na prawdziwych danych (2026-10-23, wieczór)

Propozycje „Przygotuj teraz” dla 10 dostawców (Subiekt LIVE, lokalna baza), scenariusze minimum/progu, przegląd UI.

### 10.1. Czas dostawy automatu = pierwsza dostawa, nie pełna realizacja

Próbki OnTime (`delivery_stats_samples`, ZD → FZ) mają dwa czasy: do **pierwszej** dostawy i do **ostatniej**
FZ zamówienia. p90 pełnej realizacji wydłużają pojedyncze pozycje z zaległości (Ivoclar: ZD z 28.11.2024 przyszło
po 7 dniach rob., ostatnia pozycja po 93) — a one i tak wiszą w otwartych ZD, więc liczenie ich w celu podbijało
zapas **wszystkich** towarów dostawcy (Ivoclar: cel 66 dni, propozycja 327 tys. zł / 452 pozycje).

| Dostawca | p90 pełna realizacja (dni rob.) | p90 pierwsza dostawa |
|---|---|---|
| Ivoclar (EXCEL) | 30 | 17 |
| DT Shop, Makromed, Amadar | 7–8 | 3–4 |
| Kol-Dental, Denon | 5 | 3 |
| Pozostali | 2–4 | 2–4 |

**Zmiana:** `ZdOrderHorizon.automatLeadDays` = p90 do pierwszej dostawy (od 5 próbek; nigdy dłuższy niż `leadDays`)
— cel `max30_90` i pilność przy minimum. Kreator „Do kolejnej dostawy”, ETA w panelu i sygnały Braki bez zmian.
**Efekt:** Ivoclar cel 40 dni, 47 pozycji, 73 tys. zł. Backtest roczny (cykl 7 d, cel 25):

| Wariant | Zero na zdjęciu tyg. | Śr. zapas | Ivoclar: zero / zapas |
|---|---|---|---|
| Rzeczywistość | 6,1% | 2,73 mln | 3,9% / 2,30 mln |
| czas = pełna realizacja (§9) | 3,6% | 2,29 mln | 2,1% / 1,99 mln |
| **czas = pierwsza dostawa** | **4,0%** | **1,63 mln** | **3,3% / 1,32 mln** |
| pesymistycznie (cel z pierwszej, towar dopiero z ostatnią) | 5,4% | 1,56 mln | 4,9% / 1,26 mln |

### 10.2. Kto jest „polskim dostawcą”

OnTime ma własny podział (karta dostawcy → Lokalizacja: Polska / Zagranica / Import, z arkusza zamówień). Kraj
z Subiekta to adres rozliczeniowy. Rozjazd w 7 przypadkach: **Ivoclar (EXCEL), Dentsply Sirona, Medin** — w OnTime
ZAGRANICA, w Subiekcie Polska; **DT Shop, Ormco, PiDental, Sklep ABC-RC** — w OnTime POLSKA, w Subiekcie zagranica.
Bez Ivoclar (9 dostawców POLSKA) backtest roczny: 6,4% zera przy 0,29 mln wobec 10,5% przy 0,43 mln w rzeczywistości.
**Decyzja 2026-10-23 (Filip): Fazę I wyznacza Lokalizacja z OnTime** (`suppliers.location = 'POLSKA'`, stała
`ZD_AUTOMAT_SUPPLIER_LOCATION`). Kraj z Subiekta zostaje jako kontrola: karta dostawcy pokazuje rozjazd na bursztynowo.
W lokalnej kopii zmienia to skład KPI (37 dostawców): wchodzą DT Shop i PiDental, wypadają Ivoclar (EXCEL) i Dentsply Sirona.
**Ivoclar nie jest w Fazie I** — liczby Fazy I to wariant „bez Ivoclar” powyżej.

### 10.3. Poprawki z audytu

- **Bezpieczniki:** „ponad sufit” liczony po odjęciu jednej jednostki zamówienia — wszystkie 137/137 flag u Ivoclar
  były zaokrągleniem 1–2 szt. wolno rotującego towaru; tempo w notatce „1 szt / 60 d” zamiast „0 szt/d”.
  „Wartość ZD 2× większa” od 2000 zł (POL-INTECH 1181 zł to nie sygnał). Po poprawkach Ivoclar: 10 flag
  (9 nowości, 1 skok), Denon: 0 + wartość nietypowa.
- **Ceny:** kartotekowa ≠ ostatnie ZD o > 5% u 3–6 pozycji na dostawcę (podwyżki od ostatniego ZD) — zgodnie z decyzją.
- **Minimum/próg (Kol-Dental, realne ceny):** minimum 3× → idzie (2 pozycje pilne); próg +10% → dopełnienie 1 pozycją;
  próg +50% → bez dopełnienia, idzie (pilne); minimum w EUR → reguła pominięta. Zgodnie ze specyfikacją.
- **UI:** wiersz w panelu dziennym mówi „N do sprawdzenia · wartość nietypowo wysoka”; panel akceptacji ma filtr
  „Do sprawdzenia (N)” i takie pozycje na górze; `/zakupy/automat` zaczyna od zdania stanu, dzieli dostawców w
  automacie i pozostałych, pokazuje stopień i gotowość do auto-zatwierdzania, nie twierdzi „braki poniżej 5%” bez
  historii stanów; dialog strategii — domyślnie co 7 dni, „Automat ZD” zamiast „Strategia testowa”, aktualny backtest.

### 10.4. DT Shop (Lokalizacja POLSKA, adres w Subiekcie: Niemcy) — backtest roczny

Kontrahent „DT&Shop Polska”, Bad Bocklet (DE), NIP DE; dostawa jak krajowa (mediana 3 dni rob., p90 pierwszej
dostawy 4). Dane: 40 SKU (29 aktywnych), 0 bez ceny, rozchód bez sprzedaży 4,5%, sprzedaż 104% raportu asortymentowego.
Czas dostawy = pierwsza dostawa.

| Wariant | Zero na zdjęciu tyg. | Śr. zapas | ZD / rok | Mediana ZD |
|---|---|---|---|---|
| Rzeczywistość (co 6 tyg.) | 9,6% | 14 tys. zł | — | — |
| Kreator dziś (30 d) | 29,5% | 7 tys. zł | 9 | 3,7 tys. zł |
| **`max30_90`, co 7 d, cel 25** | **6,0%** | **11 tys. zł** | 50 | 0,8 tys. zł |
| `max30_90`, co 14 d | 8,6% | — | 27 | 1,7 tys. zł |
| `max30_90`, co 21 d | 11,3% | — | 18 | 3,0 tys. zł |

Co 7 dni: −38% braków i −21% zapasu wobec rzeczywistości (pesymistycznie 6,4%). Przy wysyłce z Niemiec koszt paczki
może przeważyć — wtedy co 14 dni (nadal lepiej niż dziś) albo próg darmowej dostawy w karcie (małe ZD bez pilnych
pozycji przejdą na kolejny tydzień).
**Decyzja 2026-10-23: DT Shop co 14 dni** (pozostali polscy dostawcy co 7).

**Faza I (9 dostawców + DT Shop, bez Ivoclar), co 7 d, cel 25:** 5,5% zera przy 0,32 mln zł wobec 10,5% przy
0,44 mln w rzeczywistości (−48% braków, −27% zapasu); nie gorszy od rzeczywistości u 8/10.

## 11. Backtest w aplikacji — audyt zgodności z nocnym przebiegiem (2026-10-24)

Backtest (`/zakupy/automat` → Dostawcy → Backtest; `src/lib/orders/zd-backtest.ts`) liczył prostszy model niż
nocny przebieg. Różnice i poprawki (wynik v2):

| # | Było | Silnik (nocny przebieg) | Teraz |
|---|---|---|---|
| 1 | okno sprzedaży 30 d | okno = dni zapasu dostawcy (`salesWindowFromDniZapasu`, DT Shop 60 d) | jak silnik |
| 2 | tempo z prawdziwej sprzedaży | system widzi tylko to, co zeszło ze stanu, i koryguje dni braku (`computeStockoutSalesFactor`) | sprzedaż widziana = obsłużona w symulacji + korekta dni braku |
| 3 | prośby liczone jak popyt na zapas | strategia odejmuje prośby z okna (i z każdego z trzech okien profilu do podłogi 90 d) | prośby poza zapasem, odejmowane jak silnik |
| 4 | bez podążania za sprzedażą, historii ZD, minimum | `computeSalesTrackedCel` (preset z ustawień), `applyZdEstimateHistoryCuts`, minimum stanów | te same funkcje |
| 5 | czas dostawy z próbek złożonych przed decyzją (także jeszcze niedostarczonych), wszystkie typy i źródła | `selectSamplesForStats` → kwantyle zamówień głównych → `automatLeadDays` | tylko dostawy znane w dniu decyzji, ten sam wybór próbek |
| 6 | zamówienia klientów (ZK) jako nagła sprzedaż z półki | rezerwacja: dostępne = stan − rezerwacje | FS z wcześniejszego ZK (`dok_DoDokId`): rezerwacja od dnia ZK, stan trzymany, brak = klient czeka (opóźnienie, nie utracona marża) |
| 7 | braki ze zdjęcia tygodniowego w stałej fazie cyklu | — | braki i zapas symulacji liczone dziennie |
| 8 | popyt z tygodni braku niewidoczny (automat wypadał za dobrze) | — | dopisany z tempa tygodni ze stanem (towar sprzedawany przed i po przerwie, maks. ×2) |
| 9 | nowy towar bez sprzedaży na starcie nigdy niezamówiony | — | pierwsza dostawa jak naprawdę (wprowadzenie ręczne), potem automat |

Dowód zgodności: `zd-backtest-engine-parity.test.ts` — decyzja backtestu = Do ZD ścieżki silnika (te same funkcje
w tej samej kolejności) w 19 scenariuszach.

Wybór ustawień: siatka co 7/14/21 × cel 15–60 d; koszt roku = utracona marża na sprzedaży z półki (marża z raportu
asortymentowego) + 20% średniego zapasu (`ZD_BACKTEST_HOLDING_RATE`). Rekomendacja: najniższy koszt wśród ustawień,
które działają (braki ≤ dziś, zapas ≤ dziś + 10%, opóźnione dostawy ≤ dziś + 1 pp) i trzymają w ≥ 3 kwartałach;
gdy żadne — kolejno: bez warunku opóźnień, mniej braków za cenę zapasu, najniższy koszt.

Wynik na nowym modelu (dane do 23.10.2026):
- **DT Shop** (okno 60 d, ZK 19% sprzedaży): co 14 / cel 25 — kompromis (braki 7,0% vs 6,4%, zapas −42%);
  rekomendacja **co 14 / cel 35**: braki 4,1%, zapas 11,8 tys. zł (−19%), koszt roku 3,3 tys. zł vs Kreator dziś
  5,1 tys. zł, 4/4 kwartały.
- **Denon** (okno 30 d, rozchód bez sprzedaży 11% — kompletacja): co 7 / cel 25 — nie działa (9,1% vs 5,3%);
  żadne ustawienie nie przechodzi testu opóźnionych dostaw; rekomendacja **co 7 / cel 40** (braki 4,6%, zapas −8%).
- Cel 25 dla 10 dostawców z §7 trzeba przeliczyć backtestem v2 przed włączeniem na produkcji.

Znalezione w silniku (nie w backteście), naprawione 2026-10-24: podłoga 90 d odejmowała prośby tylko z ostatniego
okna 30 d profilu — prośba sprzed 31–90 dni dalej podnosiła tempo przez dwa miesiące. Teraz każde z trzech okien
podłogi traci prośby dostarczone w jego zakresie (14 d przed najstarszym oknem, do 3 d przed końcem okna; zakresy
się nie nakładają — `zdProsbaFloorWindowRanges`), okno nie mniej niż 0. Backtest odejmuje sprzedaż pod prośby per
okno tak samo; przeliczenie 10 dostawców po poprawce (2026-10-24) dało te same werdykty i rekomendacje co tabela §11.1 — prośby to 0–2,6% sprzedaży tych dostawców (różnice ≤ 0,1 pp braków, ≤ 1 tys. zł zapasu).

### 11.1. Backtest v2 — 10 dostawców z §7 (dane 24.10.2025–23.10.2026)

Ustawienia z decyzji (co 7 / cel 25, DT Shop co 14 / cel 25) i rekomendacja z siatki (koszt roku = utracona marża
+ 20% zapasu). Braki = % dni-towarów bez stanu; „naprawdę” z tygodniowych remanentów.

| Dostawca | Naprawdę | Decyzja §7 | Werdykt | Rekomendacja | Uwagi |
|---|---|---|---|---|---|
| Amadar | 13,1% / 28k | 7,4% / 20k | działa | co 14 / cel 15: 9,3% / 16k | ZK 54% sprzedaży |
| Denon Dental | 5,3% / 190k | 9,1% / 106k | nie działa | co 7 / cel 40: 4,6% / 176k (wrażliwe na opóźnienia) | rozchód bez sprzedaży 11% |
| DT Shop | 6,4% / 15k | 7,0% / 8k | kompromis | co 14 / cel 35: 4,1% / 12k | |
| Everall7 | 9,9% / 71k | 5,0% / 69k | działa | = decyzja | rozchód bez sprzedaży 13,5% |
| Formed | 4,6% / 3k | 2,0% / 3k | działa | co 7 / cel 30: 1,6% / 3k | |
| Hansen Dental | 5,0% / 31k | 2,7% / 15k | działa | co 7 / cel 35: 0,9% / 17k | |
| Kol-Dental | 0,8% / 32k | 4,6% / 13k | nie działa | co 14 / cel 60: 0,5% / 34k | decyzja tańsza w koszcie roku (4k vs 7k) |
| Makromed | 3,8% / 35k | 2,3% / 38k | działa | = decyzja | 5 aktywnych SKU |
| POL-INTECH | 8,6% / 5k | 3,5% / 4k | działa | co 7 / cel 35: 2,4% / 4k | popyt dopisany za braki 8% |
| Polkard BIS | 10,0% / 15k | 9,4% / 13k | działa | co 7 / cel 30: 8,5% / 15k | |

Decyzja §7 działa u 7/10; zmiany potrzebne przy Denon, DT Shop, Kol-Dental. Zapas razem: naprawdę 425k, decyzja
§7 289k, rekomendacje 384k.

### 11.2. Backtest v3 — stany dzienne, cykle od codziennie, minimum i koszt ZD (2026-10-24)

Symulacja dzień po dniu dla całego dostawcy; stany z remanentu na każdy dzień; siatka co 1/2/3/5/7/14/21 × cel
15–60; reguły minimum zamówienia i darmowej dostawy jak nocny przebieg (w bazie dev żaden z 11 nie ma ich
ustawionych); koszt roku = utracona marża + 20% średniego zapasu + 20 zł za ZD (`ZD_BACKTEST_ORDER_COST`).

| Dostawca | Naprawdę | Obecne ustawienie | Werdykt | Rekomendacja | ZD/rok | Koszt roku |
|---|---|---|---|---|---|---|
| Amadar | 13,2% / 28k | co 7 / 25: 7,5% / 20k | działa | co 14 / 15: 9,4% / 16k | 24 | 5k |
| Denon Dental | 5,2% / 191k | co 7 / 25: 8,4% / 108k | nie działa | co 2 / 35: 5,1% / 151k | 154 | 47k |
| DT Shop | 6,1% / 15k | co 14 / 25: 7,0% / 9k | kompromis | co 14 / 40: 2,8% / 13k | 27 | 4k |
| Everall7 | 9,9% / 71k | co 7 / 25: 4,8% / 70k | działa | co 5 / 25: 4,4% / 70k | 73 | 24k |
| Formed | 4,9% / 3k | co 7 / 25: 2,0% / 3k | działa | co 14 / 30: 3,5% / 3k | 27 | 1k |
| Hansen Dental | 4,7% / 31k | co 7 / 25: 2,7% / 15k | działa | co 7 / 35: 1,0% / 17k | 48 | 5k |
| Kol-Dental | 1,1% / 33k | co 7 / 25: 4,2% / 13k | nie działa | co 7 / 45: 0,9% / 24k | 50 | 6k |
| Makromed | 3,8% / 34k | co 7 / 25: 2,6% / 38k | kompromis | co 3 / 20: 3,7% / 34k | 47 | 8k |
| POL-INTECH | 7,9% / 5k | co 7 / 25: 3,5% / 4k | działa | co 14 / 35: 3,8% / 4k | 26 | 2k |
| Polkard | 3,5% / 156k | co 3 / 25: 1,8% / 117k | działa | co 2 / 25: 1,7% / 116k | 154 | 33k |
| Polkard BIS | 9,5% / 15k | co 7 / 25: 9,1% / 13k | działa | co 5 / 30: 7,8% / 16k | 69 | 6k |

Rozchód bez sprzedaży na stanach dziennych: Everall7 19%, Denon 16%, Kol-Dental 12%, POL-INTECH 12% —
wynik u nich może być zbyt optymistyczny. Polkard: tylko 15 zmierzonych dostaw.

## 12. Wdrożenie na produkcję — kroki ręczne (audyt 2026-10-24)

`installer/nightly-deploy.ps1` aktualizuje kod i usługę, ale nie wgrywa migracji i nie instaluje nowych zadań cron.
Po wdrożeniu main z #230–#232:

1. **Migracje** (Admin → Migracje): `190`, `193`, `194`, `195` — te, których brak. Bez 194 strategia zapisze stopień 1
   (z ostrzeżeniem), ale bez minimum/progu, flag, odłożenia i klas; bez 195 backtest w aplikacji nie zapisze wyniku.
2. **Crony — nic do instalowania.** Klasy ABC/XYZ (raz w miesiącu) i KPI (raz w tygodniu) liczy istniejący
   `stock-watch` po porannym przebiegu braków (zmiana 2026-10-25; wcześniej osobne zadania Windows, których
   `install-cron.ps1` na serwerze nie dodał). Pierwszy poranek po wdrożeniu nadrobi oba.
3. **Pierwsze klasy ABC/XYZ i KPI**: `/zakupy/automat` → „Przelicz” (admin) — bez czekania na 1. dzień miesiąca.
4. **Czasy dostaw**: nocny `subiekt-lead-times` (w ramach `catalog-zd-sync`, 02:00–04:40) sam przeliczy próbki z nową regułą końca miesiąca.
5. **Strategia dostawców**: rekomendacje z §11.2 (stopień 1 — propozycje do akceptacji). Przed zapisem sprawdzić
   w karcie dostawcy minimum zamówienia i próg darmowej dostawy — backtest liczył bez nich.

Skutek reguły końca miesiąca dla ETA: u rzadko zamawianych dostawców zagranicznych FZ z datą ostatniego dnia
miesiąca to 33–60% faktur (np. VERTYSYSTEM, MGM System, Realloy, Dental Flex Italia, IP Division) — ich ETA liczy się
z mniejszej liczby pomiarów (przy < 5 z 24 mies. bierzemy 5 najnowszych).

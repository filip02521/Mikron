# Audyt procesu zamówień ZD (Kreator · Braki · Automat) — 28.10.2026

Stan na gałęzi `claude/orders-products-analysis-f90cfa` (= main po PR #264). Analiza z 28.10; poprawki wdrożone tego samego dnia na tej gałęzi — lista w `docs/zamowienia-jeden-silnik.md` §6 (D1–D5, L1–L3, L5–L8, L11, L12 zrobione; L4, L9, L10 — patrz §10 niżej).

## 1. Źródła i ograniczenia

| Źródło | Użyte do | Zakres |
|---|---|---|
| Subiekt LIVE (API 2.1.7, 192.168.0.140:5080) | sprzedaż, stany, otwarte ZD/ZK, korekty, ZD Polkardu | 2021–28.10.2026 |
| Lokalna baza dev (`ontime_dev`) | propozycje automatu (do 25.10), profile 12×30 (26.10), opakowania, pary, „tylko na prośbę”, nocny przebieg stock-watch (25.10) | kopia, nie produkcja |
| Lokalna aplikacja (worktree, port 3001) z żywym Subiektem | Kreator ZD dla Polkardu: lista, karta produktu, „Dlaczego tyle” | 28.10 |
| Kod: `zd-order-engine.ts`, `zd-estimate-*.ts`, `zd-demand-policy.ts`, `zd-sales-profile.ts`, `stock-watch/*`, `zd-auto-proposals.ts`, `zd-kpi-weekly.ts` | reguły, progi, kolejność operacji | — |

**Nie sprawdzone — produkcja niedostępna** (sesja wygasła, hasła nie wpisuję): dziennik decyzji `zd_auto_proposals.final_lines`, KPI „korekta człowieka”, produkcyjne ustawienia strategii/opakowań, prośby handlowców z ostatnich tygodni (lokalne `individual_orders` kończą się 10.10). Zapytania do uruchomienia na produkcji są w §7.

## 2. Jak system liczy „Do ZD” (kolejność w silniku)

1. **Subiekt** (`/orders/zd/estimate`): `sprzedazOkres` = FS + PA + WZ niepowiązane w oknie; `cel = sprzedaż ÷ dni okna × dni zapasu + zapasMin`; `dostepne = stan − rezerwacje`; `otwarteZd` = ZD status 5/6/7 z 12 miesięcy; ZK tylko informacyjnie.
2. **Mnożnik braków** (`stock-history.ts`): dni bez stanu w oknie podbijają tempo (≤ ×2), prośby wyłączone z mnożnika tylko bez opakowań.
3. **Strategia `max30_90`** (`zd-demand-policy.ts`): tempo = max(okno, średnia 90 d z profilu, jednorazowy skok ścięty do typowego miesiąca, prośby odjęte per okno); dni celu = max(dni strategii, cykl + dostawa p90 + 25 %).
4. **Profil 12×30** (`zd-sales-profile.ts`): znaczniki skok / rzadki / nowość / falami; wygładzenie tylko opcją (classic) albo skok przy strategii.
5. **Podążanie za sprzedażą** (`zd-estimate-sales-track.ts`, preset `gentle`): podbicie thin_cover / sell_through do +20 % celu, cięcia fat_cover / low_sell_through do −30 %, pewność 0–1 decyduje, ile sztuk podbicia wchodzi; linia z podbiciem trafia do „Weryfikacja”.
6. **Historia ZD** (`zd-estimate-history-track.ts`): skok vs ostatnie ZD (−45 % celu), wolna rotacja po ostatnim ZD (−20 %).
7. **Ilość** = ceil(cel − dostępne − otwarte ZD × opakowanie) + prośby (po odjęciu rezerwacji ZK klienta i wolnego zapasu) → opakowania, wielokrotność, pary, składy, minimum stanów, wykluczenia, „tylko na prośbę”.
8. **Automat**: ten sam silnik nocą (stock-watch) → `zd_auto_proposals` z flagami (sufit, pik, skok, nowość, wartość ZD); akceptacja = Utwórz ZD w Kreatorze, zapis `final_lines = {twId: jednostki}`.

Wniosek z arytmetyki: **Kreator pokazuje to, co liczy** — Siatka podniebienna (cel API 286,3 + podbicie 28 = 314,3; − 172 = 143 → 15 op.), Haczyki 0,8 mm (para: 8 op. × 100 + 358 szt = 1158; cel 810,6 + 100; pokrycie 422 → 489 → 5 op.), Lutowie (51 szt/30 d → cel 21 d = 35,7) zgadzają się z ręcznym przeliczeniem z API. Błędy nie są w wyświetlaniu, tylko w **danych wejściowych** i w **regułach**.

## 3. Co jest nie tak w danych wejściowych (realne liczby)

| # | Problem | Dowód | Skutek dla zamówień |
|---|---|---|---|
| D1 | **Korekty sprzedaży (KFS) nie są odejmowane** — API liczy FS+PA+WZ, KFS (typ 6) pomija | Zirconium Explore A3,5 (tw 15279): 8 FS w październiku + KFS 95/M/10 (zwrot 1 szt z FS 1571) → `sprzedazOkres` = 8, powinno być 7. Od 1.08: 259 KFS wobec 11 661 FS; próbka 80 KFS = 431 szt zwrotów, pojedyncze towary po 20–50 szt | sprzedaż zawyżona punktowo (tw 9777: 50 szt w próbce); przy towarach z dużym zwrotem cel za wysoki |
| D2 | **Zaległe otwarte ZD liczone jak dostawa** — 12 miesięcy wstecz, bez sprawdzania terminu | 148 otwartych ZD, **60 po terminie** (334 tys. zł netto), 11 starsze niż 90 dni (najstarsze ZD 87/M/12/2025, termin 30.03). Polkard: ZD 29/M/10 (1 szt Szablony PRII, termin 23.10) otwarte od 2.10 | towar „w drodze”, którego nie ma → Do ZD = 0, radar pokazuje „czeka na dostawę” (`priority.ts:63`), brak alertu o martwym ZD |
| D3 | **„ZK bez rezerwacji” to w 92 % martwe ZK sprzed lat** | zakres Polkard: 161 z 250 towarów ma ZK bez rez (5 190 szt), z czego 4 780 szt starsze niż 90 dni; 128 towarów ma **wyłącznie** stare ZK (Haczyki 0,8: 812 szt od 2021; Śruba Fischera medium 730) | (a) „wolny zapas” dla próśb (`freeSupplyForProsbaPieces`, odejmuje ZK bez rez) jest zawsze 0 → prośba zawsze dokłada sztuki, nawet gdy stan ją pokrywa; (b) kolumna w Kreatorze wprowadza w błąd |
| D4 | **Pełny brak w oknie znika z radaru** — stan 0 przez całe okno → sprzedaż 0 → „bez sprzedaży”, nie „pilne” | logika `analysis.ts:130-131`, mnożnik braków wymaga ≥ 7 dni ze stanem; podłoga 90 d tylko dla `max30_90` | dostawcy „classic”: towar, który skończył się > 30 dni temu, nie wchodzi na listę ani do pilnych; wymaga policzenia na produkcyjnym `stock_watch_items` |
| D5 | Czas dostawy p90 z 5–9 próbek = **maksimum** (`delivery-stats-samples.ts:85-90`) | nearest rank: n=5 → indeks 4 | jedna spóźniona dostawa robi „zabraknie przed dostawą” z całego zakresu; wyższy cel strategii (cykl + L + 25 %) |
| D6 | FS z zerowymi ilościami (raport K-Snap z 08.2026) | 80 ostatnich FS: 500 pozycji, **0** z ilością 0 | naprawione po stronie API — można zamknąć |

## 4. Błędy logiki w kodzie (potwierdzone na liczbach z kodu, nie z runtime)

Uszeregowane: najpierw te, które zmieniają ilość na realnym ZD.

| # | Reguła | Gdzie | Przykład |
|---|---|---|---|
| L1 | **Rezerwacja ZK prośby działa jak `max`, nie jak odjęcie** — `relief` odejmowane od `need` z podłogą 0, prośba dodana w całości | `zd-estimate-packaging.ts:356-365` | stan 12, rez 5 (ZK prośby), cel 10, prośba 5 → need 3−5→0, extra 5 → **Do ZD 5**, a brak po wydaniu to 3 |
| L2 | **Rezerwacja z innego ZK tego klienta znika, gdy need = 0** (`cappedOverlap = min(overlap, need)`) | `:236-238` | stan 10, rez 5 (ZK klienta X), cel 5, prośba X 5 bez numeru ZK → Do ZD 5, choć 5 leży zarezerwowane |
| L3 | **Opakowanie > 1 wyłącza odejmowanie zrealizowanych próśb od sprzedaży** (także tryb B w sztukach) | `zd-order-engine.ts:1089`, `:1033` | prośba 500 szt dostarczona w oknie, sprzedaż 600 → cel z 600; podłoga 90 d ciągnie to 2 miesiące |
| L4 | **Prośba dostarczona przed oknem obniża sprzedaż w oknie** (dostawy od −14 d, bez sprawdzenia, kiedy wyszła do klienta) | `zd-sales-profile-load.ts:240-244` | dostawa 10 dni przed oknem, 80 szt → sprzedaż w oknie 100 → netto 20 |
| L5 | **Trzy korekty za ten sam fakt „nie było towaru”**: mnożnik braków × thin_cover × sell_through | `stock-history.ts`, `zd-estimate-sales-track.ts:450-476` | sprzedaż 10, 11 z 22 dni bez stanu → ×2 = 20; stan 0 → thin +6,7, sell-through +3 → **27** (sam mnożnik: 20) |
| L6 | **„Skok vs ostatnie ZD” liczy oczekiwane na dzisiejszych dniach zapasu**, a snapshot nie pamięta dni z chwili ZD | `zd-estimate-history-track.ts:147`, snapshot bez `dniZapasu` | ostatnie ZD 100 szt na 30 d; dziś strategia 50 d → expected 60, sprzedaż 110 stabilna → fałszywy `sales_spike`, cel −35 % |
| L7 | **Mnożnik braków przed profilem** — profil widzi sprzedaż ×2, klasyfikuje „skok” i cofa korektę | `zd-order-engine.ts:1152-1181` | typowo 10, surowe 15, ×2 = 30 ≥ 3×10 → skok → ścięte do ~12 (< 15 surowe) |
| L8 | Podbicia i cięcia liczone od celu **z zapasMin w środku** | `sales-track.ts:469,476,501` | zapasMin 100, sprzedaż 6 → +15,9 szt podbicia z samego bufora |
| L9 | **Dobicie do opakowania/wielokrotności na samej prośbie** | `zd-estimate-packaging.ts:175-180` | prośba 1 szt, N=100, M=10 → 1000 szt |
| L10 | Skład z komponentów: prośby na składniki → **MAX zamiast sumy** | `zd-estimate-individual.ts:588-592` | prośba A (3 kpl) + B (2 kpl) → 3 kpl |
| L11 | „Zamów dziś poza planem” w panelu dziennym liczy bez deduplikacji towaru wspólnego (tablica Braki dedupluje) | `data.ts:1014-1031` vs `dashboard.ts:178-186` | ten sam towar: A „1”, B „1” w panelu, w tablicy tylko u właściciela |
| L12 | Dziennik automatu: `final_lines` tylko `{twId: jednostki}`; **dodane linie bez wartości, brak „kto / z ilu na ile / dlaczego”**; KPI liczy tylko `accepted` | `zd-kpi-weekly.ts:154-185` | korekta „nie zamówiono 16 z 29 linii” nie ma śladu, jeśli propozycja wygasła |

Pozostałe (mniejsze): podbicie + podłoga 90 d to dwie warstwy „w górę” bez wspólnego sufitu; `cutoff_time` zapisywane, nieużywane; liczniki N „zacięte” między przebiegami.

## 5. Propozycja automatu vs to, co naprawdę zamówiłeś (Polkard)

Propozycje z bazy dev (ten sam silnik, ustawienia dev: cel 25 d, cykl 3 d) wobec ZD w Subiekcie:

| Porównanie | bez zmian | więcej | mniej | nie zamówiono | dodano |
|---|---|---|---|---|---|
| propozycja 21.10 (29 linii) → ZD 214 z 22.10 (19 linii) | 5 | 5 | 3 | 16 | 6 |
| propozycja 21.10 → ZD 214 + ZD 247 (22.10 + 27.10) | 5 | 11 | 2 | 11 | 14 |
| propozycja 25.10 (30 linii) → ZD 247 z 27.10 (18 linii) | 6 | 5 | 1 | 18 | 6 |

Wzorce (hipotezy do potwierdzenia na produkcyjnym dzienniku):

1. **Odkładasz tanie, jednosztukowe linie** (druty 1 szt, kluczyk, izolator) i wracasz do nich przy następnym ZD — 11 z 16 „nie zamówionych” 22.10 weszło 27.10 albo wcale. Automat nie zna progu „nie warto dokładać linii za 60 zł do ZD”.
2. **Dokładasz towary spoza listy** (Remanium GM 800+/380+, Bertoni, Płytki woskowe, Klamry Adams) — prawdopodobnie prośby/klienci; w dev nie ma próśb z października, więc silnik ich nie widział.
3. **Podnosisz ilości** tam, gdzie silnik liczy z 30-dniowego okna, a Ty patrzysz na rytm zakupów (Śruba Fischera mini 3 → 8 op.; Lutowie 6 → 15; Orthocryl EQ 4 → 1, potem 15 — tu 25.10 silnik też dał 15).
4. **42 % linii Kreatora ląduje w „Weryfikacja”** (13 z 31) — każda linia z podbiciem 56–83 % pewności. To sam silnik mówi, że nie ufa swojej liczbie.
5. 52 towary Polkardu mają profil „rzadki” bez flagi „tylko na prośbę”; do propozycji weszły 2, do realnych ZD 4 — przy `max30_90` to nie generuje korekt.

Zastrzeżenie: propozycje dev ≠ produkcja (inne ustawienia, brak próśb). Liczby z produkcji da zapytanie A w §7.

## 6. Prace modułu (jtbd — przegląd) → stan → największa luka

| Praca | Rola | Stan | Największa luka |
|---|---|---|---|
| Ile zamówić, żeby starczyło do następnej dostawy | zakupy | liczy dobrze z tego, co dostaje | wejścia: KFS (D1), martwe ZD (D2), prośby w sprzedaży (L3/L4) |
| Kiedy i u kogo zamówić dziś | zakupy | sygnały spójne tablica↔lista | pełny brak niewidoczny (D4), p90 = max (D5), martwe ZD „czeka” (D2) |
| Dołożyć prośbę klienta bez podwójnego zamawiania | handlowiec → zakupy | overlap z ZK działa, ale | L1/L2 nadzamawiają, D3 blokuje wolny zapas, L9 dobija do paczki |
| Zaakceptować propozycję automatu szybciej niż liczyć od zera | zakupy | propozycja = Kreator tego dnia | brak dziennika per linia (L12) → nie wiadomo, czego automat się nie uczy |
| Wiedzieć, dlaczego tyle | zakupy | „Dlaczego tyle” pokazuje kroki | „dotąd 310 szt” w tabeli = strategia classic, czyta się jak „ostatnio zamówione” |

## 7. Co zmienić, żeby korekt było mniej (od najmniejszej zmiany)

1. **Dziennik korekt per linia** (`zd_auto_proposal_events`: linia, z ilu, na ile, kto, powód z listy: „za drogo na tę linię / klient / promocja / nie ufam tempu / inne”) + KPI liczone z niego, także dla propozycji wygasłych. Bez tego §5 pozostaje zgadywaniem, a stopień 3 automatu nie ma podstawy. Usuwa: ślepotę na „nie zamówiono” i „dodano”.
2. **Wiek otwartych ZD**: ZD po terminie + 7 dni → nie liczy się jako „w drodze” (silnik i radar), a trafia na listę „zamknij lub potwierdź” w panelu dziennym. Dziś 60 ZD / 334 tys. zł. Usuwa: Do ZD = 0 na towarze, który nie przyjedzie.
3. **ZK bez rezerwacji tylko z ostatnich 90 dni** (parametr `zkDataOd` w API albo filtr po stronie OnTime) i tylko wtedy w `free`; w tabeli pokazywać z datą najstarszego. Usuwa: prośby dokładane mimo stanu (D3).
4. **KFS w API** (prośba do Tomasza, P0): `sprzedazOkres` netto z korekt (KFS, ZW) — tak jak liczy `reports/sprzedaz/asortyment`. Usuwa D1.
5. **Prośby**: `need − relief` → `max(need, prośba)` tylko gdy need ≥ prośba (L1), overlap bez capu dla zwykłych linii (L2), odejmowanie próśb także przy opakowaniach w sztukach (L3), dostawa prośby liczona tylko od początku okna (L4). Przed zmianą policzyć na produkcji, ile linii trafia w `need < prośba` i `need = 0 ∧ overlap > 0`.
6. **Podbicie**: wyłączyć thin_cover/sell_through, gdy zadziałał mnożnik braków (L5); liczyć od celu bez zapasMin (L8); dla dostawców w strategii sprawdzić backtestem wariant „bez podbicia” — strategia już ma podłogę 90 d i bufor, a 42 % linii w „Weryfikacja” to koszt tego podbicia.
7. **Skok vs ostatnie ZD**: zapisać `dniZapasu` w snapshocie i liczyć oczekiwane na tamtych dniach; przy strategii pomijać (profil 12×30 już tnie skok) (L6). Mnożnik braków po profilu, nie przed (L7).
8. **Pełny brak**: gdy okno = 0 sprzedaży i stan = 0, tempo z profilu 12×30 (ostatni niezerowy miesiąc) i status „brak” zamiast „bez sprzedaży” (D4).
9. **p90 dopiero od 10 próbek**, 5–9 → p75; mniej → p50 + 25 % (D5).
10. **Próg wartości linii** w propozycji: linia poniżej X zł bez pilności → „odłóż do następnego ZD” (flaga, nie usunięcie) — to Twoja ręczna reguła z §5 pkt 1; wartość X z dziennika (pkt 1).
11. Drobne UI: „dotąd” → „classic: 310 szt”; „ZK bez rez.” z datą; panel dzienny „poza planem” z tej samej funkcji co tablica (L11).

## 8. Zapytania na produkcję (po zalogowaniu / z psql na serwerze)

```sql
-- A. korekty per dostawca (propozycje zaakceptowane)
WITH p AS (
  SELECT id, supplier_id, final_lines,
         COALESCE(NULLIF(to_jsonb(zd_auto_proposals)->'original_lines','null'::jsonb), lines) AS lines
    FROM zd_auto_proposals WHERE status = 'accepted' AND final_lines IS NOT NULL
), pl AS (
  SELECT p.id, p.supplier_id, l->>'twId' AS tw, (l->>'zdUnits')::numeric AS prop_u,
         COALESCE((p.final_lines->>(l->>'twId'))::numeric, 0) AS fin_u,
         CASE WHEN (l->>'priceNet') IS NOT NULL AND (l->>'zdUnits')::numeric > 0
              THEN (l->>'pieces')::numeric/(l->>'zdUnits')::numeric*(l->>'priceNet')::numeric END AS unit_val
    FROM p, jsonb_array_elements(p.lines) l
)
SELECT s.name, count(DISTINCT pl.id) AS proposals, count(*) AS lines,
       round(100.0*count(*) FILTER (WHERE fin_u <> prop_u)/count(*),1) AS pct_changed,
       round(100.0*count(*) FILTER (WHERE fin_u = 0)/count(*),1) AS pct_removed,
       round(100.0*count(*) FILTER (WHERE fin_u > prop_u)/count(*),1) AS pct_up,
       round(100.0*sum(abs(fin_u-prop_u)*unit_val)/NULLIF(sum(prop_u*unit_val),0),1) AS pct_value
  FROM pl JOIN suppliers s ON s.id = pl.supplier_id GROUP BY s.name ORDER BY proposals DESC;

-- B. ile propozycji wygasło bez decyzji (nie wchodzą do KPI)
SELECT s.name, status, count(*) FROM zd_auto_proposals p JOIN suppliers s ON s.id=p.supplier_id
 GROUP BY 1,2 ORDER BY 1,2;

-- C. pełne braki niewidoczne dla radaru (D4)
SELECT count(*) FROM stock_watch_items WHERE available_qty <= 0 AND sales_period_qty = 0 AND status = 'no_sales';
```

Subiekt (LAN): `GET /documents/zd?dataOd=2025-10-28` z filtrem `dok_Status IN (5,6,7)` i `dok_TerminRealizacji < dziś` — lista 60 zaległych ZD do przejrzenia (najwięcej Ivoclar: 11 ZD, 205 tys. zł, od 27.08).

## 9. Otwarte pytania do Ciebie

1. Linie „nie zamówione” 22.10 (druty 1 szt, kluczyk, izolator, Castorit) — odłożone świadomie (wartość linii / rytm) czy przeoczone? To decyduje, czy pkt 10 w §7 ma sens.
2. Śruba Fischera mini 3 → 8 op., Lutowie 6 → 15: skąd te ilości (promocja, klient, własne wyczucie rytmu)?
3. Ivoclar: 11 otwartych ZD po terminie od 27.08 (205 tys. zł) — realnie w drodze czy do zamknięcia?
4. Czy handlowcy wpisują ilość prośby w sztukach także dla towarów w opakowaniach (tryb A)? Od tego zależy waga L3.
5. Zgoda na prośbę do Tomasza o KFS w `sprzedazOkres` i `zkDataOd`/wiek ZK w estimate?

## 10. Czego nie sprawdziłem i czego nie zmieniłem

- L10 (MAX zamiast sumy przy zestawie z komponentów) — **nie jest błędem**: jeden zestaw zawiera oba składniki, więc 3 zestawy pokrywają prośbę na 3 A i 2 B; zostawione.
- L9 (dobicie do opakowania / wielokrotności na samej prośbie) — to warunek dostawcy, nie błąd silnika; bez zmian.
- L4 (prośba dostarczona przed oknem obniża sprzedaż w oknie) — wymaga daty wydania klientowi; w TASKS.md.
- L6 wyłączone tylko przy strategii; przy classic snapshot nadal nie pamięta dni zapasu z chwili ZD.


- Produkcyjne tabele i dziennik (patrz §1) — wszystkie liczby o korektach pochodzą z propozycji dev.
- Pary/BOM poza przykładami (Haczyki, Remanium): osobne wywołania cięć z historii nie były liczone ręcznie.
- Radar na produkcyjnych wierszach `stock_watch_items` (D4, L11 — logika z kodu).
- Testy jednostkowe nie były uruchamiane; przykłady w §4 liczone ręcznie z kodu.

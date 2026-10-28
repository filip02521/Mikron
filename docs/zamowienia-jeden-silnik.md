# Zamówienia do dostawców — jeden silnik, jedno miejsce decyzji

Status: zaakceptowany 2026-10-03. Etapy 1–3 wdrożone w PR #140 (silnik `src/lib/orders/zd-order-engine.ts` + `zd-order-list.ts`). Zastępuje kierunek „osobne szkice w panelu Braki”.

## 1. Cel

Każde ZD powstaje w **jednym miejscu** (Kreator ZD): widzę listę „co pójdzie na ZD”, edytuję, tworzę dokument.
Wszystko inne (panel dzienny, panel Braki, alerty) tylko **prowadzi do tego miejsca** — z gotową, sensownie policzoną listą.

Lista ma uwzględniać nie tylko sprzedaż i zapas, ale też **kiedy towar faktycznie przyjedzie** (czas dostawy dostawcy) i **kiedy będzie kolejne zamówienie** (harmonogram).

## 2. Stan obecny — fakty (baza lokalna z 2026-09-04 + Subiekt LIVE)

| Obszar | Fakt | Skutek |
|---|---|---|
| Zakresy dostawców | 51 z 206 aktywnych dostawców ma przypisaną grupę/cechę; jeden zakres na dostawcę (PK `supplier_id`); 3 zakresy wspólne dla kilku dostawców | 75% dostawców poza kreatorem i poza analizą; dostawca z towarami w kilku grupach widzi tylko jedną |
| Kto naprawdę dostarcza towar | `product_supplier_links` (z historii ZD): 8006 towarów przypisanych; 780 ma >1 dostawcę | 312 z 4907 analizowanych towarów jest w zakresie innego dostawcy niż ten, od którego je kupujemy |
| Czas dostawy | `delivery_stats_samples`: 455 próbek od 2026-05, 81 dostawców (np. Ivoclar śr. 7,5 dnia rob., max 21; IPD 1,5) | Dane są, ale kreator ich nie używa |
| Harmonogram | 148 aktywnych dostawców ma `computed_next_date`, 24 „na żądanie” | Kreator nie wie, kiedy będzie następne zamówienie |
| Formuła kreatora | `cel = sprzedaż dzienna × dni zapasu (+ zapasMin)`, korekta boost/cięcia, historia ostatniego ZD, prośby, pary, BOM, opakowania, minimum, wykluczenia; `Do ZD = cel − dostępne − otwarte ZD` | Dobra baza; brakuje czasu dostawy i cyklu zamówień |
| Uruchomienie | Ręcznie, na żywo, per dostawca; duże cechy (Ivoclar) liczą się minutami | Brak gotowej listy rano; brak wczesnego ostrzegania |
| Panel Braki (PR #140) | Własny, uproszczony wzór + własne szkice + własne tworzenie ZD | Dwie różne liczby i dwie ścieżki tworzenia ZD — do usunięcia |
| Cały katalog | 495 grup, 18 190 towarów; 51 zakresów (4907 towarów) liczy się ~3 min | Pełny katalog po grupach w nocy: ok. 12–15 min — mieści się w kilku slotach crona |

## 3. Wybrane rozwiązanie

### 3.1 Trzy warstwy

1. **Silnik zamówień** (jeden, wspólny) — liczy listę „Do ZD” dla dostawcy. Używa go nocny przebieg i Kreator ZD. Ta sama liczba wszędzie.
2. **Kreator ZD** — jedyne miejsce decyzji: lista, edycja ilości, prośby, „Utwórz ZD”, post-create (harmonogram, prośby, historia).
3. **Radar** (panel dzienny + panel Braki) — mówi *kiedy* i *u kogo* zamówić; przycisk „Przygotuj ZD” otwiera Kreator z gotową listą. Panel Braki **nie tworzy ZD i nie ma własnych szkiców**.

### 3.2 Kto dostarcza towar — tylko przypisane grupy i cechy

**Decyzja (2026-10-03):** źródłem prawdy są **ręcznie przypisane grupy/cechy** dostawców (na produkcji 83 mapowania).
Panel i Kreator pokazują wyłącznie towary z aktywnych mapowań — nigdy całego katalogu Subiekta,
bo w Subiekcie są tysiące starych, niezamawianych już towarów.

- Nowy dostawca / nowa linia produktów pojawia się dopiero po przypisaniu grupy lub cechy (świadoma decyzja).
- Historia ZD (`product_supplier_links`) może służyć tylko jako **podpowiedź** w obrębie przypisanych zakresów
  (np. „ten towar z Twojej grupy kupujesz od innego dostawcy”) — nigdy nie dokłada towarów spoza zakresów.

### 3.3 Ile zamówić — horyzont pokrycia (opcja „Do kolejnej dostawy”)

**Decyzja (2026-10-03):** horyzont to **opcja w Kreatorze, domyślnie wyłączona**. Bez niej Kreator liczy
dokładnie jak wcześniej (dni zapasu z karty). Zaznaczenie przelicza listę; odznaczenie wraca do starego wzoru.
Nocny przebieg i panel Braki liczą ilości bez opcji (zgodność z Kreatorem); czas dostawy służy tam tylko do sygnałów.

- `L` — czas dostawy: p90 z dostaw „Główne” (od 5 dostaw), inaczej p50, bez historii 7 dni; dni robocze → kalendarzowe
  (weekendy, polskie święta). Te same kwantyle co w panelu dziennym.
- `N` — dni do kolejnego planowego zamówienia **po dzisiejszym** (`computed_next_date`; gdy plan wypada dziś
  lub jest zaległy — z interwału). Dostawca „na żądanie” → 0.
- `Z` — zapas z karty dostawcy (minimum).

**`H = max(Z, N + L)`** — cel = rotacja × H; okno sprzedaży bez zmian. p90 już zawiera margines na wolniejsze
dostawy, więc bez osobnego zapasu bezpieczeństwa (żeby nie liczyć niepewności dwa razy).
Lokalnie opcja zmienia ilości u 5 z 52 dostawców (np. Amadar: dostawa ~26 d, kolejne zamówienie za 23 d → 3 → 14 pozycji).

### 3.3a Nietypowa sprzedaż — profil 12 miesięcy (opcja „Wygładź skoki”)

Bazowy cel z Subiekta to sprzedaż w oknie ÷ dni okna × dni zapasu, więc jedna duża faktura
albo sprzedaż pod klienta trafia w cel i Kreator dokupuje na stan. Ten sam endpoint
`/orders/zd/estimate` zwraca sprzedaż dla dowolnego okna, więc profil to 12 okien po 30 dni
(`zd_sales_profiles`, migracja 164). Nocny przebieg odświeża go, gdy ma ponad 3 dni; Kreator
używa profilu do 14 dni od razu i odświeża go w tle (liczy synchronicznie tylko, gdy brak).
Zapis: upsert + usunięcie towarów spoza zakresu, jedno liczenie zakresu naraz, profil starszego
okna nie nadpisuje nowszego.

- Klasyfikacja: **skok** (okno ≥ 3× typowego miesiąca, ≥ 5 szt), **rzadki** (sprzedaż w ≤ 3 z 12
  okien; też pojedyncza sprzedaż po roku ciszy), **nowość** (sprzedaż w ≥ 2 z ostatnich 3 okien)
  i **wzrost** (bez zmian), **regularny**. Znaczniki pod nazwą zawsze;
  „pod zamówienie?” dodaje towar do „Tylko na prośbę” (z potwierdzeniem).
- Opcja (domyślnie wyłączona) tylko obniża: skok → max(mediana, p75) poprzednich okien, rzadki →
  średnia z 12 okien, sprzedaż pod zrealizowane prośby odjęta (dostawy od 14 dni przed oknem do
  3 dni przed jego końcem — sprzedaż idzie kilka dni po dostawie). Przy włączonej opcji rzadki
  nie dostaje podbicia za wyprzedanie, a stary „skok” (vs ostatnie ZD) jest pomijany dla towarów
  z profilem. Wzór celu z API sprawdzony na 320/320 towarach (cel = sprzedaż ÷ dni okna × dni
  zapasu + zapas min.).
- Pary i komplety: bez profilu (popyt łączony ze składnikami / wkładem kompletów). Prośby
  odejmowane tylko bez opakowań (prośba w sztukach).

### 3.4 Kiedy zamówić — sygnały radaru

Dla każdego towaru dostawcy liczymy `dni do wyczerpania = dostępne / rotacja` i porównujemy z kalendarzem:

| Sygnał | Warunek | Co widzę |
|---|---|---|
| **Pilne — poza planem** | wyczerpanie < `L` (skończy się, zanim przyjedzie zamówienie złożone dziś) | panel dzienny: sekcja „Zamów dziś poza planem”, panel Braki: czerwona strefa |
| **Przed kolejną dostawą** | wyczerpanie < `N + L` | „Dostawca X: 5 SKU skończy się przed dostawą z planowego zamówienia 15.10” — propozycja przyspieszenia |
| **Planowe** | dzień z harmonogramu | panel dzienny jak dziś — lista już policzona w nocy |

Dostawca „na żądanie” — tylko sygnał „Pilne”, bez planowych.

Panel Braki: licznik pilnych przy dostawcy i lista po jego rozwinięciu liczą to samo — pozycje bez stanu, w stanie krytycznym albo z ryzykiem dostawy (`isStockWatchSupplierUrgent` w `src/lib/stock-watch/dashboard.ts`, PR #249). To szerzej niż widok „Wszystkie braki”: obejmuje też ≤ 48 h z dostawą w drodze i ryzyko przed kolejną dostawą.

### 3.5 Przepływ dnia

1. **Noc (po synchronizacji katalogu):** silnik liczy wszystkich dostawców; zapis propozycji i sygnałów.
2. **Rano — panel dzienny:** dostawcy z terminem dziś (jak teraz) + „Pilne poza planem”. Panel Braki: przegląd, reguły, rotacja.
3. **„Przygotuj ZD”** (z panelu dziennego albo Braki) → Kreator otwiera się od razu z listą z nocy (bez czekania minutami); „Przelicz” odświeża na żywo przed utworzeniem.
4. **Kreator:** edycja ilości, prośby, „Utwórz ZD” → post-create jak dziś (harmonogram, prośby, historia ZD).

### 3.6 Czego nie robimy

- Brak stanów po stronie dostawców (brak API).
- Brak osobnych szkiców i tworzenia ZD w panelu Braki.
- Bez prognoz sezonowych w pierwszej wersji (trend 30/60 tylko informacyjnie).

## 4. Wdrożenie etapami

| Etap | Zakres | Kryterium odbioru |
|---|---|---|
| 1. Jeden silnik | Wydzielenie obliczeń kreatora do modułu serwerowego używanego przez Kreator i nocny przebieg; panel Braki pokazuje „Do ZD” z tego silnika; usunięcie szkiców i tworzenia ZD z panelu; „Przygotuj ZD” = otwarcie Kreatora | Dla 5 dostawców liczba w panelu = „Do ZD” w Kreatorze (ten sam dzień danych) |
| 2. Porządek w zakresach ✅ | Tylko w obrębie przypisanych grup/cech. Indeks towar → grupa/cechy z Subiekta (nocą lub „Odśwież teraz”); podpowiedzi zakresów z historii ZD (pokrycie + czystość); kilka zakresów na dostawcę (Kreator i noc łączą w jedną listę); wspólne zakresy — przypisanie towaru do dostawcy; „Ostatnie ZD: …” w Kreatorze | Okno Zakresy pokazuje pokrycie i podpowiedzi; Kreator dla dostawcy wspólnego zakresu liczy właściwego dostawcę |
| 3. Czas dostawy i harmonogram ✅ | Opcja „Do kolejnej dostawy” w Kreatorze (domyślnie wyłączona, przełącznik w formularzu i w pasku listy, pamiętana w sesji); sygnały „przed dostawą” / „przed kolejną dostawą” w panelu Braki; baner „Zamów dziś poza planem” w panelu dziennym | Horyzont zgodny z ręcznym wyliczeniem (testy); bez opcji ilości bez zmian |
| 4. Gotowa lista w Kreatorze — rezygnacja | Decyzja 2026-10-03: niepotrzebne — ZD powstaje świadomie z „Przygotuj ZD”, które liczy listę na żywo | — |

## 5. Decyzje (przyjęte 2026-10-03, wdrożone w etapach 1–3)

1. Horyzont `H = max(zapas, do kolejnego zamówienia + czas dostawy)` — zapas z karty dostawcy zostaje minimum.
2. Czas dostawy = 90. percentyl z próbek (§3.3; pierwotna propozycja: 80.), zamówienia Główne.
3. Główny dostawca towaru = ostatnie ZD; ręczna zmiana nadpisuje.
4. Panel Braki bez szkiców i bez tworzenia ZD — wszystko przez Kreator.

## 6. Poprawki z audytu 28.10.2026 (gałąź `claude/orders-products-analysis-f90cfa`)

Raport: `docs/audyt-procesu-zamowien-2026-10-28.md`. Zmiany w silniku, wszystkie z testami jednostkowymi:

| Co | Gdzie | Reguła |
|---|---|---|
| Zaległe ZD nie są „w drodze” | `src/lib/data/zd-stale-open-zd.ts`, silnik przed mnożnikiem braków | otwarte ZD po terminie + 7 dni (bez terminu: 60 dni od wystawienia) odjęte od `otwarteZd`; kopia `subiekt_zd_index` ⋈ `zd_purchase_lines`; statusy zaległych odświeżane nocą w `catalog-zd-sync` |
| Zwroty (KFS) odjęte od sprzedaży | `src/lib/data/subiekt-sales-corrections.ts`, mig. 202 | nocny odczyt `/documents?typ=6` do `subiekt_sales_corrections`; w silniku sprzedaż w oknie, cel i okna profilu 12 × 30 d netto |
| ZK bez rezerwacji nie zabierają wolnego towaru | `freeSupplyForProsbaPieces` | 92 % tych ZK to martwe dokumenty sprzed lat; prośba bierze z półki to, co jest ponad cel |
| Pełny brak w oknie | `applyZdStockoutFallbackToLine` | stan ≤ 0 i sprzedaż 0 → tempo ze średniej 3 okien profilu sprzed okna Kreatora |
| Czas dostawy z małej próbki | `quantilesFromSampleRows` | 5–9 próbek → p75 (nearest rank p90 był maksimum), od 10 → p90 |
| Prośba a rezerwacja ZK klienta | `resolveOrderQtyForLine` | rezerwacja (własny ZK i inne ZK klienta) zmniejsza prośbę, nie need; stan 12 / rez 5 / cel 10 / prośba 5 → 3 |
| Prośby odejmowane także przy opakowaniach | silnik | prośba jest w sztukach karty jak sprzedaż z API |
| Podbicie po mnożniku braków | `computeSalesTrackedCel` | `stockoutApplied` wyłącza thin_cover i sell_through; podbicia, cięcia, sufity i podłogi liczone od celu bez `zapasMin` |
| Skok vs ostatnie ZD | `historySpikeCut` | wyłączone przy strategii ≠ classic (skok tnie profil 12 × 30 d) |
| Profil klasyfikuje sprzedaż sprzed mnożnika braków | silnik | sprzedaż ×2 po brakach nie wygląda jak skok |
| Dziennik decyzji per linia | `src/lib/data/zd-line-decisions.ts`, mig. 203 | każde „Utwórz ZD”: propozycja silnika vs ZD, także linie zdjęte; KPI `lineCorrection` w `zd_kpi_weekly` i w tabeli Automatu |
| Pamięć korekt | `src/lib/orders/zd-user-pattern.ts` | 3 z 4 ostatnich decyzji w tę samą stronę → cel × mediana (0,5–2) albo znacznik „zwykle zdejmujesz”; flaga `habit` w propozycji; krok w „Dlaczego tyle”. Dziennik zapisuje `pattern_factor`, więc stosunek liczy się do surowej propozycji silnika — zaakceptowanie dopasowanej ilości utrzymuje wzorzec, nie kasuje go |
| Panel dzienny „poza planem” | `listStockWatchOffPlanSuppliers` | towar wspólnego zakresu liczony raz, u właściciela (jak tablica Braki) |
| Karta produktu: „Ruch towaru” i „Starsze zakupy” | `src/lib/orders/zd-product-movement.ts`, `ZdProductHistorySections.tsx`, `actionFetchZdProductOlderPurchases` | ZD + przyjęcia + sprzedaż w jednej osi; zakres: okno zapasu (min. 30 d), 3 mies., 12 mies., cała historia; dostawa wzięta w całości przez jednego klienta wyróżniona; starsze zakupy z całej kopii ZD na żądanie (do 500 linii) |

Do zrobienia na produkcji: migracje 202 i 203 (panel admina), pierwsza noc `catalog-zd-sync` wczyta ~900 KFS z 13 miesięcy (własny budżet, w razie braku czasu w slocie — następnej nocy) i odświeży statusy do 150 zaległych ZD. Nic poza tym — brak nowych zadań crona, brak zmian w `.env`.

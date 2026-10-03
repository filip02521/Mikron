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
(`zd_sales_profiles`, migracja 164), liczony przy Policz / nocnym przebiegu, gdy profil zakresu
ma ponad 3 dni.

- Klasyfikacja: **skok** (okno ≥ 3× typowego miesiąca, ≥ 5 szt), **rzadki** (sprzedaż w ≤ 3 z 12
  okien), **nowość** i **wzrost** (bez zmian), **regularny**. Znaczniki pod nazwą zawsze;
  „pod zamówienie?” dodaje towar do „Tylko na prośbę” (z potwierdzeniem).
- Opcja (domyślnie wyłączona) tylko obniża: skok → max(mediana, p75) poprzednich okien, rzadki →
  średnia z 12 okien, sprzedaż pod zrealizowane prośby (dostawa w oknie) odjęta. Rzadki bez
  podbicia za wyprzedanie; wygładzony towar pomija stary „skok” liczony z ostatniego ZD.
- Pary i komplety: tylko znacznik (popyt łączony). Prośby odejmowane tylko bez opakowań.

### 3.4 Kiedy zamówić — sygnały radaru

Dla każdego towaru dostawcy liczymy `dni do wyczerpania = dostępne / rotacja` i porównujemy z kalendarzem:

| Sygnał | Warunek | Co widzę |
|---|---|---|
| **Pilne — poza planem** | wyczerpanie < `L` (skończy się, zanim przyjedzie zamówienie złożone dziś) | panel dzienny: sekcja „Zamów dziś poza planem”, panel Braki: czerwona strefa |
| **Przed kolejną dostawą** | wyczerpanie < `N + L` | „Dostawca X: 5 SKU skończy się przed dostawą z planowego zamówienia 15.10” — propozycja przyspieszenia |
| **Planowe** | dzień z harmonogramu | panel dzienny jak dziś — lista już policzona w nocy |

Dostawca „na żądanie” — tylko sygnał „Pilne”, bez planowych.

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

## 5. Decyzje do potwierdzenia

1. Horyzont `H = max(zapas, do kolejnego zamówienia + czas dostawy)` — zapas z karty dostawcy zostaje minimum.
2. Czas dostawy = 80. percentyl z próbek (bezpieczniej niż średnia), zamówienia Główne.
3. Główny dostawca towaru = ostatnie ZD; ręczna zmiana nadpisuje.
4. Panel Braki bez szkiców i bez tworzenia ZD — wszystko przez Kreator.

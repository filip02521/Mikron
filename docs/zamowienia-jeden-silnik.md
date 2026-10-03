# Zamówienia do dostawców — jeden silnik, jedno miejsce decyzji

Status: zaakceptowany 2026-10-03. Etap 1 wdrożony w PR #140 (silnik `src/lib/orders/zd-order-engine.ts` + `zd-order-list.ts`). Zastępuje kierunek „osobne szkice w panelu Braki”.

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

### 3.2 Kto dostarcza towar

Przypisanie towar → dostawca z **historii ZD** (`product_supplier_links`), a nie z grupy:

- główny dostawca = ten z ostatniego ZD (przy remisie: więcej zamówień),
- ręczna zmiana w karcie towaru / w Kreatorze (nadpisuje historię),
- towar bez historii ZD → dostawca z zakresu grupy/cechy (jak dziś) albo „bez dostawcy” do przypisania.

Grupy/cechy zostają tylko jako **sposób pobrania danych** z Subiekta (`/orders/zd/estimate` filtruje po grupie/cesze). Nocny przebieg idzie po wszystkich grupach, więc pokrywa cały katalog.

### 3.3 Ile zamówić — horyzont pokrycia

Dla dostawcy:

- `L` — czas dostawy: 80. percentyl z `delivery_stats_samples` (zamówienia Główne, ostatnie 6 mies.), dni robocze przeliczone na kalendarzowe; brak próbek → wartość z karty dostawcy, a gdy jej brak → 7 dni.
- `N` — dni do kolejnego planowego zamówienia (`computed_next_date`); dostawca „na żądanie” → 0.
- `Z` — zapas z karty dostawcy (`stock_raw`, jak dziś).

**Horyzont `H = max(Z, N + L)`** — zamówienie musi wystarczyć co najmniej do przyjazdu kolejnej dostawy; polityka „zapasu” zostaje jako minimum.

Dla towaru (sztuki):

- `cel = rotacja × H + zapas bezpieczeństwa`, gdzie zapas bezpieczeństwa = `rotacja × (L80 − Lśr)` (niepewność czasu dostawy);
- dalej **bez zmian względem kreatora**: korekta boost/cięcia, historia ostatniego ZD, minimum stanów, prośby handlowców, pary (paczka/sztuka), komplety BOM, wykluczenia, „na prośbę”;
- `Do ZD = cel − dostępne − otwarte ZD` (ZK bez rezerwacji tylko informacyjnie), przeliczone na opakowania.

Rotacja: jak w kreatorze (okno sprzedaży = dni zapasu), z dodatkowym wskaźnikiem trendu 30/60 dni tylko do podglądu.

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
| 2. Dostawca z historii ZD | Przypisanie towar → dostawca z `product_supplier_links` + ręczna zmiana; nocny przebieg po wszystkich grupach; Kreator domyślnie filtruje do towarów dostawcy | Panel obejmuje wszystkich dostawców z historią ZD; 0 towarów pod złym dostawcą |
| 3. Czas dostawy i harmonogram | `L`, `N`, horyzont `H`, zapas bezpieczeństwa; sygnały „Pilne” i „Przed kolejną dostawą”; sekcja w panelu dziennym | Dla dostawcy z próbkami H i sygnały zgodne z ręcznym wyliczeniem |
| 4. Gotowa lista w Kreatorze | Kreator otwiera się z listą z nocy + znacznik wieku danych; „Przelicz” na żywo | Otwarcie Ivoclar < 3 s zamiast minut |

## 5. Decyzje do potwierdzenia

1. Horyzont `H = max(zapas, do kolejnego zamówienia + czas dostawy)` — zapas z karty dostawcy zostaje minimum.
2. Czas dostawy = 80. percentyl z próbek (bezpieczniej niż średnia), zamówienia Główne.
3. Główny dostawca towaru = ostatnie ZD; ręczna zmiana nadpisuje.
4. Panel Braki bez szkiców i bez tworzenia ZD — wszystko przez Kreator.

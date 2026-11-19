# Panel dzienny: jedna lista dostawców na dziś — plan wdrożenia

> **Dla wykonawcy (agent):** wymagana pod-umiejętność: `superpowers:subagent-driven-development` (zalecane) albo `superpowers:executing-plans`. Kroki mają pola `- [ ]`. Projekt (spec) jest w tym samym pliku, w części „Projekt” — czytaj obie części.

**Status:** wdrożone lokalnie, bez commitów (10.11.2026) — Zadania 0–6 zrobione, Zadanie 7 bez sprawdzenia na produkcji. Makieta układu zaakceptowana w rozmowie 10.11.2026.

**Cel:** na zakładce „Dziś” w `/podsumowanie` każdy dostawca, u którego trzeba dziś coś zrobić, ma jeden wiersz, pogrupowany według tego, co zrobić, z etykietą źródła (Automat / Harmonogram / Poza planem / Na żądanie) i jedną szybką akcją.

**Architektura:** czysta funkcja `buildDailySupplierRows` skleja dane, które strona już pobiera (harmonogram, automat ZD, analiza Braki, „poza planem”, „na żądanie”, prośby) w listę wierszy z grupą i akcją. Nowy komponent `DailySupplierList` rysuje ją w miejscu dzisiejszych sekcji „Zaległe”, „Na dziś”, listy zamówień automatu i banera „Zamów dziś poza planem”. Bez zmian w bazie, akcjach serwera i zapytaniach.

**Stos:** Next.js 16 (App Router), React 19, Tailwind 4, Vitest. Komponenty z `src/components/ui/` i klasy z `src/lib/ui/ontime-theme.ts`.

## Ograniczenia globalne

- `DESIGN.md` jest normatywny: reguła „Pulpit” (jeden wiersz na obiekt, ten sam obiekt nie w dwóch tabelach, szczegóły pod wierszem), „Jedno wybrane” (chip filtra: `panelChoiceChipSelectedClass` / `panelChoiceChipIdleClass`), bez paska z boku wiersza, bez karty w karcie, stan ikoną ze `StrokeIcons` + tekst, liczebniki przez `polishPluralWord`.
- Jedna główna akcja na wiersz; przycisk to czasownik. Etykiety akcji dokładnie: „Sprawdź i wyślij”, „Sprawdź”, „Wyślij mail”, „Przygotuj ZD”, „Przesuń”, „Zamówione”, „Pokaż w Braki”.
- Nazwy grup dokładnie: „Do wysłania”, „Do zamówienia”, „Zamów wcześniej”, „Do przesunięcia”, „Do sprawdzenia ręcznie”, „Zrobione dziś”.
- Etykiety źródeł dokładnie: „Automat”, „Harmonogram”, „Poza planem”, „Na żądanie”.
- Wiersz mieści się w jednej linii nazwy + jednej linii meta przy szerokości panelu (48rem); nazwa dostawcy może się zawinąć, nie dostaje wielokropka. Przy 375 px akcja schodzi pod tekst na pełną szerokość, min. 44 px.
- Żadnej nowej zależności. Żadnych zmian w `src/app/actions/`, `src/app/api/`, migracjach.
- Repo jest publiczne: w testach i komentarzach wyłącznie wymyślone nazwy dostawców (np. „Alfa Dental”, „Beta Frez”).
- Po każdym zadaniu: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run audit:design` — każde osobno, wynik z kodu wyjścia, bez `| tail`. Nowe pliki `git add -N` przed `audit:design` (audyt chodzi po `git ls-files`).
- Commit po zadaniu tylko, gdy użytkownik zezwoli na commity w tej pracy; inaczej punktem kontrolnym jest zielony przebieg powyższych.

## Projekt

### Praca do wykonania

Rola: zakupy / import (także admin). *Kiedy zaczynam dzień zamówień, chcę zobaczyć każdego dostawcę raz, z tym, co mam u niego zrobić, żeby przejść listę od góry do dołu i niczego nie zamówić podwójnie ani nie pominąć.*

Dane: kod + lokalny dev (kopia sprzed ok. 2 miesięcy). Produkcja niedostępna w sesji planowania (wygasła sesja) — liczby z produkcji zbiera Zadanie 0.

### Stan dziś (z kodu, `DailyTodayView.tsx`, `SummaryWorkspace.tsx`)

Ten sam dostawca może stać na zakładce „Dziś” w sześciu miejscach:

| Miejsce | Źródło danych | Akcja |
|---|---|---|
| Sekcja „Automat ZD” (lista zamówień) | `zdAutomatTodayOrders(zdAutomat.suppliers)` | Sprawdź i wyślij / Wyślij mail |
| „Zaległe” | `workspace.left` (termin < dziś) | Zamówione / Przesuń, „Przygotuj ZD” z analizy |
| „Na dziś - harmonogram” (+ propozycje automatu „poza planem na dziś”) | `workspace.left` (termin = dziś), `autoProposals` | jw. |
| Baner „Zamów dziś poza planem” | `offPlanSuppliers` | Przygotuj ZD |
| Arkusz „Na żądanie” (ranking wg braków) | `workspace.onDemandSuppliers` + `stockSignalBySupplierId` | Przygotuj ZD |
| „Brak na stanie”, „Prośby handlowców” | `workspace.stockOutLeft`, `workspace.forSomeoneLeft` | akcje próśb |

Na lokalnym dev jeden dostawca stoi jednocześnie w „Automat ZD” i w „Zaległe”, z dwiema drogami do tego samego zamówienia.

### Pomiar na produkcji (10.11.2026, wtorek, zakładka „Dziś”, tylko odczyt)

| Miejsce | Dostawców | Uwagi |
|---|---|---|
| „Automat ZD” (zamówienia na dziś) | 5 | wszystkie „do sprawdzenia” |
| „Na dziś - harmonogram” | 5 | te same 5 co w „Automat ZD”, jako „poza planem na dziś”; prawdziwych terminów na dziś 0 |
| „Zaległe” | 2 | 1 ze „Stan wystarcza”, 1 z pracą w analizie (11 poz.) |
| Baner „Zamów dziś poza planem” | 54 | widać 6 (ranking wg liczby towarów: 48, 22, 18, 14, 12, 9), reszta pod „+48 w panelu Braki”; plany od „za 2 dni” do „za 41 dni” |
| Arkusz „Na żądanie” | 49 | 5 z pilnymi brakami i „Przygotuj ZD”, 1 „Stan wystarcza”, 43 bez analizy |
| „Brak na stanie” / „Prośby handlowców” | 1 sygnał / 6 grup | |

Wnioski dla układu:

- Powtórzenie jest pełne: 5 z 5 pozycji „Na dziś” to duplikaty sekcji automatu.
- Nowa lista miałaby ok. 66 wierszy: 5 do wysłania, 6 do zamówienia (1 z terminu, 5 na żądanie), 1 do przesunięcia, 0 ręcznie i 54 poza planem. Poza planem to ok. 80% listy, więc wrzucone do „Do zamówienia” zrobiłyby z niej ścianę. Dlatego dostają własną grupę „Zamów wcześniej” z rankingiem i krótkim podglądem (niżej).
- Krok 0a (z danych strony, 10.11): z 54 dostawców poza planem 2 mają czekające zamówienie automatu (wejdą do „Do wysłania”), 2 są „na żądanie” (wejdą do „Do zamówienia”), 0 ma termin w harmonogramie; „Zamów wcześniej” ma więc 50 wierszy. Wszyscy 54 mają analizę i kartę dostawcy. Rozkład liczby zagrożonych towarów: 48, 22, 18, 14, 12, 9, 8, 7, 6, 6, 6, potem 4 × 5, 2 × 4, 3 × 3, 14 × 2 i 20 × 1 — długi ogon, więc ranking i podgląd 6 mają sens. Reguła 5 (propozycja u dostawcy spoza automatu) tego dnia nie wystąpiła.
- Krok 0b: znacznik „ZD utworzone dziś” istnieje w danych (`zd_estimate_order_snapshots`, `subiekt_zd_index`), ale panel dzienny ich nie pobiera; użycie wymaga nowego zapytania, czyli wykracza poza „bez zmian w zapytaniach”. Zostaje jak dziś (wiersz znika po nocnej analizie); osobna zmiana, jeśli okaże się potrzebna.

### Nowy układ zakładki „Dziś”

Od góry:

1. **Pasmo stanu** (`DailyPanelStatusBand`) zostaje z jednym zdaniem „N w kolejce” i krokami kolejki; kroki Automat ZD / Zaległe / Na dziś zastępują kroki grup: „Do wysłania (5)”, „Do zamówienia (6)”, „Zamów wcześniej (54)”, „Do przesunięcia (1)”, „Ręcznie (0 — krok pominięty)”, dalej „Brak na stanie”, „Prośby handlowców”. Osobnego zdania z rozbiciem na grupy nie ma: ta sama liczba nie stoi w zdaniu, w kroku i w nagłówku grupy naraz (DESIGN.md → Pulpit). Krok przewija do swojej grupy; gdy filtr źródła ją ukrywa, klik najpierw zdejmuje filtr.
2. **Rezygnacje handlowców** — jak dziś, nad listą.
3. **Linia stanu automatu** (to, co zostaje z sekcji „Automat ZD”): tylko gdy jest problem — „dziś bez nocnego przebiegu (ostatni pn 19.10)”, „automat stoi u 2 dostawców” — z linkiem „Pulpit automatu” (`/zakupy/automat`), który zastępuje dzisiejsze „Pokaż powód”. Rozwijana tabela „Dostawcy (N)” ze stanem automatu (powód zatrzymania, obniżony stopień, „Ustawienia”) znika z panelu dziennego: jej miejsce to pulpit automatu (reguła „Ustawienia obiektu” / „Pulpit”).
4. **Pasek filtra źródła** (chipy z licznikiem): „Wszyscy 8”, „Automat 2”, „Harmonogram 4”, „Poza planem 1”, „Na żądanie 1”. Jeden wybrany naraz, zapis w adresie `?zrodlo=automat|harmonogram|poza-planem|na-zadanie` (brak parametru = wszyscy). Chip z licznikiem 0 nie jest rysowany. Liczniki nie obejmują grupy „Zrobione dziś”.
5. **Lista dostawców** w jednej karcie, grupy z nagłówkiem (nazwa grupy, licznik w Meta, jedno zdanie „dlaczego tu”), każda z kotwicą `kolejka-dostawcy-<grupa>`:
   - **Do wysłania** — „automat przygotował zamówienie”
   - **Do zamówienia** — „analiza Braki albo prośby mówią: zamów”
   - **Zamów wcześniej** — „zapas nie wystarczy do planowego zamówienia” (dostawcy poza planem; ranking wg liczby zagrożonych towarów, podgląd 6)
   - **Do przesunięcia** — „termin dziś, stan wystarcza”
   - **Do sprawdzenia ręcznie** — „brak aktualnej analizy stanu albo urlop dostawcy”
   - **Zrobione dziś** — zwinięta, na końcu
   Pod listą link „Wszystkie braki” (`/zakupy/braki`), który dziś jest w banerze poza planem.
6. Pod listą bez zmian: „Brak na stanie”, „Prośby handlowców” (obiektem tych sekcji jest prośba, nie dostawca). Dziś prośby stoją między „Zaległe” a „Na dziś”; po zmianie są pod wszystkimi dostawcami — dlatego grupy „Do przesunięcia” i „Do sprawdzenia ręcznie” pokazują najwyżej 5 wierszy, gdy mają ich więcej niż 8 (patrz „Decyzje do potwierdzenia”, pkt 1).

### Wiersz dostawcy

- Lewa strona: przycisk-chevron (rozwija szczegóły), nazwa dostawcy (Item, klik otwiera kartę dostawcy `SupplierDrawer` — jak dziś; gdy dostawcy nie ma w `supplierMeta`, nazwa jest zwykłym tekstem), pod nią linia Meta: odznaka źródła (ikona + słowo), termin („termin 07.11” albo „zaległy 3 dni”), odznaka urlopu (z `item.vacationNote` przez `vacationNoteLabel`, a „Urlop” gdy dostawca jest w `suppliersOnVacationNow`), „2 prośby” (przewija do sekcji „Prośby handlowców” i ustawia jej wyszukiwanie na nazwę dostawcy; sekcja nie ma kotwic dostawców, tylko torów).
- Środek: jeden stan, najwyżej trzy słowa + liczba: „5 pilnych · 42 poz.”, „3 skończą się”, „33 poz. · 8 484 zł”, „ZD gotowe”, „Subiekt nie potwierdził”, „Stan wystarcza”, „Brak analizy”, „analiza z 19.10”. Zamówienie automatu z ostrzeżeniem (oflagowane pozycje, nietypowo wysoka wartość, pozycje „na prośbę”) dostaje odznakę `warning` „do sprawdzenia” przy stanie; treść ostrzeżeń jest w rozwinięciu.
- Prawa strona: jedna akcja.
- Rozwinięcie (pod wierszem, blok `well`): pełna linia analizy Braki (`SupplierStockSignal`), kontakt (`SupplierContactActions`), zdanie o urlopie (`formatUrgentVacationHint`) i notatka planisty, dla automatu: 3 kroki etapu, tekst etapu („Subiekt nie potwierdził zapisu ZD…”, „ZD w Subiekcie · jeszcze nie wysłane”, numer ZD, godzina wysyłki), „czeka od… wygasa…”, ostrzeżenia propozycji (`DailyZdProposalNotice` bez własnego przycisku głównego) i „Odrzuć”; dla poza planem: „plan 21.11 · za 9 dni”; pozostałe akcje: „Zamówione”, „Przesuń”, „Urlop”, „Edytuj”, „do kolejnej dostawy”.
- Pole wyboru do zbiorczego „Zamówione (N)” zostaje przy wierszach, które mają termin harmonogramu (praca, którą dziś robi nagłówek „Zaległe”); przycisk zbiorczy i „Wszystkie” w nagłówku listy, z tym samym potwierdzeniem co dziś. „Wszystkie” zaznacza widoczne wiersze z terminem; zmiana filtra źródła czyści zaznaczenie, więc „Zamówione (N)” nigdy nie obejmuje wiersza, którego nie widać.

### Reguły grup (pierwsza pasująca)

| # | Warunek | Grupa | Akcja |
|---|---|---|---|
| 1 | zamówienie automatu na dziś w etapie `sent` | Zrobione dziś | — |
| 2 | zamówienie automatu w etapie `review` | Do wysłania | Sprawdź i wyślij |
| 3 | etap `unconfirmed` | Do wysłania | Sprawdź |
| 4 | etap `send` | Do wysłania | Wyślij mail, gdy propozycja ma `dokId`; bez `dokId` brak akcji (jak dziś) |
| 5 | czekająca propozycja z `autoProposals` u dostawcy spoza `zdAutomat.suppliers` (strategia klasyczna) | Do wysłania | Sprawdź i wyślij |
| 6 | dostawca ma termin albo jest „na żądanie”, i: analiza ma pracę (`stockSignalHasWork`, także gdy nieaktualna) albo ma termin i czekające prośby (`requestCount > 0`) | Do zamówienia | Przygotuj ZD; z horyzontem dostawy, gdy `stockWatchPrepareZdUsesHorizon` |
| 6a | dostawca jest w `offPlanSuppliers`, bez terminu na dziś i nie „na żądanie” | Zamów wcześniej | Przygotuj ZD, zawsze z horyzontem dostawy (jak dzisiejszy baner) |
| 7 | termin harmonogramu z `vacationNote` (urlop zmienia termin) | Do sprawdzenia ręcznie | Zamówione |
| 8 | termin harmonogramu, analiza świeża i bez pracy | Do przesunięcia | Przesuń |
| 9 | termin harmonogramu, brak analizy albo analiza nieaktualna (`stockWatchSignalStale`, 36 h) bez pracy | Do sprawdzenia ręcznie | Zamówione |

Doprecyzowania:

- **Kilka zamówień automatu u jednego dostawcy** (`zdAutomatTodayOrders` zwraca `{ orders, done }` i może dać dwa na dostawcę): wiersz bierze to o najniższym `STAGE_RANK` (czekające przed wysłanym).
- **Wysłane dziś wygrywa z analizą** (reguła 1 jest pierwsza): nocna analiza nie wie o zamówieniu złożonym po niej, więc „Przygotuj ZD” przy dostawcy z wysłanym dziś zamówieniem automatu prowadziłoby do podwójnego zamówienia. „Przygotuj ZD” jest wtedy w rozwinięciu.
- **Odrzucone dziś** nie jest „zrobione” i nie daje źródła „Automat”: wiersz idzie regułami 6–9 (w tym 6a), a odrzucenie widać w rozwinięciu. Bez innej pracy dostawca nie ma wiersza.
- **Nieaktualna analiza z pracą** zostaje w „Do zamówienia” ze stanem „analiza z 19.10” (Kreator liczy listę na żywo, jak dziś); do „Do sprawdzenia ręcznie” trafia tylko nieaktualna analiza bez pracy — nigdy do „Do przesunięcia”.
- **Brak analizy u dostawcy poza planem:** wiersz powstaje z samego `offPlanSuppliers` (stan „N skończy się”, liczba z `count`).

Kto wchodzi na listę: dostawca z terminem zaległym lub na dziś; z zamówieniem/propozycją automatu na dziś (poza samym odrzuceniem); z `offPlanSuppliers`; „na żądanie” gdy `stockSignalHasWork`. Dostawca mający wyłącznie prośby handlowców nie wchodzi (zostaje w sekcji próśb).

Źródła wiersza (może być kilka, kolejność = pierwszeństwo etykiety): Automat → Harmonogram → Poza planem → Na żądanie. Dostawca z `offPlanSuppliers` oznaczony `onDemand: true` ma źródło „Na żądanie”, nie „Poza planem”. Wiersz pokazuje jedną odznakę (pierwsze źródło); pozostałe są w rozwinięciu. Filtr łapie wiersz, gdy źródło jest na jego liście.

Rola bez Kreatora ZD (`canPrepareZd = false`): reguły 2–5 nie działają (brak danych automatu), a w regule 6 akcją jest „Pokaż w Braki” (`brakiSupplierHref`).

Kolejność w grupie: zaległe przed dzisiejszymi, potem liczba pilnych malejąco, potem nazwa (`localeCompare("pl")`). Zaznaczenie pola wyboru nie przestawia wiersza. W „Zamów wcześniej” kolejność to liczba zagrożonych towarów (`offPlanCount`) malejąco, potem najbliższy termin planu, potem nazwa. Podgląd grupy: „Do wysłania” i „Do zamówienia” — powyżej 20 wierszy pokazują 15 (jak dzisiejsze `URGENT_GROUP_PREVIEW`); „Zamów wcześniej” — powyżej 8 pokazuje 6 (tyle, ile dzisiejszy baner); „Do przesunięcia” i „Do sprawdzenia ręcznie” — powyżej 8 pokazują 5; reszta pod „Pokaż wszystkie (N)”. Przy liczbach z 10.11 nad prośbami handlowców stoi więc ok. 18 wierszy, nie 66.

### Stany ekranu

- Ładowanie: bez zmian (`PanelDailyRouteLoadingSkeleton`).
- Pusto: dzisiejszy `EmptyState` „Nic pilnego na dziś” tylko gdy lista ma 0 wierszy (także poza planem i na żądanie) i nie ma próśb, weryfikacji ani rezygnacji. `hasTodayWork` i `showEmpty` liczą się z wierszy listy, nie z samego harmonogramu.
- Filtr bez wyników: nie występuje (chip z zerem nie istnieje; po zniknięciu ostatniego wiersza filtr wraca do „Wszyscy”).
- Analiza nieaktualna: stan „analiza z 19.10”; grupa wg doprecyzowań reguł (z pracą „Do zamówienia”, bez pracy „Do sprawdzenia ręcznie”).
- Błąd wczytania zamówienia automatu: komunikat w wierszu, jak dziś („Nie udało się wczytać zamówienia - odśwież stronę.”).

### Poza zakresem

- Zakładki „Tydzień” i „Wyjątki”, arkusz „Na żądanie” (zostaje dla dostawców bez braków), `SupplierDrawer`.
- Licznik w menu (`countDailyPanelNavBadge`) i licznik zakładki „Dziś” — bez zmiany znaczenia w tym planie (liczą pozycje kolejki, nie wiersze listy).
- Przeniesienie kart próśb do rozwinięcia wiersza dostawcy — patrz „Decyzje podjęte przez autora planu”, pkt 1.
- Nowe testy e2e (Playwright nie ma dziś żadnego testu panelu dziennego); sprawdzenie w przeglądarce jest w Zadaniu 7.

### Decyzje podjęte przez autora planu (do sprawdzenia przy czytaniu)

1. Prośby handlowców w wierszu to licznik z przejściem do bloku dostawcy w sekcji próśb, nie pełne karty próśb w rozwinięciu. Powód: sekcja próśb pracuje torami i flagami (`ForSomeoneRequests.tsx`, 2200 linii); wciśnięcie jej w wiersz to osobny projekt.
2. Klik w nazwę otwiera kartę dostawcy (jak dziś), a szczegóły rozwija chevron. W makiecie rozwijała nazwa.
3. „Zamówione” jest szybką akcją tylko w grupie „Do sprawdzenia ręcznie” (decyzja użytkownika 10.11.2026: dostawcy zamawiani telefonicznie lub przez stronę); w pozostałych grupach zostaje w rozwinięciu i jako akcja zbiorcza. Pojedyncze „Zamówione” działa jak dziś: od razu, z cofnięciem w toaście; przy pilnych pozycjach Do ZD najpierw potwierdzenie.
4. Tabela „Dostawcy (N)” automatu znika z panelu dziennego; zostaje link do pulpitu automatu.
5. Grupa „Zrobione dziś” pokazuje zamówienia automatu wysłane dziś, zwinięta; wysłane dziś wygrywa z nocną analizą, która nadal mówi „zamów”.
6. Dostawca z urlopem zmieniającym termin (`vacationNote`) trafia do „Do sprawdzenia ręcznie”, nigdy do „Do przesunięcia” — dzisiejsza podpowiedź („ostatnie zamówienie przed urlopem”) mówi coś przeciwnego niż „Przesuń”.
7. Nieaktualna analiza, która nadal pokazuje pozycje do zamówienia, zostaje w „Do zamówienia” z datą analizy (jak dziś); bez pozycji idzie do „Do sprawdzenia ręcznie”.
8. Dostawca z terminem i czekającymi prośbami handlowców trafia do „Do zamówienia”, nie do „Do przesunięcia”.
9. Pasmo stanu nie dostaje osobnego zdania z rozbiciem na grupy — liczby grup są w krokach kolejki i nagłówkach grup.
10. Dostawcy poza planem mają własną grupę „Zamów wcześniej” zamiast wejść do „Do zamówienia” (po pomiarze 10.11: 54 z ok. 66 wierszy). W makiecie byli w „Do zamówienia”. Potwierdzone przez użytkownika 10.11.2026.

Punkty 5–9 doszły po recenzji planu z kodem (osobny agent, 10.11.2026), punkt 10 po pomiarze na produkcji.

### Decyzje do potwierdzenia przez użytkownika

1. Prośby handlowców i „Brak na stanie” lądują pod całą listą dostawców (dziś są między „Zaległe” a „Na dziś”). Plan ogranicza to skróconym podglądem dwóch dolnych grup. Czy tak może być, czy prośby mają stać nad grupami „Do przesunięcia” i „Do sprawdzenia ręcznie”?
2. ZD zrobione dziś ręcznie w Kreatorze u dostawcy „poza planem” albo „na żądanie”: nocna analiza nadal mówi „zamów”, więc wiersz zostaje w „Do zamówienia” do następnej nocy (tak samo dziś zostaje baner). Zadanie 0 sprawdza, czy OnTime ma znacznik „ZD utworzone dziś”, którym dałoby się przenieść taki wiersz do „Zrobione dziś”; jeśli nie ma, zostaje jak dziś.

## Pliki

| Plik | Zmiana | Odpowiada za |
|---|---|---|
| `src/lib/orders/daily-supplier-rows.ts` | nowy | typy wiersza, reguły grup, sklejenie źródeł, liczniki |
| `src/lib/orders/daily-supplier-rows.test.ts` | nowy | scenariusze reguł |
| `src/components/summary/DailySupplierList.tsx` | nowy | nagłówek, chipy źródła, grupy, zbiorcze „Zamówione” |
| `src/components/summary/DailySupplierRow.tsx` | nowy | wiersz, akcja, rozwinięcie |
| `src/components/summary/DailySupplierList.test.tsx` | nowy | inwentarz treści wiersza i filtr |
| `src/components/summary/useZdAutomatOrderSheet.tsx` | nowy (wydzielony z `DailyZdAutomatOrders.tsx`) | otwarcie panelu „Sprawdź i wyślij” dla zamówienia |
| `src/components/summary/DailyZdAutomatOrders.tsx` | zmiana, w Zadaniu 6 usunięcie listy | — |
| `src/components/summary/DailyZdAutomatSection.tsx` | zmiana | zostaje linia stanu problemu + link |
| `src/components/summary/DailyTodayView.tsx` | zmiana | lista zamiast dwóch `UrgentOrdersSection` |
| `src/components/summary/SummaryWorkspace.tsx` | zmiana | budowa wierszy, usunięcie banera poza planem, liczniki pasma stanu |
| `src/components/summary/DailyPanelStatusBand.tsx`, `DailyPanelQueueSteps.tsx` | zmiana | zdanie stanu i kroki wg grup |
| `src/lib/orders/daily-panel-section-anchors.ts` | zmiana | kotwice grup `kolejka-dostawcy-send|order|early|shift|manual`; klucze `overdue`/`today`/`automat` znikają |
| `src/hooks/useDailySupplierSourceFilter.ts` | nowy | `?zrodlo=` w adresie przez `window.history.replaceState` (wzór: `useDailyPanelView.ts:23-29`; `router.replace` przeładowałby ciężką stronę z serwera) |
| `src/components/summary/UrgentOrdersSection.tsx`, `src/components/stock-watch/StockWatchOffPlanBanner.tsx` (+ ich testy, test `useDailyZdProposalsOutside`) | usunięcie w Zadaniu 6, jeśli `git grep` nie znajdzie innych użyć | — |
| `src/components/summary/urgent-card-styles.ts` | zostaje | używają go `ScheduleSupplierActionBar.tsx`, `WeekPlanner.tsx`, `daily-panel-queue-ui.test.ts` |
| `src/components/summary/ForSomeoneRequests.tsx` | mała zmiana | przyjęcie początkowej frazy wyszukiwania (dostawca z licznika „N prośby”) |
| `docs/integrations/strategia-zakupowa-pl-automatyzacja.md` (ok. linii 602) | zmiana | opis sekcji panelu dziennego |
| `src/components/summary/PanelDailyHelp.tsx`, `HowItWorks.tsx`, `src/lib/changelog/changelog-entries.ts` | zmiana | pomoc i wpis „Co nowego” |

## Na co patrzeć w przeglądzie

1. **Dostawca w dwóch źródłach naraz** (automat + zaległy termin + pilne braki): ma jeden wiersz, grupę wg pierwszej pasującej reguły, a liczba w nagłówku = liczba wierszy. Test w Zadaniu 1.
2. **„Zamówione” na dostawcy z pilnymi brakami**: ostrzeżenie w potwierdzeniu zbiorczym (dziś w `UrgentOrdersSection`) nie może zniknąć przy przenosinach. Test w Zadaniu 4.
3. **Analiza nieaktualna po nieudanej nocy**: żaden dostawca nie trafia do „Do przesunięcia” na podstawie starej analizy. Test w Zadaniu 1.
4. **Rola bez Kreatora ZD**: brak grupy „Do wysłania”, akcja „Pokaż w Braki”, żadnego linku do Kreatora. Test w Zadaniu 1 i 2.
5. **Długa grupa po urlopie** (100+ zaległych): lista nie spycha próśb handlowców o kilka ekranów — podgląd 15 i „Pokaż wszystkie”. Test w Zadaniu 2.

---

### Zadanie 0: Liczby z produkcji (tylko odczyt)

Część ekranowa zrobiona 10.11.2026 (sekcja „Pomiar na produkcji”). Zostają dwa sprawdzenia na danych, przed Zadaniem 1:

- [x] **Krok 0a:** ilu dostawców z `offPlanSuppliers` jest jednocześnie w `zdAutomat.suppliers` z zamówieniem na dziś albo ma `onDemand: true` (lokalnie: `tsx` skrypt wołający `listStockWatchOffPlanSuppliers` i `loadZdAutomatDaily` po odświeżeniu lokalnego indeksu; wynik = ile wierszy „Zamów wcześniej” zniknie po sklejeniu).
- [x] **Krok 0b:** czy istnieje znacznik „ZD utworzone dziś u dostawcy” (kandydaci: `subiekt_zd_index`, przesunięcie terminu po zatwierdzeniu w Kreatorze — `DailyZdProposals.tsx:160`). Jest → dopisz do modelu regułę „ZD dziś → Zrobione dziś” z testem; nie ma → zostaje jak dziś, wpisz to do „Poza zakresem”.

Kroki 1–3 poniżej opisują pomiar ekranowy i zostają jako instrukcja powtórzenia w inny dzień tygodnia (wtorek mógł być nietypowy).

- [ ] **Krok 1:** na `/podsumowanie` (Dziś) policz z tekstu strony: dostawców w „Automat ZD”, „Zaległe”, „Na dziś”, w banerze „Zamów dziś poza planem”, „Na żądanie” z brakami; ilu występuje w więcej niż jednym miejscu.
- [ ] **Krok 2:** dla „Zaległe” i „Na dziś” policz, ilu ma: pracę w analizie, „Stan wystarcza”, brak analizy, analizę nieaktualną. To są przyszłe rozmiary grup.
- [ ] **Krok 3:** wpisz liczby i datę do sekcji „Stan dziś” tego pliku; jeśli największa grupa ma ponad 40 wierszy albo jedna grupa to ponad 60% listy, zatrzymaj się i wróć do użytkownika z propozycją (ranking w grupie albo agregacja), zanim powstanie UI.

Nie klikaj „Podgląd panelu” ani żadnej akcji zapisującej.

### Zadanie 1: Model wierszy

**Pliki:** nowy `src/lib/orders/daily-supplier-rows.ts`, test `src/lib/orders/daily-supplier-rows.test.ts`.

**Interfejsy:**
- Korzysta z: `SummaryStandardItem` (`summary.ts`), `SummaryForSomeoneEnriched`, `OnDemandSupplierRow` (`summary-workspace.ts`), `ZdAutomatTodayOrder` (`zd-automat-daily.ts`), `StockWatchSupplierSignal`, `stockWatchSignalStale`, `stockWatchPrepareZdUsesHorizon` (`stock-watch/signal.ts`), `StockWatchOffPlanSupplier` (`stock-watch/data.ts`). `stockSignalHasWork` przenieś z `SupplierStockSignal.tsx` do `stock-watch/signal.ts` (plik komponentu re-eksportuje), żeby model nie importował pliku „use client”. Typ `DailyZdProposal` importuj jako `import type` (z `DailyZdProposals.tsx` albo wprost `ZdAutoProposal & { supplierName: string }`). Które pola propozycji niosą ostrzeżenia, odczytaj z `DailyZdProposalNotice` (`DailyZdProposals.tsx:76-135`) i wydziel do funkcji `zdProposalHasWarning(p)` używanej przez notkę i model.
- Daje:

```ts
export type DailySupplierSource = "automat" | "harmonogram" | "poza-planem" | "na-zadanie";
export type DailySupplierGroup = "send" | "order" | "early" | "shift" | "manual" | "done";
export type DailySupplierAction =
  | { kind: "automat"; label: "Sprawdź i wyślij" | "Sprawdź" | "Wyślij mail" }
  | { kind: "prepareZd"; horizon: boolean }
  | { kind: "braki" }
  | { kind: "shift" }
  | { kind: "ordered" };

export type DailySupplierRow = {
  supplierId: string;
  supplierName: string;
  group: DailySupplierGroup;
  sources: DailySupplierSource[]; // kolejność: automat, harmonogram, poza-planem, na-zadanie
  action: DailySupplierAction | null; // null w grupie "done" i dla etapu "send" bez dokId
  schedule: SummaryStandardItem | null;
  overdueDays: number; // 0 = dziś albo brak terminu
  automatOrder: ZdAutomatTodayOrder | null;
  pendingProposal: DailyZdProposal | null; // reguła 5 — panel otwiera się wprost z propozycji
  automatWarning: boolean; // propozycja z ostrzeżeniem (oflagowane pozycje, wysoka wartość, „na prośbę”)
  vacationNote: string | null; // z item.vacationNote
  onVacationNow: boolean;
  signal: StockWatchSupplierSignal | null;
  signalStale: boolean;
  offPlanCount: number;
  requestCount: number; // pozycje próśb + sygnałów braku u tego dostawcy
};

export type DailySupplierRowsInput = {
  todayDateKey: string;
  nowIso: string;
  scheduled: readonly SummaryStandardItem[];
  automatOrders: readonly ZdAutomatTodayOrder[]; // zdAutomatTodayOrders(...).orders
  pendingProposals: readonly DailyZdProposal[];
  automatSupplierIds: ReadonlySet<string>; // zdAutomat.suppliers — reguła 5 dotyczy dostawców spoza tego zbioru
  vacationNowIds: ReadonlySet<string>; // klucze suppliersOnVacationNow
  signals: Readonly<Record<string, StockWatchSupplierSignal>>;
  offPlan: readonly StockWatchOffPlanSupplier[];
  onDemand: readonly OnDemandSupplierRow[];
  requestGroups: readonly Pick<SummaryForSomeoneEnriched, "supplierId" | "lines">[];
  canPrepareZd: boolean;
};

export const DAILY_SUPPLIER_GROUP_ORDER: readonly DailySupplierGroup[];
export const DAILY_SUPPLIER_GROUP_LABEL: Record<DailySupplierGroup, string>;
export const DAILY_SUPPLIER_SOURCE_LABEL: Record<DailySupplierSource, string>;
export function buildDailySupplierRows(input: DailySupplierRowsInput): DailySupplierRow[];
export function countDailySupplierGroups(rows: readonly DailySupplierRow[]): Record<DailySupplierGroup, number>;
export function countDailySupplierSources(rows: readonly DailySupplierRow[]): Record<DailySupplierSource, number>;
export function parseDailySupplierSource(raw: string | null): DailySupplierSource | null;
```

- [x] **Krok 1: testy (mają nie przejść).** Pomocnik `input(overrides)` z pustymi tablicami i `canPrepareZd: true`; fabryki `sched(id, name, dateKey, vacationNote?)` (buduje `nextDate: Date` z klucza; `overdueDays` liczy się z `formatDateString(nextDate)`), `signal({ lineCount, criticalCount, beforeDeliveryCount, computedAt })`, `order(id, name, stage)`. Przypadki i asercje:

```ts
it("dostawca w automacie, z zaległym terminem i pilnymi brakami ma jeden wiersz w Do wysłania", () => {
  const rows = buildDailySupplierRows(input({
    scheduled: [sched("a", "Alfa Dental", "2026-11-07")],
    automatOrders: [order("a", "Alfa Dental", "review")],
    signals: { a: signal({ lineCount: 42, criticalCount: 5 }) },
  }));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ group: "send", sources: ["automat", "harmonogram"], overdueDays: 3,
    action: { kind: "automat", label: "Sprawdź i wyślij" } });
});
it.each([["unconfirmed", "Sprawdź"], ["send", "Wyślij mail"]])("etap %s daje akcję %s", ...);
it("zamówienie wysłane dziś trafia do Zrobione dziś także przy pilnych brakach w analizie", ...); // group "done", action null
it("dwa zamówienia u dostawcy (wysłane i czekające): wiersz bierze czekające", ...); // group "send"
it("etap send bez dokId: Do wysłania bez akcji", ...); // action null
it("odrzucone dziś + zaległy termin: grupa wg analizy, bez źródła automat", ...);
it("odrzucone dziś bez innej pracy: brak wiersza", ...);
it("czekająca propozycja u dostawcy spoza automatSupplierIds: Do wysłania, Sprawdź i wyślij, pendingProposal ustawione", ...);
it("termin dziś i praca w analizie: Do zamówienia, Przygotuj ZD", ...); // action { kind: "prepareZd", horizon: false }
it("tylko pozycje zagrożone przed dostawą: Przygotuj ZD z horyzontem", ...); // horizon: true
it("poza planem bez terminu i bez analizy: źródło poza-planem, grupa early, Przygotuj ZD z horizon true", ...);
it("poza planem z terminem na dziś i pracą w analizie: grupa order, nie early", ...);
it("early: kolejność wg offPlanCount malejąco (48, 22, 18), potem termin planu, potem nazwa", ...);
it("poza planem z onDemand: true ma źródło na-zadanie i grupę order", ...);
it("nieaktualna analiza z pracą: Do zamówienia, signalStale true", ...);
it("termin z vacationNote i świeżą analizą bez pracy: Do sprawdzenia ręcznie, Zamówione", ...);
it("termin, świeża analiza bez pracy, 2 prośby: Do zamówienia", ...);
it("na żądanie wchodzi tylko z pracą w analizie", ...); // bez pracy: rows.length === 0
it("termin dziś, świeża analiza bez pracy: Do przesunięcia, Przesuń", ...);
it("termin dziś, analiza starsza niż próg: Do sprawdzenia ręcznie, nie Do przesunięcia", ...);
it("termin dziś, brak analizy: Do sprawdzenia ręcznie, Zamówione", ...); // action { kind: "ordered" }
it("bez Kreatora ZD: brak grupy send, akcja braki zamiast prepareZd", ...); // canPrepareZd: false
it("sam licznik próśb nie tworzy wiersza, ale jest na wierszu z terminem", ...); // requestCount === 3
it("kolejność: grupy wg DAILY_SUPPLIER_GROUP_ORDER, w grupie zaległe, potem pilne malejąco, potem nazwa", ...);
it("liczniki grup sumują się do liczby wierszy; liczniki źródeł liczą wiersz w każdym jego źródle i pomijają grupę done", ...);
it("parseDailySupplierSource przyjmuje cztery wartości, resztę i null zamienia na null", ...);
```

- [x] **Krok 2:** `npx vitest run src/lib/orders/daily-supplier-rows.test.ts` → FAIL (brak modułu).
- [x] **Krok 3:** zaimplementuj według tabeli „Reguły grup”. `overdueDays` z różnicy kluczy dat (`daysBetweenKeys` z `zd-automat-daily.ts`). `STAGE_RANK` wyeksportuj z `zd-automat-daily.ts`. Jedna mapa `supplierId → wiersz`, źródła dopisywane w stałej kolejności.
- [x] **Krok 4:** ten sam test → PASS; potem pełne bramki z „Ograniczeń globalnych”.

Zadanie 1 zrobione 10.11.2026 (28 testów modelu; bramki zielone).

### Zadanie 2: Lista dostawców za przełącznikiem `?lista=1` (odczyt + nazwa otwiera kartę)

Do Zadania 5 nowa lista jest widoczna tylko z parametrem `?lista=1` (rysowana nad starymi sekcjami, które zostają bez zmian). Dzięki temu żaden plaster nie zabiera użytkownikom „Zamówione”, „Przesuń” ani notki propozycji, zanim lista ma swoje akcje. Parametr znika w Zadaniu 5.

**Pliki:** nowe `DailySupplierList.tsx`, `DailySupplierRow.tsx`, `DailySupplierList.test.tsx`; zmiana `DailyTodayView.tsx`, `SummaryWorkspace.tsx`, `daily-panel-section-anchors.ts`.

**Interfejsy:**
- Korzysta z: `DailySupplierRow`, `DAILY_SUPPLIER_*` (Zadanie 1).
- Daje:

```ts
export function DailySupplierList(props: {
  rows: readonly DailySupplierRow[];
  supplierMeta: Record<string, SupplierSummaryMeta>;
  suppliersOnVacationNow: Record<string, SupplierOnVacationWindow>;
  onOpenSupplier: (id: string) => void;
}): JSX.Element | null; // null przy 0 wierszy
```

Kotwice grup: `dailySupplierGroupAnchor(group: DailySupplierGroup): string` → `kolejka-dostawcy-<group>` w `daily-panel-section-anchors.ts`.

- [x] **Krok 1: test renderu (ma nie przejść).** Fikstura z 4 grupami (po 1 wierszu) i grupą 22 wierszy:
  - nagłówek `sectionTitleClass` „Dostawcy na dziś”, licznik w Meta; każda grupa ma nagłówek o nazwie z `DAILY_SUPPLIER_GROUP_LABEL` i liczbie wierszy;
  - wiersz pokazuje nazwę jako `button` (klik woła `onOpenSupplier(id)`; dostawca spoza `supplierMeta` ma nazwę jako tekst), odznakę pierwszego źródła, „zaległy 3 dni” przy `overdueDays: 3` i „termin 10.11” przy terminie na dziś, odznakę urlopu przy `vacationNote` / `onVacationNow`, stan („5 pilnych · 42 poz.” / „Stan wystarcza” / „Brak analizy” / „analiza z 19.10”);
  - grupa „Do zamówienia” z 22 wierszami pokazuje 15 i przycisk „Pokaż wszystkie (22) - jeszcze 7”; po kliknięciu 22; grupa „Zamów wcześniej” z 54 wierszami pokazuje 6 i „Pokaż wszystkie (54) - jeszcze 48”; grupa „Do przesunięcia” z 9 wierszami pokazuje 5;
  - `rows: []` → nic nie renderuje.
- [x] **Krok 2:** uruchom test → FAIL.
- [x] **Krok 3:** zbuduj listę: jedna `Card padding={false}`, nagłówek przez `DailyPanelSubsectionBar` albo `CardHeader`, wiersze `ul.divide-y`, siatka wiersza `grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto]`. Stan: funkcja `dailySupplierStatus(row)` w `DailySupplierRow.tsx` korzystająca z `stockSignalUrgentLabel`, `formatPln`, `stockSignalComputedDay`. Odznaka źródła: `Badge variant="default"` z ikoną ze `StrokeIcons` (dopisz brakujące w tym samym stylu). Bez akcji w tym zadaniu.
- [x] **Krok 4:** w `SummaryWorkspace.tsx` policz `rows` przez `useMemo(buildDailySupplierRows(...))` (prośby: `[...workspace.forSomeoneLeft, ...workspace.stockOutLeft]`, automat: `zdAutomatTodayOrders(...)` gdy `canPrepareZd`), przekaż do `DailyTodayView`; tam, gdy adres ma `lista=1`, narysuj `DailySupplierList` pod rezygnacjami, nad starymi sekcjami. Stare sekcje, baner poza planem i sekcja automatu zostają bez zmian do Zadania 5.
- [x] **Krok 5:** test → PASS; bramki; w przeglądarce (lokalny dev, `127.0.0.1`, `?lista=1`) lista widoczna, klik w nazwę otwiera kartę także dla dostawcy poza planem i z automatu, konsola bez błędów; bez parametru ekran jak przed zmianą.

Zadanie 2 zrobione 10.11.2026 (13 testów renderu; bramki zielone; lokalny dev: lista pod `?lista=1`, karta dostawcy otwiera się z nazwy, 375 px bez przewijania w poziomie; bez parametru ekran bez zmian). Odstępstwa: termin na dziś pokazany jako „termin dziś”, nie „termin 10.11” (daty bliskie względnie); urlop jest odznaką w linii meta, stan wiersza go nie powtarza.

### Zadanie 3: Szybka akcja w wierszu

**Pliki:** nowy `useZdAutomatOrderSheet.tsx` (wydzielenie `start`, stanu `open`/`loadingId`/`error` i renderu `ZdAutoProposalSheet` z `DailyZdAutomatOrders.tsx`; ten plik zaczyna używać hooka — zachowanie bez zmian); zmiana `DailySupplierRow.tsx`, `DailySupplierList.tsx`, test listy.

**Interfejsy:**
- Daje: `useZdAutomatOrderSheet(): { start(order: ZdAutomatTodayOrder): Promise<void>; startProposal(proposal: DailyZdProposal): void; loadingId: string | null; error: { id: string; message: string } | null; sheet: ReactNode }` (`startProposal` otwiera ten sam panel wprost z czekającej propozycji — reguła 5).
- `DailySupplierList` dostaje dodatkowo `run: DailyPanelRunFn`, `isScopePending: (id: string) => boolean`, `canPrepareZd: boolean`.

- [x] **Krok 1: testy (mają nie przejść).** Dla każdej akcji z modelu: widoczny dokładnie jeden przycisk/link o etykiecie z „Ograniczeń globalnych”; „Przygotuj ZD” ma `href` z `buildZdEstimateLaunchHref(id)` i z `{ leadTimeHorizon: true }` przy `horizon: true`; „Pokaż w Braki” ma `href` z `brakiSupplierHref(id)`; „Zamówione” woła `run(() => actionBulkOrdered([id]), ...)` z tymi samymi tekstami co dzisiejsze pojedyncze „Zamówione”, a przy `criticalCount > 0` najpierw otwiera `ConfirmDialog`; „Przesuń” otwiera `ShiftMenu`; wiersz grupy „done” i etap `send` bez `dokId` nie mają przycisku akcji; dwa szybkie kliknięcia „Sprawdź i wyślij” wołają `start` raz (przycisk zablokowany, gdy `loadingId` = jego propozycja).
- [x] **Krok 2:** FAIL.
- [x] **Krok 3:** zaimplementuj. „Przesuń” używa `ShiftMenu` z tymi samymi wywołaniami `run(...)`, co `ScheduleSupplierActionBar` (wydziel z niego funkcje `shiftWeeks` / `shiftDate` do wspólnego hooka w tym samym pliku, bez zmiany zachowania paska). Przycisk akcji: `Button variant="outline" size="sm"`, przy 375 px `w-full min-h-11`. `ShiftMenu` rysuje własny przycisk (`ShiftMenu.tsx:244`) — użyj go bez zmiany wyglądu (`compact`).
- [x] **Krok 4:** PASS; bramki; `npm test` obejmuje `DailyZdAutomatOrders.test.tsx` (ma dalej przechodzić bez zmian w teście).
- [x] **Krok 5:** przeglądarka: każda z akcji raz (automat: otwórz panel i zamknij bez zatwierdzania; Przesuń: przesuń i cofnij z toastu; Zamówione: kliknij i cofnij z toastu; Przygotuj ZD: sprawdź adres, wróć).

### Zadanie 4: Rozwinięcie wiersza i zbiorcze „Zamówione”

**Pliki:** `DailySupplierRow.tsx`, `DailySupplierList.tsx`, test listy, `DailyTodayView.tsx` (przekazanie `selected`, `onToggle`, `onSelectAllInScope`, `onBulkOrdered`, `selectedCount`, `isBulkPending`, `onVacation`, `onEdit`).

- [x] **Krok 1: inwentarz przed kodem.** Wypisz w opisie PR wszystko, co dziś pokazuje `UrgentCard` i wiersz `DailyZdAutomatOrders` (pole wyboru, nazwa, data terminu, lokalizacja, kontakt, odznaka urlopu, linie analizy, „Przygotuj ZD”, „do kolejnej dostawy”, notka propozycji z „Odrzuć”, opis statusu, pasek Zamówione/Przesuń/menu, 3 kroki etapu, „czeka od… wygasa…”) i oznacz każde: w wierszu / w rozwinięciu / usunięte z powodem.
- [x] **Krok 2: testy (mają nie przejść).** Chevron ma `aria-expanded`; po kliknięciu widać: `SupplierStockSignal`, kontakt, „Zamówione”, „Przesuń”, „Urlop”, „Edytuj”; dla wiersza z automatem: 3 kroki etapu i „Odrzuć”. Pole wyboru jest tylko przy wierszach z `schedule != null`. „Wszystkie” zaznacza tylko widoczne wiersze z terminem; zmiana filtra źródła czyści zaznaczenie. Rozwinięcie wiersza z urlopem pokazuje zdanie z `formatUrgentVacationHint`; wiersza poza planem — „plan 21.11 · za 9 dni”; wiersza z ostrzeżeniem automatu — treść ostrzeżeń bez drugiego przycisku „Sprawdź i wyślij”. Zaznaczenie 2 wierszy → przycisk „Zamówione (2)” w nagłówku; klik otwiera `ConfirmDialog`; gdy jeden z zaznaczonych ma `criticalCount > 0`, treść zawiera „pilne pozycje Do ZD w analizie Braki”. Zaznaczenie nie zmienia kolejności wierszy.
- [x] **Krok 3:** FAIL → implementacja (rozwinięcie: blok `bg-slate-50 rounded-lg`, klasa wejścia `.zd-automat-detail-enter`; logikę potwierdzenia zbiorczego przenieś z `UrgentOrdersSection` bez zmiany tekstów) → PASS; bramki.
- [x] **Krok 4:** przeglądarka: zaznacz dwa, „Zamówione (2)”, potwierdź, cofnij z toastu w 10 s; licznik nagłówka wraca.

### Zadanie 5: Filtr źródła, zdanie stanu, poza planem i na żądanie na liście

**Pliki:** `DailySupplierList.tsx`, `SummaryWorkspace.tsx`, `DailyPanelStatusBand.tsx`, `DailyPanelQueueSteps.tsx`, nowy `src/hooks/useDailySupplierSourceFilter.ts`, testy listy i `DailyPanelQueueSteps.test.ts`.

**Interfejsy:** `useDailySupplierSourceFilter(): { source: DailySupplierSource | null; setSource(next: DailySupplierSource | null): void }` — czyta `?zrodlo=` z `useSearchParams`, pisze przez `window.history.replaceState`, zachowując pozostałe parametry (`view`). `DailyPanelQueueSteps` dostaje `groupCounts: Record<DailySupplierGroup, number>` zamiast `automatCount` / liczników zaległych i dzisiejszych; `DailyPanelQueueStepKind` = `"send" | "order" | "early" | "shift" | "manual" | "stockOut" | "prosby"`.

- [x] **Krok 1: testy (mają nie przejść).** Chipy: „Wszyscy N” + po jednym na źródło z licznikiem > 0, `aria-pressed`; klik „Automat” zostawia tylko wiersze z tym źródłem, grupy bez wierszy znikają, licznik „pokazano N”; chip z zerem nie istnieje. `DailyPanelQueueSteps` (nowy `DailyPanelQueueSteps.test.tsx`; dzisiejszy `.test.ts` pinuje stare kotwice — przepisz go): kroki „Do wysłania (2)”, „Do zamówienia (3)”, „Zamów wcześniej (4)”, „Do przesunięcia (2)”, „Ręcznie (1)”, „Brak na stanie”, „Prośby handlowców”; liczby = `countDailySupplierGroups`; `href` kroku = kotwica grupy; krok z zerem nie istnieje. Klik kroku przy aktywnym filtrze źródła zdejmuje filtr. „N w kolejce” i nagłówek na telefonie („Kolejka dnia: N”) liczą wiersze listy bez „Zrobione dziś” + grupy próśb + sygnały braku + rezygnacje.
- [x] **Krok 2:** FAIL → implementacja. Usuń przełącznik `?lista=1`: lista jest zawsze, a z `DailyTodayView` znikają oba `UrgentOrdersSection` i lista zamówień w sekcji automatu. W `SummaryWorkspace.tsx` usuń `StockWatchOffPlanBanner` (jego dostawcy są na liście jako „Poza planem”), a `queueStepBySection`, `hasTodayWork` i w `DailyTodayView` `showEmpty` / `useDailyZdProposalsOutside` zastąp wartościami z `rows`. Licznik „2 prośby” w wierszu przewija do sekcji próśb i przekazuje nazwę dostawcy jako początkową frazę wyszukiwania `ForSomeoneRequests` (blok dostawcy może być zwinięty — po przejściu ma być rozwinięty). Postęp dnia (`useDailyDayProgress`) dostaje te same dwie liczby co dziś — nie zmieniaj jego znaczenia.
- [x] **Krok 3:** PASS; bramki.
- [x] **Krok 4:** przeglądarka: porównaj liczbę w zdaniu stanu, sumę liczników grup i liczbę wierszy; kliknij każdy chip i każdy krok kolejki (krok przewija do grupy, także przy włączonym filtrze); kliknij „N prośby” i porównaj liczbę z pozycjami dostawcy w sekcji próśb; odśwież stronę z `?zrodlo=automat` — filtr zostaje.

### Zadanie 6: Sprzątanie sekcji automatu, pomocy i martwego kodu

**Pliki:** `DailyZdAutomatSection.tsx`, `DailyZdAutomatOrders.tsx`, `UrgentOrdersSection.tsx`, `StockWatchOffPlanBanner.tsx`, `urgent-card-styles.ts`, `UrgentScheduleDateMeta.tsx`, `PanelDailyHelp.tsx`, `HowItWorks.tsx`, `changelog-entries.ts`, testy tych plików, `docs/plans/daily-panel-tabs.md` (dopisek o nowym układzie „Dziś”).

- [x] **Krok 1:** `DailyZdAutomatSection` zostawia tylko linię problemu (nocny przebieg, „automat stoi u N”) z linkiem „Pulpit automatu”; bez problemu nie renderuje nic. Usuń listę zamówień i tabelę „Dostawcy (N)”. Test: przy `night.kind === "missing"` widać zdanie i link; bez problemów `container` pusty.
- [x] **Krok 2:** dla każdego pliku z listy uruchom `git grep -n "<nazwa eksportu>" -- src`; usuń plik lub eksport tylko przy zerze użyć. Każde trafienie wypisz w raporcie: usunięte / zostaje (kto używa).
- [x] **Krok 3:** pomoc panelu i sekcji: opisz cztery grupy i źródła słowami z „Ograniczeń globalnych”; wpis w `changelog-entries.ts` („Panel dzienny: jeden wiersz na dostawcę…”).
- [x] **Krok 4:** bramki; `git grep -n "kolejka-zalegle\|kolejka-harmonogram-dzis\|kolejka-automat-zd\|automat-zd-" -- src docs` — zero trafień poza tym planem (w tym `reveal()` / „Pokaż powód” w sekcji automatu, które celowały w usuniętą tabelę). Treść `SectionHelp` z `UrgentOrdersSection` (znaczenie zaległych, „Zamówione”, „Przesuń”) trafia do `PanelDailyHelp`. Zaktualizuj `docs/integrations/strategia-zakupowa-pl-automatyzacja.md`.

Zadania 3–6 zrobione 10.11.2026 (bramki zielone, lokalny dev). Odstępstwa od zapisu zadań:

- „N prośby” i „N sygnał braku” w wierszu to osobne linki do swoich sekcji; `ForSomeoneRequests` nie ma wyszukiwania, do którego dałoby się wpisać dostawcę, więc sama sekcja zostaje bez zmian.
- Pojedyncze „Zamówione” działa od razu (z cofnięciem w toaście), a przy pilnych pozycjach Do ZD najpierw pyta o potwierdzenie — tak samo jak zbiorcze „Zamówione (N)”.
- W rozwinięciu wiersza akcje terminu są drugorzędne (bez pełnego Petrolu) i nie powtarzają akcji wiersza; notka propozycji automatu nie powtarza liczb z wiersza.
- „w kolejce” i licznik zakładki „Dziś” liczą to samo: wiersze listy bez „Zrobione dziś” + grupy próśb + sygnały braku + rezygnacje. Licznik w menu bocznym (`countDailyPanelNavBadge`) został po staremu.
- `DailyZdAutomatOrders.tsx` zostaje jako moduł z opisem i paskiem etapu (`zdAutomatStageText`, `ZdAutomatStageBar`); lista zamówień i jej test zniknęły.
- `scripts/audit-design-tokens.ts` czyta teraz stan z dysku (nowe pliki przed `git add`, bez usuniętych przed `git rm`).
- Telefon: stan i akcja wiersza stoją w jednej linii (wiersz 117–160 px zamiast 143–186 px).

### Zadanie 7: Sprawdzenie w przeglądarce i przegląd końcowy

- [x] **Krok 1:** lokalny dev (`127.0.0.1`, konto testowe z `.env.test-admin.local`) i — jeśli użytkownik jest zalogowany — produkcja tylko do odczytu. Szerokości: biurko i 375 px; oba motywy.
- [x] **Krok 2:** pomiary: przy 375 px `scrollWidth` kontenera `main` = `clientWidth`; żaden element z `truncate`/`overflow-hidden` w wierszu nie ma `scrollWidth > clientWidth`; wiersz na biurku ma jedną linię nazwy i jedną linię meta dla najdłuższej prawdziwej nazwy dostawcy; kontrast odznak i stanu w ciemnym motywie (dopisz nowe pary do `scripts/audit-theme-contrast.test.ts`, jeśli powstały).
- [ ] **Krok 3:** przejście pierwszego użytkownika (4 pytania z globalnych zasad interfejsu): co widzę, co znaczy każda odznaka i liczba, co się stanie po kliknięciu, co dalej w stanie pustym / błędu / nieaktualnej analizy. Każde pytanie bez odpowiedzi na ekranie = poprawka.
- [x] **Krok 4:** lista „Wykonane interakcje” w raporcie: każda akcja z Zadań 3–5, każdy licznik prowadzący gdzieś (źródło vs cel), każde rozwinięcie.
- [x] **Krok 5:** przegląd końcowy w osobnym agencie (`impeccable-finish-reviewer`, wariant dla ekranu Operate budowanego z kodu: dowody, zgodność z makietą wg inwentarza elementów, craft floor, log interakcji; zrzuty do katalogu roboczego sesji, nie do repo) oraz przegląd diffu gałęzi względem `main` — tylko problemy blokujące merge, z plikiem, linią i sposobem pokazania błędu.
- [ ] **Krok 6:** raport z nagłówkami: Blocked on me, Changed, Found.

Stan Zadania 7 (10.11.2026):

- Kroki 1, 2, 4: lokalny dev (`127.0.0.1`), biurko i 375 px — bez przewijania w poziomie, nic uciętego, wiersz 67–68 px (biurko) i 117–160 px (telefon); konsola czysta w świeżej karcie. Ciemny motyw sprawdzony tylko częściowo (pomiar kontrastu nie czyta kolorów `lab()`), nowych par kolorów lista nie wprowadza.
- Model na danych produkcji z 10.11 (zanonimizowany wyciąg ze strony, uruchomiony lokalnie): 62 wiersze bez duplikatów — 5 „Do wysłania”, 6 „Do zamówienia”, 50 „Zamów wcześniej” (górne: 48, 22, 18, 14, 12, 9), 1 „Do przesunięcia”.
- Krok 5: przegląd diffu w osobnym agencie — 6 uwag blokujących, wszystkie poprawione z testami: potwierdzenie przy pojedynczym „Zamówione” z pilnymi pozycjami; link „Wszystkie braki” pod listą; osobne liczniki próśb i sygnałów braku z linkami do właściwych sekcji; krok kolejki przy filtrze ukrywającym grupę; zwinięcie grupy zdejmuje zaznaczenie ukrytych wierszy; „w kolejce” i licznik zakładki liczą wszystkie wiersze poza „Zrobione dziś” (jak w projekcie). Dodatkowo wiersz z zamówieniem automatu nie ma pola wyboru do zbiorczego „Zamówione”.
- Niezrobione: sprawdzenie na produkcji (nowy kod nie jest wdrożony), przegląd `impeccable-finish-reviewer`, commit.

Dopracowanie i audyt kodu (10.11.2026, po pierwszym przeglądzie):

- **ZD z dziś:** nowe zapytanie `listSuppliersWithZdLinkedToday` (po zakresie Kreatora — grupa / cecha — nie po kontrahencie, bo jeden kontrahent Subiekta bywa kilkoma dostawcami OnTime; na danych dev: 1 dostawca zamiast 4). Dostawca bez terminu z ZD z dziś przechodzi do „Zrobione dziś”; dostawca z terminem zostaje w „Do zamówienia” ze stanem „ZD z dziś” i akcją „Zamówione” (zamknięcie terminu), bez pytania o pilne pozycje. To zmienia punkt „Poza zakresem” o znaczniku ZD.
- **Kolejka dnia:** „w kolejce”, licznik zakładki „Dziś” i kroki kolejki obejmują grupy Do wysłania / Do zamówienia / Do przesunięcia / Ręcznie + prośby. „Zamów wcześniej” nie jest krokiem ani częścią licznika — stoi w linii „Poza kolejką” obok „Na żądanie” (link do grupy). Decyzja autora: 50 dostawców poza planem w liczniku dnia odebrałoby mu znaczenie.
- **Nagłówek listy:** liczba dostawców nie powtarza się obok chipa „Wszyscy N”; zbiorcze „Zamówione (N)” pojawia się dopiero z zaznaczeniem i obejmuje wyłącznie zaznaczone wiersze widoczne z polem wyboru; „Zaznacz wszystkie” zamiast „Wszystkie”.
- **Wiersz:** stan „3 towary się skończą” zamiast „3 skończą się”; nazwa dostawcy ma cichą kreskę (otwiera kartę); potwierdzenie „Zamówione” montuje się tylko, gdy jest otwarte.
- **Audyt kodu** (10 znalezisk, wszystkie poprawione): dopasowanie ZD po zakresie; termin z ZD z dziś; zbiorcze „Zamówione” tylko dla widocznych; przewinięcie do grupy efektem zamiast licznika czasu; klik w drugie zamówienie automatu podczas wczytywania pierwszego; jedna definicja kotwic grup; wcięcia; stała referencja pustej listy; grupowanie bez kopiowania tablic.
- **DESIGN.md:** nowa sekcja „Lista pracy na dziś” opisująca wzorzec.
- Kontrast w obu motywach zmierzony na wyrenderowanej liście (z rozwiniętym wierszem): brak tekstu poniżej 4.5:1.
- Nie zmienione: licznik w menu bocznym (`countDailyPanelNavBadge`) — liczy się w odpytywaniu co 25 s dla wszystkich ról operacyjnych bez danych automatu i analizy Braki; wyrównanie wymaga dołożenia tam 3–4 zapytań i decyzji, czy to się opłaca.

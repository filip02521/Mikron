---
name: OnTime
description: Prośby handlowców, harmonogram zakupów i realizacja dostaw — OnTime · Mikran
colors:
  petrol: "#0f7380"
  petrol-deep: "#0d5d67"
  petrol-pressed: "#0f4b53"
  petrol-ink: "#113e45"
  petrol-tint: "#d4edef"
  petrol-mist: "#edf7f8"
  graphite: "#151920"
  graphite-soft: "#363c46"
  ink-secondary: "#4a515c"
  ink-muted: "#626a76"
  ink-faint: "#737b87"
  line-strong: "#c9ced6"
  line: "#e1e4e9"
  line-soft: "#eef0f3"
  well: "#f6f7f9"
  canvas: "#f3f5f7"
  card: "#ffffff"
  success-surface: "#ecfdf5"
  success-ink: "#065f46"
  attention: "#f59e0b"
  attention-surface: "#fffbeb"
  attention-ink: "#78350f"
  danger: "#dc2626"
  danger-surface: "#fef2f2"
  danger-ink: "#b91c1c"
typography:
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  body-dense:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
  column-header:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  nav-group:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
  code:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  control: "0.375rem"
  surface: "0.5rem"
  panel: "0.625rem"
  pill: "9999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "7": "1.75rem"
components:
  button-primary:
    backgroundColor: "{colors.petrol}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.petrol-deep}"
  button-primary-active:
    backgroundColor: "{colors.petrol-pressed}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.graphite-soft}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-secondary-hover:
    backgroundColor: "{colors.well}"
    textColor: "{colors.graphite}"
  button-ghost:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.graphite}"
    typography: "{typography.body-dense}"
    rounded: "{rounded.control}"
    padding: "0.625rem 0.875rem"
    height: "2.5rem"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.panel}"
    padding: "1.5rem"
  badge-neutral:
    backgroundColor: "{colors.line-soft}"
    textColor: "{colors.graphite-soft}"
    rounded: "{rounded.control}"
    padding: "0.125rem 0.375rem"
  badge-warning:
    backgroundColor: "{colors.attention-surface}"
    textColor: "{colors.attention-ink}"
    rounded: "{rounded.control}"
    padding: "0.125rem 0.375rem"
  nav-item-active:
    backgroundColor: "{colors.petrol-mist}"
    textColor: "{colors.petrol-ink}"
    rounded: "{rounded.control}"
  segmented-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    padding: "0.375rem 0.75rem"
  table-header:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.column-header}"
    padding: "0.875rem 1.25rem"
---

# Design System: OnTime

Ten plik jest normatywny: tokeny we frontmatterze są źródłem prawdy, a tekst mówi, gdzie i po co ich używać. Kod realizuje je w dwóch miejscach: `src/app/globals.css` (zmienne CSS i przemapowane palety Tailwinda) oraz `src/lib/ui/ontime-theme.ts` (gotowe klasy). Gdy kod i ten plik się rozjadą, popraw jedno albo drugie w tym samym PR. Kolory podawaj zawsze jako klasę Tailwinda lub zmienną CSS, nigdy jako surowy hex w komponencie.

## Overview

OnTime to narzędzie do codziennej pracy na danych z Subiekta: listy dostawców, setki pozycji ZD, kolejki próśb. Interfejs ma zejść z drogi. Neutralna, chłodna szarość niesie strukturę, jeden kolor marki (Petrol) pokazuje, gdzie działasz, a trzy kolory stanów mówią, co wymaga reakcji. Nic poza tym nie jest kolorowe.

Wzorcem jest pulpit dyspozytora: wszystko pod ręką, gęsto, ale czytelnie. Gęstość nie jest problemem do rozwiązania. Zakupy pracują przy biurku na długich listach, magazyn na telefonie w hali, handlowcy w biegu. Ekran zaczyna od zadania i jego stanu („421 cen do zapisu”), nie od statystyk.

Aplikacja ma tylko jasny motyw. Ciemne tło z gradientem marki występuje wyłącznie na ekranach logowania. Tarcza marki (`BrandCardAccent`) pojawia się tylko w momentach marki: logowanie, strona 404, onboarding i puste stany pierwszego uruchomienia. Na ekranach pracy jej nie ma.

## Colors

Szarości są chłodne (lekko w stronę niebieskiego), Petrol jest jedynym nasyconym kolorem, a zieleń, bursztyn i czerwień oznaczają wyłącznie stany.

W kodzie palety Tailwinda są przemapowane w `globals.css`: `slate-*` to szarości OnTime, `indigo-*` to Petrol. Rodziny `blue`, `cyan`, `teal`, `violet`, `purple`, `fuchsia`, `pink` też dają Petrol, `sky` daje szarość, `rose` czerwień, `orange` i `yellow` bursztyn, `green` i `lime` zieleń. Nowy kod pisz jednak wprost klasami `slate-*`, `indigo-*`, `emerald-*`, `amber-*`, `red-*`, żeby intencja była czytelna.

### Primary

| Token | Klasa | Do czego |
|---|---|---|
| `petrol` | `indigo-600`, `var(--primary)` | Główny przycisk, link, zaznaczony checkbox, pasek postępu, pierścień fokusu. |
| `petrol-deep` | `indigo-700` | Hover głównego przycisku, tekst zaznaczenia. |
| `petrol-pressed` | `indigo-800` | Wciśnięty główny przycisk. |
| `petrol-ink` | `indigo-900` | Tekst aktywnej pozycji menu. |
| `petrol-tint` | `indigo-100` | Obramowanie lub tło wybranego elementu, gdy `petrol-mist` jest za słaby. |
| `petrol-mist` | `indigo-50`, `var(--primary-muted)` | Tło aktywnej pozycji menu, zaznaczenia tekstu, komunikatu informacyjnego. |

### Neutral

| Token | Klasa | Do czego |
|---|---|---|
| `graphite` | `slate-900`, `var(--foreground)` | Tekst główny, tytuły, wartości. |
| `graphite-soft` | `slate-700` | Tekst przycisku drugorzędnego, pozycje menu w spoczynku. |
| `ink-secondary` | `slate-600`, `var(--muted-foreground)` | Tekst komórek tabeli, opisy pod tytułem, etykiety pól. |
| `ink-muted` | `slate-500`, `var(--muted)` | Nagłówki kolumn, podpisy, metadane. Najjaśniejszy tekst dopuszczalny dla treści. |
| `ink-faint` | `slate-400` | Placeholdery, wartość zerowa („—”), ikony pomocnicze. Ma 4.3:1 na bieli, więc nie używaj go do zdań do przeczytania. |
| `line-strong` | `slate-300` | Obramowanie pola i przycisku w hover, suwak przewijania. |
| `line` | `slate-200`, `var(--card-border)` | Obramowanie karty, pola, przycisku. |
| `line-soft` | `slate-100` | Linie między wierszami tabeli, tło neutralnej odznaki, hover pozycji menu. |
| `well` | `slate-50` | Nagłówek tabeli, hover wiersza, tor przełącznika segmentowego, wyłączone pole. |
| `canvas` | `var(--background)` | Tło aplikacji pod kartami. |
| `card` | `white`, `var(--card)` | Karty, menu boczne, pola. |

### Stany

| Stan | Tło | Sygnał | Tekst | Kiedy |
|---|---|---|---|---|
| Gotowe | `emerald-50` | `emerald-600` | `emerald-800` | Zapisane, zrealizowane, zgodne z Subiektem. |
| Uwaga | `amber-50` | `amber-500` | `amber-900` | Zaległe, do przejrzenia, tryb podglądu (pasek 3 px u góry ekranu). |
| Błąd | `red-50` | `red-600` | `red-700` | Błąd zapisu, rozbieżność, akcja nieodwracalna na produkcji. |

Na kolorowym tle tekst pomocniczy bierz z tej samej rodziny (np. `amber-800` na `amber-50`), nie szary.

### Named Rules

**Jeden akcent.** Petrol jest jedynym kolorem marki. Nie dodawaj drugiego akcentu ani gradientu dla wyróżnienia sekcji, roli czy modułu.

**Stan to nie dekoracja.** Zieleń, bursztyn i czerwień zawsze coś znaczą. Jeśli element nie jest w żadnym stanie, jest szary albo Petrol.

## Typography

**Krój:** Geist w całym interfejsie, Geist Mono dla numerów katalogowych, symboli i kodów. Oba ładuje `next/font`, dostępne jako `font-sans` i `font-mono`.

Hierarchię budują rozmiar i waga, nie zmiana kroju ani koloru. Waga 600 to tytuły i etykiety, 500 to przyciski, nagłówki kolumn i odznaki, 400 cała reszta. Wyższe wagi nie występują.

### Hierarchy

- **Headline** (600, 1.5rem na telefonie, 1.75rem od `sm`, tracking −0.025em): tytuł strony w `PageHeader`. Jeden na ekran.
- **Title** (600, 1.125rem, od `lg` 1.25rem): tytuł karty w `CardHeader`. Wariant `compact` 1rem, wariant `micro` (chrome Kreatora ZD) 13px.
- **Body** (400, 0.9375rem, 1.55): tekst aplikacji, opisy, komunikaty. Opis pod tytułem strony ma szerokość max 48rem.
- **Body Dense** (400, 0.875rem, 1.45, cyfry tabelaryczne): komórki tabel, pola od `sm`, podpowiedzi.
- **Label** (600, 0.75rem): etykieta pola formularza, kolor `slate-600`.
- **Column Header** (500, 0.8125rem, `slate-500`): nagłówek kolumny tabeli. Pisany zdaniowo, bez wersalików.
- **Nav Group** (600, 11px, tracking 0.08em, wersaliki, `slate-500`): nagłówek grupy w menu bocznym. Jedyne miejsce na wersaliki z rozstrzeleniem.
- **Code** (Geist Mono, 0.75rem): symbol towaru, numer dokumentu.

Rozmiar bazowy zależy od ustawienia użytkownika: `html[data-font-scale]` podnosi go z 16px do 17.6px albo 20px. Dlatego rozmiary i odstępy podawaj w `rem` (klasy Tailwinda), a stałe piksele tylko w chrome Kreatora ZD.

### Named Rules

**Cyfry w kolumnie.** Kwoty, ilości, procenty i daty w tabelach i licznikach mają cyfry o stałej szerokości. `.data-table` włącza je sama; poza tabelą dodaj `tabular-nums`.

**Wersaliki tylko w menu.** Nagłówki kolumn, etykiety pól i odznaki pisz normalnie. Wersaliki z rozstrzeleniem są tylko w nagłówkach grup menu bocznego.

## Layout

Szkielet: menu boczne 16rem (zwinięte do paska ikon 4.25rem, `html[data-sidebar="collapsed"]`) i kolumna treści na `canvas`. Na telefonie menu zastępuje dolny pasek z czterema pozycjami i „Więcej”.

Szerokość kolumny zależy od rodzaju pracy, a ustawia ją shell strony z `ontime-theme.ts`:

- `panelWorkspaceShellClass`, `salesWorkspaceShellClass`: panel dzienny i prośby, 48rem, szerzej dopiero na `xl`/`2xl`.
- `adminPageShellClass`: administracja, zakupy, historia, 56rem, do 72rem na `2xl`.
- `zdEstimatePageShellClass`: Kreator ZD, cała szerokość (max 100rem), bez przewijania `main`.

Margines strony to 0.75rem na telefonie, 1rem od `sm`, 1.25rem od `lg`. Bloki strony układają się w stos co 1rem (`space-y-4`). Odstępy biorą się ze skali co 4px (`spacing` we frontmatterze); wewnątrz grupy 0.5–0.75rem, między grupami 1–1.5rem, nad nagłówkiem sekcji więcej niż pod nim.

Strona nigdy nie przewija się w poziomie, także przy 375px. Tabela ma min. 640px i przewija się wewnątrz swojej karty. Przełącznik segmentowy z wieloma opcjami przewija swój tor. Najważniejsza kolumna (stan, akcja wiersza) ma być widoczna bez przewijania przy typowej szerokości biurka.

## Elevation & Depth

Głębia jest warstwowa i cicha. Na szarym `canvas` leżą białe karty z obramowaniem `line` i miękkim cieniem. Elementy nad treścią (modal, menu rozwijane, sticky pasek wyszukiwania) mają mocniejszy cień. Sticky chrome ma półprzezroczyste tło karty z `backdrop-blur-sm`, żeby przewijana treść była widoczna pod spodem.

### Shadow Vocabulary

- **Karta** (`var(--shadow-card-elevated)`: `0 1px 2px rgba(21,25,32,.05), 0 6px 20px -8px rgba(21,25,32,.12)`): karta treści, modal.
- **Kontrolka** (`var(--shadow-card)` albo `shadow-sm`: `0 1px 2px rgba(21,25,32,.06)`): przycisk drugorzędny, pole, aktywny segment.
- **Uniesienie** (`var(--shadow-elevated)`: `0 4px 14px -4px rgba(21,25,32,.1)`): elementy pływające: lista podpowiedzi (`TypeaheadDropdown`), dymek pomocy, popover.
- **Marka** (`var(--shadow-brand)`: `0 4px 14px -6px rgba(15,115,128,.25)`): tylko kafel ikony marki.

### Named Rules

**Cichy cień.** Każdy cień ma przesunięcie w dół i miękkie rozmycie, a krycie do 0.12 (wyjątek: kafel marki). Bez kolorowych poświat, bez twardych cieni bez rozmycia, bez cieni na elementach wewnątrz karty.

## Shapes

Formy są prostokątne, lekko zaokrąglone, a promień rośnie z wielkością elementu:

- 6px (`rounded-md`, `--radius`): przyciski, pola, odznaki, segmenty, alerty.
- 8px (`rounded-lg`, `--radius-lg`): bloki zagnieżdżone w karcie, okna loadingu, chrome Kreatora.
- 10px (`rounded-[var(--radius-panel)]`): karty paneli (`Card`, `surfaceCardClass`).
- Pełne zaokrąglenie: tylko liczniki w menu i paski postępu.

Element wewnątrz karty nigdy nie ma większego promienia niż karta. Obramowania są jednopikselowe w tonach `line`. Kolorowego paska z boku karty, wiersza ani alertu nie stosujemy: stan pokazuje tło, odznaka albo ikona.

## Components

Komponenty bazowe są w `src/components/ui/`. Zanim napiszesz własny przycisk, pole czy tabelę, użyj ich.

### Buttons

- **Kształt:** 6px. Rozmiary `sm` (12px tekstu), `md` (14px, domyślny), `lg` (16px). Na telefonie przyciski w `PageHeader` mają min. 44px wysokości.
- **Primary:** pełny Petrol, biały tekst, cień kontrolki. Hover `indigo-700`, wciśnięcie `indigo-800` i lekkie zmniejszenie (`scale 0.97`, 75 ms; wyłączone przy `prefers-reduced-motion`). Etykieta to czasownik, najlepiej z liczbą („Zapisz 421 cen”). Jeden na ekran.
- **Secondary:** biała karta, obramowanie `line`, tekst `slate-700`; hover tło `slate-50` i obramowanie `slate-300`.
- **Outline:** tło `petrol-mist`, obramowanie `indigo-200`, tekst `indigo-800`. Dla akcji drugiego rzędu, która ma zostać zauważona obok głównej.
- **Ghost:** bez tła, tekst `slate-600`; hover tło `slate-100`. W paskach narzędzi i wierszach tabel.
- **Danger:** pełny `red-600`. Tylko akcje nieodwracalne i zapis na produkcji (LIVE), zawsze z potwierdzeniem (`ConfirmDialog`).
- **Fokus:** pierścień 2px `indigo-600` z odstępem. **Wyłączony:** krycie 50%, kursor zakazu; powód blokady pokaż tekstem obok, nie tylko w `title`.

### Chips

- **Odznaka (`Badge`):** płaskie tło bez obramowania, 12px, waga 500, cyfry tabelaryczne. Warianty: `default` (szary), `success`, `warning`, `danger`, `info` (Petrol). Odznaka nie jest klikalna.
- **Filtrowanie** robi przełącznik segmentowy albo chip filtra, nie klikalna odznaka.
- **Wybrany chip filtra lub zakładka:** tło `indigo-50`, tekst `indigo-900`, obramowanie (albo wewnętrzny ring) `indigo-200`; licznik w środku na białym tle w `indigo-700`. W spoczynku: białe lub `slate-100` tło i `slate-600`. Wybrany stan nigdy nie jest grafitowy (`slate-900`).

### Cards / Containers

- **Promień:** 10px. **Tło:** `card` na `canvas`. **Obramowanie:** 1px `line`. **Cień:** Karta.
- **Padding:** 1.5rem, od `sm` 1.75rem. Karta z tabelą ma `padding={false}`, a tabela dochodzi do krawędzi.
- **Nagłówek (`CardHeader`):** tytuł, opcjonalny opis i akcja po prawej; od treści oddziela go linia `line-soft`.
- Karta w karcie jest zakazana. Wewnątrz karty grupuj odstępem, linią albo blokiem `well` bez cienia.

### Inputs / Fields

- **Styl:** białe tło, obramowanie `line`, promień 6px, cień kontrolki. Wysokość min. 44px i tekst 16px na telefonie (bez auto-zoomu iOS), od `sm` 40px i 14px.
- **Hover:** obramowanie `slate-300`. **Fokus:** obramowanie `indigo-500` i pierścień `indigo-500/20`.
- **Stany:** `warning`, `error`, `success` barwią obramowanie i lekko tło, a komunikat pod polem przyjmuje ten sam ton. Komunikat błędu mówi, co jest nie tak i jak to naprawić.
- **Wyłączone:** tło `slate-50`, tekst `slate-400`.

### Navigation

- **Menu boczne:** białe na szarym `canvas`, nagłówek i stopka na pasie `slate-50`. Grupy z nagłówkiem Nav Group. Pozycja w spoczynku `slate-700`, hover tło `slate-100`, wciśnięcie `slate-200`.
- **Aktywna pozycja:** tło `petrol-mist`, tekst `petrol-ink`, bez paska z boku.
- **Liczniki:** pigułki w dwóch poziomach. Wymaga działania: pełny Petrol z białą cyfrą. Informacyjny: `slate-100` z `slate-700`.
- **Telefon:** dolny pasek z czterema pozycjami i „Więcej”, aktywna zakładka jak w menu bocznym.

### Data Table

Najważniejszy komponent produktu (`DataTable`, klasa `.data-table`).

- **Nagłówek:** tło `well`, Column Header (13px, 500, `slate-500`, zdaniowo), linia `line` pod spodem, bez zawijania.
- **Komórki:** padding 1rem 1.25rem (1.5rem przy krawędziach karty), Body Dense w `slate-600`, linie `line-soft` między wierszami.
- **Hover wiersza:** tło `well`. Bez paska z boku.
- **Wersje zwarte:** kolejka realizacji (`.queue-table`, 13px, nagłówek sticky) i Kreator ZD (`.zd-estimate-table`) mają mniejsze paddingi, te same zasady.
- **Zmiana wartości:** stara wartość przekreślona w `slate-500`, nowa w `slate-900` waga 600, obok procent zmiany w `slate-500`; zmiana powyżej 5% w `amber-700` waga 600.

### Segmented Control

Przełącznik widoku lub filtra (`SegmentedControl`). Tor `slate-50` z obramowaniem, aktywny segment na białym tle z cieniem kontrolki. Licznik w etykiecie jest przygaszony (`slate-500`). Etykiet nie ucinamy: przy wielu opcjach tor przewija się w poziomie.

### Status Panel

Karta stanu na górze ekranu pracy: zdanie stanu z liczbą („433 pozycje czekają na Twoją decyzję”, z poprawną odmianą liczebnika), jedno zdanie wyjaśnienia i jedna główna akcja po prawej. Na telefonie akcja schodzi pod tekst. Pas uwagi na całą szerokość (`PageAttentionStrip`) służy do pojedynczej sprawy wymagającej reakcji, w tonie `amber`.

### Ruch

Ruch tylko potwierdza działanie: zmiana tła i obramowania w 150 ms, rozwinięcie panelu w 200–300 ms, krzywa `cubic-bezier(0.22, 1, 0.36, 1)` (szybki start, miękkie wyhamowanie). Elementy są widoczne od razu, bez animacji wejścia przy ładowaniu strony. Każdy ruch ma wariant `motion-reduce`.

### Ładowanie

Systemowe ładowanie OnTime to animowane logo, `BrandLoader` (`src/components/ui/BrandLoader.tsx`): przygaszona tarcza, łuk obiega ją w kółko, ptaszek stoi; przy „ogranicz ruch” spokojnie pulsuje. Znak pojawia się dopiero po 250 ms, więc krótkie ładowanie nie mignie i można go dawać wszędzie, gdzie coś się wczytuje.

- **Obszar, panel, okno albo strona czeka na dane lub na długą operację** (przeliczenie, zapis do Subiekta, wysyłka): `BrandLoader` (`size="lg"` na środku pustego obszaru, `md` w karcie, `sm` w wierszu stanu obok tekstu) z jednym zdaniem, co się dzieje, i ile to zwykle trwa. Nad treścią, która zostaje widoczna: `ActionLoadingOverlay` (ma logo w środku).
- **Operacja z kilkoma krokami** (przeliczenie → zapis w Subiekcie → wysyłka): pionowa oś kroków w miejscu treści, na którą się czeka. Krok w toku ma w węźle `BrandLoader size="md"`, zakończony zielony ptaszek i zieloną szynę do następnego, błąd czerwony węzeł z „Spróbuj ponownie”, kroki przed nami numer i cichy opis. Wzór: `ActionTimeline` w `ZdAutoProposalSheet.tsx`.
- **Przycisk w toku**: `Spinner` w przycisku zostaje (mała ikona przy etykiecie „Tworzę…”). Gdy operacja trwa dłużej niż kilka sekund, obszar, którego dotyczy, dostaje dodatkowo wiersz stanu z `BrandLoader size="sm"`.
- **Bez szkieletów i pulsujących pasków** zamiast logo na ekranach pracy. Wyjątek: wiersze tabeli, które dociągają się pod już widoczną listą.
- Logo przy tekście jest dekoracją (`aria-hidden`); kontener ma `role="status"` i widoczny opis. Sam znak bez tekstu dostaje `label`.
- Nowe miejsca z ładowaniem od razu używają `BrandLoader`; stare `Spinner` poza przyciskami i szkielety wymieniamy przy każdej zmianie tego ekranu.

### Powierzchnie przeglądarki

Zaznaczenie tekstu ma tło `petrol-mist` i tekst `petrol-deep`. Kursor tekstowy i natywne checkboxy, radia i suwaki są w Petrolu (`accent-color`, `caret-color`). Paski przewijania są cienkie, `slate-300`. Fokus z klawiatury ma zawsze ten sam kolor, `indigo-600` (także na elementach w tonie stanu): komponenty rysują go jako `focus-visible:ring-2 focus-visible:ring-indigo-600`, a element bez własnego stylu dostaje obrys 2px z odstępem 2px z `@layer base`. Pierścieni przezroczystych (`/40`) nie stosujemy, bo nie mają kontrastu 3:1. Linki mają podkreślenie odsunięte od tekstu.

## Do's and Don'ts

### Do:

- **Do** buduj ekrany z komponentów `src/components/ui/` i klas z `ontime-theme.ts`. Kolor podawaj klasą lub zmienną, nie hexem.
- **Do** dawaj jedną pełną główną akcję na ekran, z czasownikiem i liczbą w etykiecie.
- **Do** zaczynaj ekran pracy od zdania stanu z liczbą, nie od statystyk.
- **Do** sprawdzaj każdy ekran przy 375px: brak przewijania strony w poziomie, etykiety całe, pola min. 44px.
- **Do** pokazuj stan tłem, odznaką lub ikoną z tekstem, zawsze w kolorze jego znaczenia.
- **Do** dawaj każdemu ruchowi wariant `motion-reduce`.
- **Do** pokazuj każde dłuższe ładowanie animowanym logo (`BrandLoader`) ze zdaniem, co się dzieje.

### Don't:

- **Don't** dodawaj drugiego koloru akcentu, gradientów ani zieleni, bursztynu i czerwieni jako dekoracji.
- **Don't** stawiaj kolorowego paska z boku karty, wiersza, alertu ani pozycji menu.
- **Don't** buduj ekranu z rzędu kafelków z liczbami, jeśli te liczby są już w zakładkach albo tabeli.
- **Don't** wkładaj karty do karty.
- **Don't** pisz nagłówków kolumn, etykiet ani odznak wersalikami.
- **Don't** ucinaj etykiet przełączników ani przycisków wielokropkiem.
- **Don't** używaj `slate-400` do tekstu, który trzeba przeczytać.
- **Don't** zaznaczaj wybranego stanu grafitem ani kolorem stanu; wybrane jest zawsze w Petrolu.
- **Don't** przenoś ciemnego gradientu logowania do aplikacji.
- **Don't** stawiaj szkieletu, pulsującego paska ani samego `Spinner` tam, gdzie czeka cały obszar lub panel.

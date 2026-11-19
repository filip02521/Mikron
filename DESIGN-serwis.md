---
name: OnTime · Serwis
description: Panel serwisu sprzętu (/serwis) — karta serwisowa z pieczątkami, świat w obrębie systemu OnTime
colors:
  # Motyw jasny (.serwis-world, src/app/globals.css). Klasy zostają te same, zakres podmienia ich wartości.
  indigo-50: "#f3f0fa"
  indigo-100: "#e6e0f5"
  indigo-200: "#cdc2ea"
  indigo-300: "#ab9bd9"
  indigo-400: "#8a74c7"
  indigo-500: "#6f55b5"
  indigo-600: "#5b3e9e"
  indigo-700: "#4b3286"
  indigo-800: "#3d296d"
  indigo-900: "#2f2056"
  indigo-950: "#1c1336"
  primary: "#5b3e9e"
  primary-hover: "#4b3286"
  primary-pressed: "#3d296d"
  primary-muted: "#f3f0fa"
  focus-ring: "#5b3e9e"
  background: "#e9efeb"
  sv-rail: "#2b2147"
  sv-rail-ink: "#f4f1fb"
  sv-rail-muted: "#c9bfe8"
  sv-rail-line: "#42356a"
  sv-rail-hover: "#3a2d5f"
  sv-rail-active: "#f4f1fb"
  sv-rail-active-ink: "#2b2147"
  sv-rail-active-hover: "#ffffff"
  sv-rule: "#c5d1c9"
  sv-box: "#f4f8f5"
  sv-stamp: "#5b3e9e"
  # Motyw ciemny (html[data-theme="dark"] .serwis-world, tylko na ekranie).
  indigo-50-dark: "#1e1932"
  indigo-100-dark: "#272042"
  indigo-200-dark: "#362c5c"
  indigo-300-dark: "#4a3c7e"
  indigo-400-dark: "#8571cc"
  indigo-500-dark: "#9a86df"
  indigo-600-dark: "#7357c9"
  indigo-700-dark: "#bcaef0"
  indigo-800-dark: "#cfc4f5"
  indigo-900-dark: "#e0d8f9"
  indigo-950-dark: "#f0ebfd"
  primary-dark: "#7357c9"
  primary-hover-dark: "#7c60d1"
  primary-pressed-dark: "#6a4fbf"
  primary-muted-dark: "#221c38"
  focus-ring-dark: "#9a86df"
  background-dark: "#0d1210"
  sv-rail-dark: "#19142b"
  sv-rail-ink-dark: "#ece8f8"
  sv-rail-muted-dark: "#b3a8d6"
  sv-rail-line-dark: "#2c2448"
  sv-rail-hover-dark: "#272042"
  sv-rail-active-dark: "#ece8f8"
  sv-rail-active-ink-dark: "#19142b"
  sv-rail-active-hover-dark: "#f7f5fd"
  sv-rule-dark: "#2f3a34"
  sv-box-dark: "#121815"
  sv-stamp-dark: "#9a86df"
typography:
  rubric-label:
    fontFamily: "Inter Tight, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.07em"
  stamp-step:
    fontFamily: "Inter Tight, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.02em"
  stamp-date:
    fontFamily: "Inter Tight, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  stamp-date-card:
    fontFamily: "Inter Tight, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  state-sentence:
    fontFamily: "Inter Tight, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
rounded:
  stamp-box: "0.375rem"
  rubric: "0.5rem"
  stamp: "9999px"
components:
  rubric-box:
    backgroundColor: "#ffffff"
    rounded: "{rounded.rubric}"
  rubric-head:
    typography: "{typography.rubric-label}"
    padding: "0.375rem 0.75rem"
    height: "2.5rem"
  stamp-box-row:
    rounded: "{rounded.stamp-box}"
    size: "3rem"
  stamp-box-card:
    rounded: "{rounded.stamp-box}"
    size: "4rem"
  stamp-box-empty:
    backgroundColor: "{colors.sv-box}"
    rounded: "{rounded.stamp-box}"
  stamp-ink:
    textColor: "{colors.sv-stamp}"
    rounded: "{rounded.stamp}"
  filter-idle:
    rounded: "{rounded.stamp-box}"
    padding: "0 0.75rem"
    height: "2.75rem"
  filter-active:
    backgroundColor: "{colors.indigo-50}"
    textColor: "{colors.indigo-900}"
    rounded: "{rounded.stamp-box}"
    padding: "0 0.75rem"
    height: "2.75rem"
  rail-item:
    textColor: "{colors.sv-rail-ink}"
    rounded: "{rounded.stamp-box}"
    padding: "0 0.75rem"
    height: "2.75rem"
  rail-item-active:
    backgroundColor: "{colors.sv-rail-active}"
    textColor: "{colors.sv-rail-active-ink}"
    rounded: "{rounded.stamp-box}"
  rail-cta:
    backgroundColor: "{colors.sv-rail-active}"
    textColor: "{colors.sv-rail-active-ink}"
    rounded: "{rounded.stamp-box}"
    height: "2.75rem"
  rail-cta-hover:
    backgroundColor: "{colors.sv-rail-active-hover}"
---

# Design System: OnTime · Serwis

Ten plik opisuje świat panelu serwisu i jest normatywny tylko pod `.serwis-world`. Rozszerza `DESIGN.md`, nie zastępuje go: wszystko, czego tu nie ma (skala tekstu, komponenty `src/components/ui/`, przyciski, okna, warstwy, teksty, ładowanie `BrandLoader`, Data Table), działa jak w `DESIGN.md`. Nadpisane są trzy rzeczy: paleta (fiolet zamiast Petrolu, grunt), szkielet (pas Serwisu zamiast menu bocznego) i słownik rubryk i pieczątek. Kod: blok „Świat Serwisu” na końcu `src/app/globals.css`, klasy w `src/lib/ui/serwis-theme.ts`, komponenty w `src/components/serwis/`. Kontrast liczy `scripts/audit-theme-contrast.test.ts` (pary `SERWIS_PAIRS`). Spisane z kodu po wdrożeniu (gałąź `claude/serwis-redesign`, 6.11.2026); gdzie kod i ten plik się rozjadą, rozstrzyga kod, a różnicę dopisujemy do „Znany dług”.

## Overview

Każde zlecenie to karta serwisowa, na której kroki naprawy są przybite pieczątką z datą. Serwisant widzi najpierw, co wymaga ruchu dziś, z rzędu pieczątek rozumie, gdzie jest każda naprawa i od kiedy, i jednym dotknięciem otwiera kartę zlecenia, żeby przybić następną. Świat odrzuca kanban statusów w szarości z jednym akcentem, w którym każdy panel serwisowy wygląda tak samo.

Materiał: grunt bladego, szaro-zielonego papieru (`--background`), na nim białe karty z cienkimi liniami rubryk (`--sv-rule`), ciemnofioletowy pas Serwisu u góry (`--sv-rail`) i fiolet atramentu pieczątki (`--sv-stamp`, `indigo-600`) jako jedyny akcent. Etykiety rubryk drobnym krojem formularza, cyfry tabelaryczne.

**Kiedy świat obowiązuje.**

- **Każda trasa `/serwis` i `/serwis/*`**, dla każdej roli: `AppShellClient` dokłada klasę `serwis-world` do `body` i do kolumny treści, więc administrator widzi paletę Serwisu przy swoim menu bocznym.
- **Szkielet Serwisu** (pas u góry zamiast menu bocznego, `--app-sidebar-w: 0px`) dostaje tylko konto z rolą `serwis` (`serwisLive`). Na telefonie widoki są w dolnym pasku (`MobileOperationsNav`, „Nawigacja serwisu”).
- Poza `/serwis` świat nie istnieje: ten sam komponent na innej trasie wraca do Petrolu sam, bo zmienia się tylko zakres zmiennych.

**Key Characteristics:**

- Komponenty bazowe bez wariantów: klasy `indigo-*`, `bg-primary`, `ring-focus` zostają, `.serwis-world` podmienia ich zmienne.
- Pięć rubryk drogi naprawy (Przyjęto · Diagnoza · Naprawa · Gotowe · Wydano) na końcu każdego wiersza i w nagłówku karty.
- Rubryka (`Section`) zamiast `CardHeader` w panelach bocznych i kartach Serwisu.
- Stan zawsze zielony, bursztynowy albo czerwony, nad fioletem; fiolet nigdy nie jest stanem.
- Ekran dotykowy: `touch-ui` na każdej stronie Serwisu, kontrolki min. 44px.

## Colors

Fiolet atramentu pieczątki zastępuje Petrol w tych samych rolach kroków; grunt jest szaro-zielony zamiast chłodnej szarości, a szarości tekstu (`slate-*`) zostają z `DESIGN.md`.

### Primary

| Token | Klasa | Do czego |
|---|---|---|
| `indigo-600`, `primary` | `bg-primary`, `indigo-600` | Wypełnienie głównej akcji („Oznacz jako gotowe”), zaznaczony checkbox, obrys wybranego filtra. Jak w `DESIGN.md`: krok 600 to wypełnienie, tekst od 700. |
| `primary-hover`, `primary-pressed` | `bg-primary-hover`, `bg-primary-pressed` | Hover i wciśnięcie głównego przycisku. |
| `indigo-50`, `primary-muted` | `indigo-50` | Tło wybranego filtra, wybranego warunku w panelu zamiennika, odznaki informacyjnej (prośba o część w `ServicePartsPanel`). |
| `indigo-900` | `indigo-900` | Tekst wybranego filtra. |
| `focus-ring` | `ring-focus` | Fokus z klawiatury w treści. Na pasie Serwisu fokus to `--sv-rail-active` z odstępem w kolorze `--sv-rail`. |
| `sv-stamp` | `var(--sv-stamp)` | Atrament pieczątki: obrys koła pieczątki, data, inicjały, obrys rubryki bieżącej, etykieta bieżącego kroku. W jasnym równy `indigo-600`, w ciemnym jaśniejszy (`indigo-500` ciemnego), bo jest tekstem. |

### Neutral

| Token | Klasa | Do czego |
|---|---|---|
| `background` | `bg-background` | Grunt papieru pod kartami na każdej trasie Serwisu. |
| `sv-rule` | `var(--sv-rule)` | Linia rubryki: obramowanie rubryki i jej paska nagłówka, linie między wierszami w rubrykach i tabelach Serwisu, ramka pustej rubryki pieczątki (przerywana), ramka filtra w spoczynku, ramka pola „Nr”. |
| `sv-box` | `var(--sv-box)` | Puste pole formularza: tło pustej rubryki pieczątki, nagłówek tabeli Serwisu, hover wiersza i rubryki, tor przełącznika „Oś czasu / Lista”. |
| `card` | `bg-card` | Wnętrze rubryki i rubryki pieczątki z przybitą pieczątką. Bez zmian względem `DESIGN.md`. |

### Pas Serwisu

| Token | Do czego |
|---|---|
| `sv-rail` | Tło pasa u góry. |
| `sv-rail-ink` | Tekst i ikony widoków w spoczynku, nazwa „Serwis”. |
| `sv-rail-muted` | Druga linia marki („OnTime · kto”), ramka kontrolki w hover. |
| `sv-rail-line` | Ramka przycisku konta na pasie. |
| `sv-rail-hover` | Tło widoku i kontrolki w hover. |
| `sv-rail-active` / `sv-rail-active-ink` | Aktywny widok i przycisk „Przyjmij sprzęt”: jasne pole z ciemnym tekstem; ten sam kolor rysuje fokus na pasie. |
| `sv-rail-active-hover` | Hover przycisku „Przyjmij sprzęt”. |

### Stany

Tabela Stany z `DESIGN.md` obowiązuje bez zmian: `emerald` gotowe (do wydania, część na stanie, egzemplarz wolny), `amber` czekanie i uwaga (czeka na część, ponad 14 dni u klienta, licznik „po terminie” na pasie), `red` termin minął, brak dokumentów, zwrot po terminie. Stan siedzi nad fioletem: rubryka „czeka” ma bursztynową ramkę zamiast fioletowej, odznaka „Termin minął” jest czerwona w wierszu, którego pieczątki są fioletowe.

### Named Rules

**Fiolet to atrament, nie stan.** `indigo-*` i `--sv-stamp` oznaczają główną akcję, wybór i przybitą pieczątkę. Nie barwią stanu obiektu (u klienta, w naprawie, w drodze); stan bierze kolor z tabeli Stany albo jest szary (`slate-400` dla „w naprawie”).

**Jeden akcent w świecie.** Petrol nie występuje pod `.serwis-world`, a fiolet nie występuje poza nim. Nowy kolor dla Serwisu to nowa zmienna w obu blokach `globals.css` i para w `SERWIS_PAIRS`.

### Motyw ciemny

Ten sam mechanizm co w `DESIGN.md`: drugi zestaw zmiennych pod `html[data-theme="dark"] .serwis-world`, tylko `@media screen`. Role kroków zostają (50–300 tła, 600 wypełnienie, 700+ tekst). Grunt to prawie czarna zieleń (`background-dark`), pas głęboki fiolet (`sv-rail-dark`), rubryki ciemne (`sv-box-dark`, `sv-rule-dark`), atrament pieczątki jaśnieje (`sv-stamp-dark`). Test kontrastu wymaga, by w ciemnym każda para Serwisu spełniała WCAG AA; w jasnym dopuszcza tylko dług znany z bazowej palety.

## Typography

Kroje i skala z `DESIGN.md`. Serwis dodaje jeden głos: drobny nadruk formularza.

### Hierarchy

- **Rubric Label** (`rubricLabelClass`: Inter Tight 600, `text-[0.6875rem]`, wersaliki, tracking 0.07em, `slate-600`): nazwa rubryki (`Section` w karcie zlecenia i zamiennika, „Do zrobienia” w zamiennikach, „Części do naprawy” i „Gwarancja od daty zakupu” w Katalogu modeli), etykieta „Nr”, nagłówki kolumn tabel Serwisu (Części, lista zamienników), etykiety pól formularzy Serwisu (`fieldLabelClass`, `fieldLabelInlineClass`). To usankcjonowany wyjątek od reguły „Wersaliki tylko w menu” z `DESIGN.md`; klasa ma `design-ok` w `serwis-theme.ts`. Wersaliki spoza tej klasy nadal są zakazane.
- **Stamp Step** (Inter Tight 600, `text-[0.6875rem]` w wierszu, `text-xs` w karcie, tracking 0.02em, zdaniowo): nazwa kroku pod rubryką pieczątki. `slate-600`; bieżący `--sv-stamp`; czekanie `amber-800`.
- **Stamp Date** (Inter Tight 600, cyfry tabelaryczne, `dd.mm`): `text-[0.6875rem]` w wierszu, `text-[0.8125rem]` w karcie. Pod datą w karcie inicjały osoby, która przybiła (`text-[0.625rem]`, tracking 0.07em, pełne imię w `title`).
- **State Sentence** (Inter Tight 700, `text-lg`, tracking −0.01em, `slate-900`, `aria-live="polite"`): zdanie stanu nad filtrami na tablicy zleceń i zamienników. Ma wagę Section z `DESIGN.md`, ale nie jest nagłówkiem (`<p>`).
- **Lane** (Geist 600, `text-[0.9375rem]`, licznik „· N” 400 `slate-500`): nagłówek grupy tablicy (`<h2>`). Wagi Item, zdaniowo.
- **Rail Brand** (Inter Tight 700, `text-lg`): „Serwis” na pasie; pod nim Micro w `--sv-rail-muted`.
- Numer zlecenia (`ZS/26/11/005`) i symbol towaru: Geist Mono, jak Code.

### Named Rules

**Wersaliki tylko w rubryce.** Pod `.serwis-world` drobne wersaliki z rozstrzeleniem ma wyłącznie `rubricLabelClass` i to, co z niej składa się w `serwis-theme.ts`. Nazwy kroków, odznaki, filtry i nagłówki grup pisz zdaniowo.

## Layout

**Szkielet.** Konto serwisanta nie ma menu bocznego. U góry sticky pas Serwisu (`ServiceShellBar`, min. 3.5rem, z bezpieczną strefą u góry): marka „Serwis” z blokiem „OnTime · kto” prowadząca do zleceń, od `md` cztery widoki (Zlecenia, Części, Zamienniki, Modele) z ikonami, po prawej „Przyjmij sprzęt” i menu konta (motyw, ustawienia, wyloguj). Na telefonie widoki przechodzą do dolnego paska, a na pasie zostaje marka, „Przyjmij sprzęt” (sama ikona z etykietą dla czytnika) i konto.

**Kolumna.** Strony Serwisu używają `adminPageShellClass` z `touch-ui` i `space-y-6`, nagłówek `PageHeader` na gruncie (anatomia ekranu z `DESIGN.md`).

**Tablica zleceń** (`ServiceOrdersBoard`), od góry: szukanie z przyciskiem drugorzędnym „Sprzęt klienta” (skrót K; z „Przyjmij sprzęt”, gdy nie ma go na pasie) → zdanie stanu → pasek filtrów (`-mt-3`, przyklejony do zdania) → grupy, odstęp między grupami 1.25rem. Kolejność grup jest stała: Do ruchu teraz, Do wydania, Do przyjęcia z helpdesku, Czeka na klienta, W naprawie, Czeka na część, Bez dokumentów, Zamknięte. „Czeka na klienta” to zlecenia po wycenie (status `czeka_na_akceptacje`); po `SERVICE_QUOTE_NUDGE_DAYS` (3) dniach bez odpowiedzi zlecenie przechodzi do „Do ruchu teraz” z odznaką „Klient milczy N dni po wycenie”. Najpierw to, co serwisant robi dziś, potem sprzęt, który dopiero przyjdzie, potem w toku. Każde zlecenie jest w jednej grupie (`serviceOrderLane`). „Do przyjęcia z helpdesku” pokazuje tylko zgłoszenia bez żadnego zlecenia (OnTime nie wie, ile urządzeń obejmuje zgłoszenie); te z przyjętym sprzętem są w oknie przyjęcia z dopiskiem „Przyjęto już: …”, a pod listą stoi jedna linia z ich liczbą. Pusta grupa się nie rysuje; „Zamknięte” jest zwinięte, dopóki nie ma filtra ani szukania. Wybrany filtr pokazuje tylko swoją grupę, a helpdesk znika.

**Wiersz zlecenia.** Od `md` siatka o stałych kolumnach, wyrównana we wszystkich grupach tablicy (`minmax(0,1fr) · 11rem · pieczątki · strzałka`): kolumna „Zlecenie” (numer Geist Mono, nazwa sprzętu, pod nią klient · SN), kolumna „Stan” z jednym faktem do przeczytania bez zdania — powód „teraz” („Część na stanie — wznów”, „Termin minął dd.mm”, „Klient milczy N dni po wycenie”), w „Bez dokumentów” czerwona pigułka „Brak: faktura, RW”, przy wycenie bursztynowa „Wycena 450 zł”, poza tym „N dni w serwisie” — a pod nim drobno termin, liczba części albo data zamknięcia; potem pasek pieczątek i strzałka. Na telefonie kolumny idą jedna pod drugą.

**Zgłoszenia z helpdesku.** Ta sama zasada: od `sm` kolumny z nagłówkiem w Rubric Label na `--sv-box` — „Sprzęt i klient” (sprzęt 600, klient pod nim), „Zgłoszenie” (numer Geist Mono, dzień zgłoszenia, odznaka „Nowe” tylko dla statusu 1), „Dostarczenie” (ikona paczki „Wysyła klient” albo ciężarówki „Odbiór Mikran”), przycisk „Przyjmij” (nazwa dla czytnika „Przyjmij sprzęt ze zgłoszenia #N”). Status „Przyjęte do realizacji” się nie powtarza — wszystkie zgłoszenia na liście są otwarte.

**Sprzęt klienta** (`ClientEquipmentLookup`): panel boczny 34rem jak karta zlecenia, tylko do odczytu — serwisant przy telefonie sprawdza, co klient kupił i czy jest na gwarancji. Nagłówek: tytuł „Sprzęt klienta”, wybór klienta z podpowiedzi Subiekta; po wyborze pełna nazwa w `<dl>` (nie ucięta w polu), telefon jako link `tel:` i „Zmień klienta”. Treść: zdanie stanu stopień niżej od tytułu („9 urządzeń · 4 na gwarancji · 1 w serwisie teraz”), od 7 urządzeń szukanie w karcie (model, SN, faktura), rubryki „Na gwarancji” (kończąca się najwcześniej pierwsza), „Po gwarancji”, „Zlecenia serwisowe” (wiersz otwiera zlecenie z tablicy), „Naprawiane u nas, zakupu brak na liście” (wiersz: sprzęt ze zlecenia OnTime z tym numerem, a bez zlecenia — „Na fakturze:” z pozycjami faktury za naprawę; pod spodem SN i faktura; numery licencji z uwag „Dot. licencji” nie trafiają tu wcale). Wiersz urządzenia: nazwa (zawija się), jedna odznaka gwarancji (na telefonie pod nazwą), SN w Geist Mono zawijany między numerami albo „Bez numeru seryjnego na dokumencie · N szt.”, pod nim symbol · dokument z datą; link „W serwisie teraz: ZS…” / „Był w serwisie: ZS…”; Pusty wynik: jedna ramka z liczbą przejrzanych dokumentów i radą, o co zapytać. **Zaufane źródło:** na listach „Na gwarancji” / „Po gwarancji” jest tylko sprzęt pewny (`client-equipment-trust.ts`): model potwierdzony jako urządzenie (katalog serwisu albo decyzja „Tak”) i numer wskazany na dokumencie wprost albo przez serwisanta; korekty (KFS) i zwroty (ZW) usuwają oddany sprzęt. Wszystko inne idzie do rubryki „Do potwierdzenia” (pierwsza pod zdaniem stanu): „Czy {model} to urządzenie?” (Tak / Nie), „Do którego sprzętu należą numery?” (numery z jednego dokumentu razem, „Wszystkie tu” / „To ten”, przy nieznanym modelu „Nie sprzęt”, „Żaden — pomyłka w uwagach”, „Każdy osobno”) i „zostało N z M szt. — który egzemplarz wrócił?”. Decyzja zapisuje się dla wszystkich klientów (migracja 215), karta liczy się od nowa z wierszem stanu z logo. Przyjęcie sprzętu korzysta z tych samych zasad: sam wpisuje się tylko sprzęt pewny, a przy modelu niepotwierdzonym stoi zdanie „Pierwszy raz w serwisie — przyjęcie zapisze ten model jako sprzęt” (nie odznaka: to skutek wyboru, nie stan). Ostatni klient i wynik (5 min) zostają po zamknięciu panelu.

**Przyjmij sprzęt** (`ServiceOrderIntakeDialog`): od góry zgłoszenie z helpdesku (lista otwartych bez powtarzanego statusu, dostarczenie tymi słowami co kolumna tablicy: „Wysyła klient”, „Odbiór Mikran”; „Odepnij zgłoszenie” zostawia dane, zdanie mówi skutek), klient, sprzęt klienta z faktur („Stuknij numer seryjny — wpisze model, numer i datę zakupu z faktury”; numery to przyciski `rounded-md`, nie pigułki jak odznaka gwarancji), sprzęt i numer, gwarancja i data zakupu, usterka, potem pola opcjonalne. Wymagane są tylko klient, sprzęt i opis usterki; pozostałe etykiety mają „(opcjonalnie)” i mieszczą się w jednej linii (prawa kolumna 13.5rem). Stopka mówi całą listę braków („Do uzupełnienia: klient, sprzęt, opis usterki.”); próba zapisu z brakami zmienia ją na czerwone „Nie zapisano — uzupełnij: …” i stawia kursor w pierwszym brakującym polu; błąd zapisu też stoi w stopce. Zmiana klienta czyści sprzęt wybrany z faktury poprzedniego klienta, a gdy telefon, sprzęt i usterka przyszły ze zgłoszenia innego klienta — bursztynowa ramka z „Wyczyść telefon, sprzęt i usterkę”. Nazwa sprzętu spoza Subiektu (np. ze zgłoszenia) ma jedno zdanie: czy Subiekt ma podpowiedzi i co zapiszemy bez wyboru.

**Karta zlecenia** (`ServiceOrderDrawer`): panel boczny 34rem z `touch-ui`. Nagłówek: pole „Nr”, tytuł Inter Tight 700 `text-xl`, linia Meta (symbol, SN), kratki faktów `<dl>` z Rubric Label (Klient, Telefon jako link `tel:`, Przyjęte · dni, Termin albo Wydane/Anulowane, Gwarancja z datą zakupu), pasek pieczątek w trybie karty. Przyciski kroków mówią skutek („Pomiń diagnozę — naprawiaj”, „Wstrzymaj — czeka na część”), nie nazwę stanu. Pod nim przewijana treść: powód kroku, przycisk kroku (wzór „Kroki sprawy” z `DESIGN.md`), potem rubryki w stosie co 1.5rem. Ramka „Czeka na”: część, od kiedy i stan prośby do zakupów; bez żywej prośby (brak, anulowana, dostarczona gdzie indziej) przycisk „Zgłoś brak zakupom (N szt.)” — ponowne kliknięcie nie dubluje prośby. „Część na stanie — wznów” liczy stan po kolei: jedna dostarczona sztuka wznawia tylko najdłużej czekające zlecenie. Formularz wstrzymania pod wyborem części mówi stan z Subiektu („Na stanie: 43 szt. do wzięcia — zamiast wstrzymywać, pobierz…”, „Na stanie tylko 1 szt. — brakuje 2”, „Na stanie: 0 szt.”) i ustawia domyślnie zgłoszenie: zaznaczone, gdy brakuje, odznaczone, gdy leży na półce. Ze zlecenia zgłasza się każdą część z Subiektu (z ekranu Części — tylko z cechą). Rubryka „Zamiennik dla klienta”: powiązany egzemplarz z „Odepnij”; bez niego wybór egzemplarza już wydanego temu klientowi („Powiąż”) i „Wydaj z puli” albo samo „Wydaj zamiennik”. Wydanie dzieje się w karcie: kafle egzemplarzy na stanie (kod Geist Mono, model, stan), pigułki zwrotu 7/14/21/30 dni, zdanie skutku („ZAST-T02 trafi do … na czas naprawy ZS…, zwrot do … Egzemplarz od razu powiąże się z tym zleceniem”) i „Wydaj ZAST-T02”. Klient ze zlecenia, wydanie i powiązanie w jednej transakcji; bez wolnego egzemplarza — zdanie z linkiem do Zamienników.

**Katalog modeli** (`ServiceModelsCatalog`, `/serwis/modele`): jeden wiersz na model, rozwijany w miejscu (jeden naraz) w edytor części i gwarancji — model nigdy nie jest wybierany drugi raz. Na liście są modele z katalogu i modele znane jako sprzęt: były w naprawie albo serwisant potwierdził je w „Sprzęt klienta” (decyzja „Nie” wyklucza; `fetchKnownServiceModels`). Od góry: zdanie stanu tymi samymi słowami co grupy („18 modeli bez części · 1 model z częściami”), szukanie (model, symbol, symbol części) i „Model spoza listy” (podpowiedź Subiekta; wybrany model otwiera się z odznaką „Nowy” i trafia do katalogu dopiero z pierwszą częścią albo gwarancją inną niż domyślna; pusty wynik szukania ma „Szukaj „…” w Subiekcie”). Grupy: „Bez części” (najpierw najczęściej naprawiane), „Z częściami”. Wiersz: nazwa, symbol, gwarancja tylko gdy inna niż domyślna (domyślną mówi raz opis strony), liczba zleceń; po prawej „N części” albo „Nowy”, szewron. Otwarty wiersz trzyma swoją grupę do zamknięcia — pierwsza dodana część nie przerzuca go pod palcem. Edytor na `--sv-box`: „Części do naprawy” (zdanie skutku: podpowiedź przy „Pobierz część” w karcie zlecenia z tą ilością; steper − N szt. + i „Zapisz” w miejscu „Usuń” o stałej szerokości; „Usuń” z potwierdzeniem; „Dodaj część” z wybranym już modelem, przycisk „Dodaj do {symbol}”, przy części już obecnej „Zmień na N szt.”, po zapisie pole czyści się i dostaje fokus) i „Gwarancja od daty zakupu” (przyciski okresów 6–60 mies. jak filtr; wybór nie zapisuje — zdanie skutku z datą dla zakupu z dziś, że przyjęte zlecenia zachowują swoją datę, i „Zapisz N mies.” / „Zostaw N mies.”). Lista bez `overflow-hidden`, bo podpowiedzi Subiekta wychodzą poza ostatni wiersz.

## Elevation & Depth

Bez zmian względem `DESIGN.md`: karty grup z cieniem karty, panel boczny z cieniem okna. Rubryki wewnątrz karty i panelu nie mają cienia, odróżnia je linia `--sv-rule`. `--shadow-brand` ma pod `.serwis-world` fioletowy odcień (jasny) i czysty cień (ciemny); używa go tylko kafel marki. Pas Serwisu jest płaski, bez cienia i bez rozmycia.

## Shapes

Promienie z `DESIGN.md`. W świecie Serwisu:

- 6px (`rounded-md`): rubryka pieczątki, pole „Nr”, filtr, widok i przycisk na pasie.
- 8px (`rounded-lg`): rubryka (`rubricBoxClass`), karta modelu zamiennika.
- 10px: karta grupy na tablicy.
- Koło (`rounded-full`): pieczątka, obrócona o −7°. To jedyny obrócony element świata.
- Pusta i pominięta rubryka pieczątki ma ramkę przerywaną; przerywana jest też ramka „planowany zwrot” na osi czasu zamienników. Inne przerywane ramki nie występują.

## Components

### Pasek pieczątek (`ServiceStampStrip`)

Ruch charakterystyczny Serwisu. Pięć rubryk: Przyjęto · Diagnoza · Naprawa · Gotowe · Wydano (`SERVICE_STAMP_LABEL`); „czeka na część” to stan rubryki Naprawa, nie szósta rubryka. Stany (`serviceOrderStamps`):

| Stan | Rubryka | Wnętrze | Etykieta |
|---|---|---|---|
| `done` | `bg-card`, ramka 1px `--sv-rule` | pieczątka: koło 2px `--sv-stamp`, data `dd.mm` (bez daty: ptaszek) | `slate-600` |
| `current` | `bg-card`, ramka 2px `--sv-stamp` | pieczątka jak wyżej | `--sv-stamp` |
| `waiting` | `amber-50`, ramka 2px `amber-500` | ikona zegara `amber-800`, w karcie słowo „czeka” (część, rubryka Naprawa) albo „klient” (decyzja po wycenie, rubryka Diagnoza; `waitingFor`) | `amber-800` |
| `skipped` | `--sv-box`, ramka przerywana `--sv-rule` | kreska `slate-400` | `slate-600` |
| `empty` | `--sv-box`, ramka przerywana `--sv-rule` | puste | `slate-600` |

Data to ostatnie wejście w krok (po cofnięciu liczy się nowa). Wydane i anulowane zlecenie nie ma bieżącej rubryki; anulowane ma cały pasek przygaszony (`opacity-60`), a osiągnięte pieczątki zostają.

- **Wiersz (`size="row"`)**: rubryki 3rem, pieczątka 2.5rem, bez inicjałów. Pasek stoi w przycisku wiersza, więc to same `span` z `aria-hidden`; dla czytnika obok jest `sr-only` z `stampSummary` („Naprawa 06.11”, „Naprawa czeka na część”).
- **Karta (`size="card"`)**: rubryki 4rem, pieczątka 3.25rem z inicjałami. Lista `<ol>` z `aria-label` „Przebieg naprawy: Przyjęto: 04.11, Diagnoza: 04.11, Naprawa: 06.11 (teraz), Gotowe: jeszcze nie, …”.

### Rubryka (`Section`, `rubricBoxClass`, `rubricHeadClass`)

Blok treści karty zlecenia, karty zamiennika i formularzy Serwisu: białe pole z ramką `--sv-rule`, promień 8px, pasek nagłówka min. 2.5rem z Rubric Label i opcjonalną akcją po prawej („Pobierz część”), oddzielony linią `--sv-rule`; treść `px-3 py-3`. Zastępuje `CardHeader` wewnątrz panelu. Rubryka w rubryce jest zakazana tak jak karta w karcie; wewnątrz dziel listę liniami `--sv-rule`, formularz dodawania stawiaj na `--sv-box` między liniami.

### Pole „Nr”

Numer karty w kratce formularza w nagłówku panelu zlecenia i zamiennika: `rounded-md`, ramka `--sv-rule`, `bg-card`, min. 2.25rem, Rubric Label „Nr” i numer w Geist Mono 600 `text-[0.8125rem]` `slate-900`. Tylko w nagłówku panelu jednego obiektu.

### Pasek filtrów (`ServiceFilterBar`)

Filtry Serwisu to kontrolki, nie kafle: jeden rząd przycisków „kropka · licznik · nazwa”, min. 44px, `rounded-md`, `text-sm` 500, licznik 600 z cyframi tabelarycznymi, `aria-pressed`, opis tego, co liczy, w `title`. Klik włącza, drugi klik wyłącza (jeden filtr naraz). W spoczynku ramka `--sv-rule` na przezroczystym tle, hover ramka `slate-400` i `bg-card`; licznik zero przygasza tekst do `slate-500` i kropkę do 40%. Wybrany: `serwisFilterActiveClass` (ramka i wewnętrzny obrys `indigo-600`, tło `indigo-50`, tekst `indigo-900`) — ten sam wybór co kafel `QueuePanelToolbar` w `DESIGN.md`. Kropka ma kolor stanu grupy (`emerald-600`, `slate-400`, `amber-500`, `red-600`); grupa łącząca dwa stany („Do ruchu teraz”) nie ma kropki. Od `sm` rząd się zawija; na telefonie zostaje jednym rzędem przewijanym w bok, wysuniętym do krawędzi ekranu (`-mx-3 px-3`), żeby filtry nie spychały listy pod dolny pasek. Bez etykiety nad rzędem; nazwę grupy niesie `aria-label`.

Zamienniki filtrują tymi samymi klasami kartami modeli (nagłówek rubryki z nazwą i symbolem, pod nim „N z M na stanie”, kreski egzemplarzy w kolorach stanu, „N u klienta · N po terminie”). Karta wygląda jak treść, więc ostatnia linia (`indigo-700`) mówi, że filtruje: „Pokaż tylko ten model”, po wyborze „Pokazuję tylko ten model — stuknij, by pokazać wszystkie”.

### Zdanie stanu

Pierwsza rzecz pod szukaniem: liczby tego, co czeka na ruch, rozdzielone „ · ”, najpierw pilne (do ruchu teraz, do wydania, zgłoszenia do przyjęcia, dokumenty), potem w toku; gdy nic pilnego, zaczyna od „Nic pilnego”. Zero się nie pojawia. Liczebniki z `polishPluralWord`.

**Te same słowa, te same liczby.** Każda część zdania nazywa grupę tymi słowami, którymi nazywa ją filtr i nagłówek grupy, i podaje tę samą liczbę co licznik filtra. Zdanie nie wprowadza pojęcia, którego nie ma pod nim.

### Pas Serwisu (`ServiceShellBar`)

Pozycje widoków jak w Layout. Aktywny widok: pole `--sv-rail-active` z tekstem `--sv-rail-active-ink`, `aria-current="page"`; spoczynek tekst `--sv-rail-ink`, hover `--sv-rail-hover`, 150 ms. Licznik przy widoku to liczba „po terminie”: pigułka `amber-500` z tekstem `slate-950` i `sr-only` „po terminie”. „Przyjmij sprzęt” to jedyna wypełniona kontrolka pasa i jedyna główna akcja szkieletu. Menu konta: kontrolka 44px z ramką `--sv-rail-line`, w menu wybrany motyw ma ptaszek `indigo-700`. Stan helpdesku mikran.pl nie stoi na pasie: jest drugą linią pozycji „Połącz helpdesk” w menu konta (kropka `emerald-500` + „Połączony · kto · kiedy” albo szara „Niepołączony”). Brak połączenia i błąd pokazuje tablica zleceń alertem nad zgłoszeniami.

### Tabele Serwisu

Części i lista zamienników: nagłówek na `--sv-box` z Rubric Label, linie wierszy `--sv-rule`, hover `--sv-box`, cały wiersz otwiera obiekt (kursor wskazujący). Poza tym zasady Data Table z `DESIGN.md`. Na Częściach kolumna akcji: „Zgłoś brak” (gdy brak/poniżej minimum i bez prośby) i „Ustaw minimum” / „Minimum N szt.” — okno z polem ilości i zdaniem skutku przed zapisem („Przy najbliższym ZD u {dostawca} zakupy dokupią do N szt.…”; bez znanego dostawcy — że minimum zadziała dopiero po przypięciu dostawcy). Minimum to `zd_estimate_min_stock` (to samo „Minimum stanów” co w Kreatorze ZD); minimum ustawione przez zakupy serwis widzi, ale go nie zmienia ani nie kasuje (zapis odmawia z komunikatem); część z minimum i znanym dostawcą nie jest „do zgłoszenia”, w podpisie stanu „dokupią przy ZD”, bez dostawcy „brak dostawcy — zgłoś”. Na telefonie przyciski pod nazwą części.

### Ruch

`sv-stamp-in` (`globals.css`): pieczątka „wbija się” — od skali 1.35 i obrotu −14° bez krycia, przez 0.94 i −5°, do 1.0 i −7°; 320 ms, `cubic-bezier(0.22, 1, 0.36, 1)`, `both`. Dostaje ją tylko pieczątka przybita w ciągu 6 s przed zamontowaniem paska (`FRESH_MS`, jeden odczyt czasu na montowanie), czyli ta, którą serwisant przybił przed chwilą; starsze stoją spokojnie i nic nie animuje się przy wejściu na stronę. Przy `prefers-reduced-motion: reduce` animacji nie ma, pieczątka pojawia się od razu w ułożeniu końcowym. Poza tym ruch jak w `DESIGN.md` (150 ms kolory, `panel-slide-enter` panelu, strzałka wiersza przesuwa się o 2px w hover).

## Do's and Don'ts

### Do:

- **Do** pisz komponenty Serwisu klasami bazowymi (`indigo-*`, `bg-primary`, `ring-focus`) i zmiennymi `--sv-*`; świat podmienia wartości, nie komponenty.
- **Do** kończ wiersz zlecenia paskiem pieczątek, a nagłówek karty zlecenia pełnym paskiem w trybie karty.
- **Do** dziel kartę zlecenia i zamiennika na rubryki (`Section`) z Rubric Label; etykiety pól formularzy Serwisu bierz z `fieldLabelClass`.
- **Do** zaczynaj tablicę zdaniem stanu, którego słowa i liczby są słowami i licznikami filtrów pod nim.
- **Do** trzymaj kolejność grup: Do ruchu teraz, Do wydania, helpdesk, Czeka na klienta, W naprawie, Czeka na część, Bez dokumentów, Zamknięte.
- **Do** dawaj każdej nowej stronie Serwisu `touch-ui` i sprawdzaj ją przy 390px z filtrami przewijanymi w bok.
- **Do** dopisz każdą nową parę tekst/tło Serwisu do `SERWIS_PAIRS` i sprawdź oba motywy.

### Don't:

- **Don't** barw stanu fioletem; „u klienta”, „w naprawie” i podobne stany są w kolorach tabeli Stany albo szare.
- **Don't** używaj Petrolu pod `.serwis-world` ani fioletu poza nim; nie dodawaj wariantów `dark:` ani klas warunkowych „jeśli serwis”.
- **Don't** pisz wersalikami niczego poza `rubricLabelClass`.
- **Don't** animuj pieczątek przy ładowaniu strony; „wbicie” ma tylko pieczątka sprzed mniej niż 6 s.
- **Don't** dodawaj szóstej rubryki pieczątki ani rubryki dla czekania; czekanie to stan rubryki Naprawa.
- **Don't** obracaj ani nie przerywaj ramek niczego poza pieczątką i pustą rubryką (oraz planowanym zwrotem na osi czasu).
- **Don't** stawiaj filtrów jako kafli z dużą liczbą ani etykiety nad rzędem filtrów.

### Znany dług

Stan na 6.11.2026, z kodu gałęzi `claude/serwis-redesign` i zrzutów `.impeccable/review/` (motyw jasny, 1440 i 390px).

| Reguła | Gdzie | Uwagi |
|---|---|---|
| Motyw ciemny | cały świat | oglądany 17.11.2026 (tablica, Części, Zamienniki, karta zlecenia): tekst w karcie i pigułki stanu ≥ 4.5:1; okna Zamienników i formularze kroków w ciemnym jeszcze bez zrzutów. Fokus pól i przycisków (`--color-focus`, `--brand-sky`) był Petrolem — od 17.11 w `.serwis-world` liczony z fioletu świata |
| Grupy bez danych | „Do ruchu teraz”, „Do wydania” na tablicy; „ponad 14 dni”, „po terminie” i „u klienta” w Zamiennikach | widziane tylko puste (zero w filtrze); wiersz z odznaką powodu i pas z licznikiem „po terminie” nie były widziane z danymi |
| Tabela Części przy 390px | `ServicePartsPanel` | nagłówek tabeli ucięty na telefonie |
| Okna w starym układzie | `LoanerIssueDialog`, `LoanerAddDialog` | tylko etykiety pól przeszły na `fieldLabelClass`; bez rubryk; wybrany egzemplarz z obrysem `indigo-600` bez tła `indigo-50`; lista podpowiedzi w `LoanerAddDialog` ma `shadow-lg` i `z-[90]` |
| Okno w starym układzie | `ServicePartReportDialog` | nie przeszło nawet na etykiety rubryk: pola przez `Field` z `src/components/ui/` |
| Te same słowa w zdaniu stanu | `boardStateSentence` w `ServiceOrdersBoard` | słowa i liczby zgadzają się z filtrami („Bez dokumentów”, „W naprawie”, „Czeka na część”); zgłoszenia do przyjęcia są w zdaniu, ale nie mają filtra — ich licznik stoi w nagłówku sekcji |
| Rubryka zamiast karty | grupy tablicy i `HelpdeskTicketsSection` | linie już `--sv-rule`, promień panelu; nagłówki grup zostają Geist 600 jak karta (świadomie: to lista, nie rubryka formularza) |
| Ramka kontrolki 3:1 | filtr w spoczynku i pusta rubryka na `--sv-rule` | test wymaga dla `--sv-rule` / karta tylko 1.3:1 (linia dekoracyjna); jako granica filtra jest poniżej 3:1 (WCAG 1.4.11), jak bazowa „Ramka pola” |

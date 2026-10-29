# Ciemny tryb OnTime — plan

Stan: **plan do zatwierdzenia, bez kodu.** 2026-10-29. Podstawa: `DESIGN.md` (normatywny), inwentarz `src/` na `fec424df`, pomiar kontrastu WCAG 2.x i podgląd ciemnej palety wstrzykniętej do działającej aplikacji (dev, 35 ekranów, 1280 px i 375 px).

## 1. Do decyzji (przed plasterkiem 1)

| # | Decyzja | Rekomendacja | Dlaczego |
|---|---|---|---|
| D1 | Etykiety przełącznika | **Jasny · Ciemny · Jak w systemie** | „Systemowy” można przeczytać jako „domyślny systemu OnTime”. „Jak w systemie” mówi, skąd bierze się kolor; opis pod spodem dopowiada „komputera lub telefonu”. |
| D2 | Wartość domyślna dla wszystkich kont | **Jasny** do końca plasterka 8, potem do ponownej decyzji | Kto ma ciemny system, po wdrożeniu nagle dostałby ciemny OnTime, zanim każdy ekran przejdzie odbiór. Przełącznik jest widoczny od pierwszego dnia, więc chętni włączą sami. |
| D3 | Gdzie przełącznik | **Ustawienia → Wygląd** (pełny, z etykietami) **i** menu konta / „Więcej” na telefonie (ikony) | Patrz §5. Jeden stan, dwa wejścia; jedno z nich jest tam, gdzie już jest „Rozmiar czcionki”. |
| D4 | Linki w jasnym trybie | `text-indigo-600` → `text-indigo-700` (ciemniejszy Petrol, 7.56:1 zamiast 5.55:1) | W ciemnym `indigo-600` musi być wypełnieniem (§3.2); jeden krok nie może być i tekstem, i wypełnieniem. Alternatywa bez zmiany jasnego wyglądu: nowy token `text-link` (62 miejsca, ten sam codemod). |
| D5 | Poprawki jasnego motywu, które wychodzą przy okazji | **Tak**: `emerald-600` → `#047857`, `amber-600` → `#b45309` (dziś biały tekst na nich ma 3.77:1 i 3.19:1) | Te same kroki dostają w ciemnym rolę „wypełnienie”, więc poprawka jest jednym ruchem dla obu motywów. Ikony stanów w jasnym ściemnieją o jeden krok. |
| D6 | Ekran logowania | **Bez zmian**: zostaje ciemny gradient marki, w obu motywach | DESIGN.md: „Ciemne tło z gradientem marki występuje wyłącznie na ekranach logowania”. Ciemny tryb aplikacji to nie ten gradient (Don't: „nie przenoś ciemnego gradientu logowania do aplikacji”). |

## 2. Jak to działa — jedna zmienna na `<html>`, bez `dark:` w komponentach

Dziś w `src/` nie ma ani jednego wariantu `dark:`, a cała aplikacja koloruje się przez przemapowane palety Tailwinda (`globals.css` → `@theme`: `slate-*` = szarości OnTime, `indigo-*` = Petrol, pozostałe rodziny wskazują na te dwie lub na stany). Tailwind v4 generuje każdą klasę jako `var(--color-…)`, a `globals.css` sam używa `var(--color-…)` 313 razy.

Dlatego ciemny tryb to **drugi zestaw wartości tych samych zmiennych** pod `html[data-theme="dark"]`, a nie 10 000 klas `dark:`:

```css
/* globals.css — po bloku @theme */
html[data-theme="dark"] {
  color-scheme: dark;
  --background: #0e1116; --card: #161a20; /* … pełna lista w §3 */
  --color-slate-50: #1b2027; /* … */
}
```

Warunek, żeby to działało: **każdy krok palety ma jedną rolę**. Inwentarz (10 107 klas kolorów w 585 plikach) pokazuje, że prawie tak jest:

| Kroki | Rola w jasnym | Rola w ciemnym |
|---|---|---|
| 50–200 | tła, linie (`bg`, `border`, `ring`, `divide`) | ciemne tła i linie, rosną w jasność od 50 do 300 |
| 300 | linia w hover, suwak | to samo |
| 400 | tekst pomocniczy, ikony | to samo (≥ 3:1) |
| 500 | Meta, nagłówki kolumn; w stanach: sygnał | to samo (≥ 4.5:1); w stanach: jasny sygnał |
| **600** | **slate: tekst; Petrol i stany: tekst *i* wypełnienie** | slate: tekst; **Petrol i stany: tylko wypełnienie i sygnał** |
| 700–950 | tekst | jasny tekst |

Konflikt jest tylko w kroku 600 kolorowych rodzin (i w kilku wypełnieniach krokiem 700+). Rozwiązują go codemody z §4.2 i zasada, która wchodzi do DESIGN.md: **w Petrolu i stanach krok 600 to wypełnienie i sygnał, tekst zaczyna się od 700.**

### 2.1 Nowe tokeny semantyczne (tylko tam, gdzie paleta nie wystarcza)

| Token (klasa) | Jasny | Ciemny | Po co |
|---|---|---|---|
| `card` (`bg-card`, `ring-card`, `border-card`) | `#ffffff` | `#161a20` | zastępuje `bg-white` (407 + 97 z przezroczystością); biel nie może się przemapować, bo `text-white` na wypełnieniach zostaje biały |
| `raised` (`bg-raised`) | `#ffffff` | `#1d222a` | okno, panel boczny, popover, lista podpowiedzi: w ciemnym głębię daje jaśniejsza powierzchnia, nie cień |
| `primary`, `primary-hover`, `primary-pressed` | `#0f7380` / `#0d5d67` / `#0f4b53` | `#157984` / `#17818c` / `#14717b` | hover i wciśnięcie głównego przycisku (dziś `hover:bg-indigo-700`, `active:bg-indigo-800` — w ciemnym te kroki są jasnym tekstem) |
| `focus` (`ring-focus`, `outline-focus`) | `#0f7380` | `#2aa3b0` | pierścień fokusu; `indigo-600` w ciemnym ma tylko 2.94:1 na wybranym chipie |
| `scrim` (`bg-scrim/40`) | `#151920` | `#000000` | tło pod oknem (dziś `bg-slate-900/40` — w ciemnym zrobiłoby się jasną mgłą) |
| `inverse`, `on-inverse` | `#151920` / `#ffffff` | `#e8ebef` / `#151920` | dymki i ciemne chipy (dziś `bg-slate-900 text-white`) |
| `--tw-ring-offset-color` (baza) | `#fff` | `var(--card)` | domyślny odstęp pierścienia Tailwinda jest biały — w ciemnym każdy fokus z `ring-offset` miałby białą obwódkę (zmierzone: `#fff`) |

### 2.2 Zakres zawsze jasny (`.theme-light`)

Klasa, która na swoim poddrzewie przywraca jasne wartości zmiennych. Dostają ją:

- **ekran logowania i reset hasła** (`AuthBackgroundArt`, `AuthSplitBridge`: 26 twardych kolorów pod ciemny gradient — zostają, bo strona i tak ma własne tło marki),
- **podgląd maila** (`MailPreview`, `EmailHtmlPreview`: iframe z HTML-em maila w stylach inline — mail u odbiorcy jest jasny, więc podgląd też),
- **papier**: wydruk (`@media print` przełącza na jasny), podgląd PDF/etykiet, jeśli powstanie.

Maile wychodzące (`src/lib/email/*`, `sales-email-layout.ts`) i PDF z `pdf-lib` **nie zmieniają się** — to dokumenty dla ludzi spoza OnTime.

## 3. Tokeny ciemne

### 3.1 Powierzchnie i neutralne

| Token DESIGN.md | Klasa / zmienna | Jasny | Ciemny |
|---|---|---|---|
| canvas | `var(--background)` | `#f3f5f7` | `#0e1116` |
| card | `bg-card`, `var(--card)` | `#ffffff` | `#161a20` |
| raised | `bg-raised` | `#ffffff` | `#1d222a` |
| well | `slate-50` | `#f6f7f9` | `#1b2027` |
| line-soft | `slate-100` | `#eef0f3` | `#222831` |
| line | `slate-200`, `var(--card-border)` | `#e1e4e9` | `#2c333d` |
| line-strong | `slate-300` | `#c9ced6` | `#3b434f` |
| ink-faint | `slate-400` | `#737b87` | `#8b939f` |
| ink-muted | `slate-500`, `var(--muted)` | `#626a76` | `#9ea6b1` |
| ink-secondary | `slate-600`, `var(--muted-foreground)` | `#4a515c` | `#b5bcc6` |
| graphite-soft | `slate-700` | `#363c46` | `#c9cfd7` |
| — | `slate-800` | `#232830` | `#dadfe5` |
| graphite | `slate-900`, `var(--foreground)` | `#151920` | `#e8ebef` |
| — | `slate-950` | `#0b0e13` | `#f3f5f7` |

Tekst główny nie jest czystą bielą (`#e8ebef`, 14.6:1): czysta biel na prawie czarnym tle „świeci” przy długiej pracy na listach.

### 3.2 Petrol i stany

| Krok | Petrol (`indigo`) | Gotowe (`emerald`) | Uwaga (`amber`) | Błąd (`red`) |
|---|---|---|---|---|
| 50 | `#122a2e` | `#0f2a21` | `#2d2310` | `#321719` |
| 100 | `#16373c` | `#12352a` | `#3a2c12` | `#3e1b1e` |
| 200 | `#1f4d54` | `#1a4a3a` | `#523d16` | `#592428` |
| 300 | `#2b6971` | `#246a52` | `#77581d` | `#7d3035` |
| 400 | `#3f97a1` | `#2f9a73` | `#c08a1f` | `#c4484f` |
| 500 | `#2aa3b0` | `#22b07f` | `#f2a524` | `#e2545b` |
| **600 (wypełnienie)** | **`#157984`** | **`#1c7d5a`** | **`#99610c`** | **`#ca383f`** |
| 700 | `#6ccfd8` | `#5fd3a4` | `#f6c464` | `#f58d93` |
| 800 | `#92dce3` | `#86e0bb` | `#f8d28a` | `#f8aaae` |
| 900 | `#b6e8ec` | `#aeead1` | `#fadfae` | `#fbc8cb` |
| 950 | `#d9f4f6` | `#d3f5e6` | `#fdefd3` | `#fde3e4` |

Wypełnienia 600 policzone, nie dobrane na oko: dla każdej barwy szukałem jasności, przy której jednocześnie biały tekst ma ≥ 4.5:1, a samo wypełnienie odcina się od ciemnej karty i tła ≥ 3:1. Okno jest wąskie (Petrol: L 28–32 % w HSL), środek okna to wartości w tabeli. Główny przycisk w ciemnym (`#157984`) jest prawie identyczny jak w jasnym (`#0f7380`) — marka się nie zmienia.

Cienie w ciemnym: `--shadow-card` `0 1px 2px rgba(0,0,0,.4)`, `--shadow-card-elevated` `0 1px 2px rgba(0,0,0,.45), 0 8px 24px -8px rgba(0,0,0,.6)`, `--shadow-elevated` `0 6px 18px -4px rgba(0,0,0,.55)`. Głębię niesie głównie `raised` i linia `line`.

### 3.3 Pomiar kontrastu (WCAG 2.x)

Próg: tekst 4.5:1, ikony / obrys / pierścień 3:1, linie bez progu (podane dla porównania z jasnym). „Jasny po poprawkach” = po D5.

| Para | Próg | Jasny dziś | Jasny po poprawkach | Ciemny |
|---|---|---|---|---|
| graphite (slate-900) / card | 4.5:1 | 17.62 | 17.62 | 14.60 |
| graphite (slate-900) / canvas | 4.5:1 | 16.12 | 16.12 | 15.81 |
| slate-800 / card | 4.5:1 | 14.81 | 14.81 | 13.03 |
| slate-700 (przycisk 2°, menu) / card | 4.5:1 | 11.10 | 11.10 | 11.13 |
| slate-700 / slate-100 (odznaka neutralna) | 4.5:1 | 9.72 | 9.72 | 9.46 |
| slate-600 (komórki, etykiety) / card | 4.5:1 | 8.01 | 8.01 | 9.12 |
| slate-600 / canvas (opis strony) | 4.5:1 | 7.33 | 7.33 | 9.88 |
| slate-600 / slate-50 (well) | 4.5:1 | 7.47 | 7.47 | 8.56 |
| slate-500 (Meta, nagłówek kolumny) / card | 4.5:1 | 5.47 | 5.47 | 7.10 |
| slate-500 / slate-50 (nagłówek tabeli) | 4.5:1 | 5.10 | 5.10 | 6.66 |
| slate-500 / canvas | 4.5:1 | 5.00 | 5.00 | 7.69 |
| slate-500 / slate-100 | 4.5:1 | 4.79 | 4.79 | 6.03 |
| slate-400 (pomocniczy, ikony) / card | 3:1 | 4.28 | 4.28 | 5.63 |
| slate-400 / slate-50 | 3:1 | 3.99 | 3.99 | 5.28 |
| slate-300 linia w hover / card | — | 1.58 | 1.58 | 1.75 |
| slate-200 ramka karty / card | — | 1.27 | 1.27 | 1.37 |
| slate-200 ramka karty / canvas | — | 1.17 | 1.17 | 1.48 |
| card / canvas (krok warstwy) | — | 1.09 | 1.09 | 1.08 |
| slate-50 well / card | — | 1.07 | 1.07 | 1.07 |
| indigo-700 link / card | 4.5:1 | 7.56 | 7.56 | 9.61 |
| indigo-700 / canvas | 4.5:1 | 6.92 | 6.92 | 10.41 |
| indigo-800 (przycisk Outline) / indigo-50 | 4.5:1 | 8.95 | 8.95 | 9.72 |
| indigo-900 aktywne menu / indigo-50 | 4.5:1 | 10.71 | 10.71 | 11.27 |
| indigo-900 wybrany chip / indigo-50 | 4.5:1 | 10.71 | 10.71 | 11.27 |
| indigo-500 fokus pola / card | 3:1 | 4.16 | 4.16 | 5.79 |
| indigo-50 wybrany wiersz / card | — | 1.09 | 1.09 | 1.16 |
| biały / primary (indigo-600) | 4.5:1 | 5.55 | 5.55 | 5.12 |
| biały / primary hover | 4.5:1 | 7.56 | 7.56 | 4.61 |
| biały / primary pressed | 4.5:1 | 9.76 | 9.76 | 5.71 |
| primary / card (krawędź przycisku) | 3:1 | 5.55 | 5.55 | 3.41 |
| biały / danger (red-600) | 4.5:1 | 4.83 | 4.83 | 5.06 |
| biały / danger hover | 4.5:1 | 6.47 | 6.47 | 5.79 |
| biały / success (emerald-600) | 4.5:1 | **3.77 ✗** | 5.48 | 5.08 |
| biały / amber-600 | 4.5:1 | **3.19 ✗** | 5.02 | 5.16 |
| dymek inverse: tekst / tło | 4.5:1 | 17.62 | 17.62 | 14.60 |
| emerald-800 / emerald-50 (odznaka) | 4.5:1 | 7.29 | 7.29 | 9.75 |
| emerald-700 / emerald-50 | 4.5:1 | 5.21 | 5.21 | 8.26 |
| emerald-700 / card | 4.5:1 | 5.48 | 5.48 | 9.43 |
| emerald-600 ikona / card | 3:1 | 3.77 | 5.48 | 3.43 |
| amber-900 / amber-50 (odznaka) | 4.5:1 | 8.75 | 8.75 | 11.94 |
| amber-800 / amber-50 | 4.5:1 | 6.84 | 6.84 | 10.72 |
| amber-700 (zmiana > 5 %) / card | 4.5:1 | 5.02 | 5.02 | 10.81 |
| amber-700 / amber-50 | 4.5:1 | 4.84 | 4.84 | 9.56 |
| amber-500 sygnał / card | 3:1 | **2.15 ✗** | **2.15 ✗** | 8.47 |
| amber-950 / amber-100 | 4.5:1 | 13.45 | 13.45 | 11.92 |
| red-800 / red-50 (odznaka) | 4.5:1 | 7.60 | 7.60 | 8.92 |
| red-700 tekst błędu / card | 4.5:1 | 6.47 | 6.47 | 7.58 |
| red-700 / red-50 | 4.5:1 | 5.91 | 5.91 | 7.16 |
| red-600 ikona / card | 3:1 | 4.83 | 4.83 | 3.45 |
| slate-900 / raised (okno) | 4.5:1 | 17.62 | 17.62 | 13.36 |
| slate-500 / raised | 4.5:1 | 5.47 | 5.47 | 6.50 |
| slate-400 / raised | 3:1 | 4.28 | 4.28 | 5.15 |
| slate-200 ramka / raised | — | 1.27 | 1.27 | 1.25 |
| slate-900 / indigo-100 | 4.5:1 | 14.40 | 14.40 | 10.67 |
| slate-900 / indigo-50 (wybrany wiersz) | 4.5:1 | 16.16 | 16.16 | 12.58 |
| slate-600 / indigo-50 | 4.5:1 | 7.34 | 7.34 | 7.86 |
| emerald-800 / emerald-100 | 4.5:1 | 6.78 | 6.78 | 8.54 |
| amber-800 / amber-100 | 4.5:1 | 6.37 | 6.37 | 9.41 |
| red-800 / red-100 | 4.5:1 | 6.80 | 6.80 | 8.22 |
| slate-900 / amber-50 (pas uwagi) | 4.5:1 | 16.99 | 16.99 | 12.92 |
| slate-600 / amber-50 | 4.5:1 | 7.72 | 7.72 | 8.07 |
| focus / indigo-50 (fokus na wybranym) | 3:1 | 5.09 | 5.09 | 4.99 |
| focus / card | 3:1 | 5.55 | 5.55 | 5.79 |
| focus / canvas | 3:1 | 5.08 | 5.08 | 6.27 |
| focus / raised | 3:1 | 5.55 | 5.55 | 5.30 |
| focus / amber-50 | 3:1 | 5.35 | 5.35 | 5.12 |
| focus / red-50 | 3:1 | 5.07 | 5.07 | 5.47 |

**Ciemny: 0 par poniżej progu.** Jasny dziś: 3 pary poniżej (dwie znikają po D5; `amber-500` jako jedyny sygnał na białym ma 2.15:1 — zostaje, bo pas uwagi i kropki stoją zawsze obok tekstu; zapisane w „Znaleziono”).

Plasterek 1 przenosi ten pomiar do testu (`scripts/audit-theme-contrast.test.ts`): wartości czyta z `globals.css`, więc zmiana tokenu, która zbije parę pod próg, wywraca CI.

## 4. Inwentarz

### 4.1 Co przejdzie samo (remap zmiennych)

Sprawdzone w przeglądarce: paleta z §3 wstrzyknięta do działającej aplikacji + zastępstwa codemodów z §4.2, potem przegląd `getComputedStyle` każdego widocznego elementu (tło jaśniejsze niż L 0.45 = „został jasny”, tekst poniżej 4.5:1 / 3:1 dla dużego = „nieczytelny”), przy wyłączonych przejściach CSS.

| Ekrany | Jasne tła | Tekst < AA |
|---|---|---|
| `/podsumowanie`, `/admin` (+ handlowcy, mail, produkty, użytkownicy, wysyłki, zgłoszenia), `/dostawy`, `/historia`, `/kolejka`, `/kurierzy`, `/podsumowanie-miesieczne`, `/weryfikacja`, `/zakupy/*` (asystent, automat, braki, cenniki, gadki, odprawy, szacunek), `/zamowienia/nowe`, `/zeby/*` (braki, historia, kolejka, przyjęcie, weryfikacja), `/zespol`, `/zespol/grupy`, `/ustawienia`, okno „Co nowego” | 0 (poza kropkami i paskiem postępu `amber-500` — to sygnał, poprawnie) | 0 |
| `/urlopy`, `/zespol/urlopy` | 0 | 3 — cyfry dni `text-slate-300` w kalendarzu (w jasnym też tylko 1.58:1, patrz §4.3) |
| 375 px, `/podsumowanie` | 0 | 0; bez przewijania w poziomie, dolny pasek czytelny |

Nie objęte przeglądem (sprawdzić w plasterku 8): ekrany handlowca (`/moje`, `/notatnik`, `/plan`, `/prosba`, `/tablica`, `/zk`) — konto testowe to admin, a podgląd roli jest wspólnym cookie z innymi sesjami, więc go nie przełączałem; Kreator ZD z policzoną listą (lokalny Subiekt nie odpowiedział, widać tylko ekran ładowania z `BrandLoader`, który wygląda poprawnie); panele boczne i okna z danymi; toasty.

### 4.2 Co wymaga zmiany w kodzie (codemody, policzone węzłem po `git ls-files src`, bez testów)

| Wzorzec | Wystąpienia / pliki | Zamiana | Jak |
|---|---|---|---|
| `bg-white` | 407 / 208 | `bg-card` | codemod (z wariantami `hover:` itd.) |
| `bg-white/N` | 97 / 59 | `bg-card/N` | codemod; sticky chrome z `backdrop-blur` zostaje półprzezroczysty |
| `ring-white`, `border-white` (+ `/N`) | 27 / 19 | `ring-card`, `border-card` | codemod (obwódka awatara, kropki na karcie) |
| `from-white` w gradiencie | 1 / 1 | `from-card` | ręcznie |
| `bg-[linear-gradient(180deg,#ffffff…#f8fafc)]` | 1 (`zdEstimatePrepCardClass`) | `bg-card` | ręcznie (gradient i tak łamie „bez gradientów”) |
| `text-{indigo,violet,…}-600` | 62 / 45 | `text-indigo-700` (D4) | codemod |
| `text-{red,rose}-600` | 42 / 37 | `text-red-700` (DESIGN.md: tekst błędu = 700) | codemod |
| `text-{emerald,green,lime}-600` | 24 / 19 | `text-emerald-700` (dziś 3.77:1 — poprawka i w jasnym) | codemod |
| `text-{amber,orange,yellow}-600` | 16 / 15 | `text-amber-700` | codemod |
| `ring-/outline-{indigo,violet}-600` (fokus) | 103 / 63 | `ring-focus` / `outline-focus`; baza `@layer base` też na `var(--color-focus)` | codemod |
| wypełnienia krokiem 700+ (`hover:bg-indigo-700`, `active:bg-indigo-800`, `bg-slate-900 text-white`, `hover:bg-red-700` …) | 31 / 19 | `bg-primary-hover`, `bg-primary-pressed`, `bg-inverse text-on-inverse`, … | **ręcznie, plik po pliku** (różne znaczenia) |
| tła pod oknem `bg-slate-900/N`, `bg-slate-950/N` | 13 / 9 | `bg-scrim/N` | codemod |
| `bg-black/N` (delikatne przyciemnienia) | 7 / 6 | `bg-slate-900/N` (w ciemnym rozjaśnia, jak trzeba) | ręcznie — `bg-black/45` to tło okna → `bg-scrim/45` |
| `SUMMARY_COLORS` (hex w `src/types/database.ts`) w `style={{ backgroundColor }}` | 18 kolorów, 2 miejsca renderu (`LocationScheduleClient`, `ColorLegend`) | zmienne `--row-today` … z wartością jasną i ciemną | ręcznie; `recalc.ts` liczy z tych hexów `modifyHexColor` — w ciemnym przyciemnienie zastąpić drugą zmienną |
| hex w SVG: `MyOrderPickupShelfNoticeDialog` (18), `StrokeIcons` ikona legendy (4) | 22 / 2 | `fill="var(--color-emerald-50)"` itd. | ręcznie |
| `BrandLoader` bez kafla: obrys `#0f7380` na ciemnej karcie ≈ 3.2:1 | 1 | obrys `var(--color-indigo-500)` | ręcznie |
| `globals.css`: 15 surowych `rgb()` (podświetlenia bursztynowe w Kreatorze, `rgb(255 255 255 / .65)` w połysku, cienie paneli) | 15 | zmienne lub wersja pod `[data-theme=dark]` | ręcznie |
| `[data-notepad-flash]::after` `mix-blend-mode: multiply` na `rgb(212 237 239)` | 1 | w ciemnym `background: var(--color-indigo-200)`, `mix-blend-mode: screen` | ręcznie |
| dowolne cienie `shadow-[…rgba(…)]` | 16 / 15 | `var(--shadow-*)` (to już „Znany dług” w DESIGN.md) | ręcznie; w ciemnym bez tego są tylko niewidoczne, nie psują czytelności |
| `NoteColorPicker` `shadow-[0_0_0_1px_rgba(255,255,255,0.9)]` | 1 | `ring-card` | ręcznie |

Zostają bez zmian: `text-white` na wypełnieniach (60), maile wychodzące i PDF, logowanie (§2.2), próbki kolorów zębów (`teeth-color-swatches.ts`, 47 hex — to fizyczne odcienie z wzornika; w ciemnym dostają tylko obwódkę `line-strong`, żeby jasne próbki nie zlewały się z białym tłem okna), `apple-icon` / ikona aplikacji.

### 4.3 Znalezione przy okazji (jasny motyw, dziś)

- Biały tekst na `emerald-600` (3.77:1) i na `amber-600` (3.19:1) — poprawia D5.
- `text-emerald-600` jako tekst (24 miejsca) ma 3.77:1 — poprawia codemod z §4.2.
- `text-slate-300` jako tekst (50 miejsc w 33 plikach, m.in. dni spoza miesiąca w kalendarzu urlopów): 1.58:1. Jeśli cyfra ma być czytelna → `slate-400`; jeśli to wypełniacz siatki → `aria-hidden` i zostaje. Do decyzji przy plasterku 6.
- `amber-500` jako jedyny sygnał na białym: 2.15:1 (kropki stanu). Poprawne, dopóki obok jest tekst; samotna kropka bez tekstu nie spełnia 1.4.11.

## 5. Przełącznik — interfejs

Pomysł użytkownika (pozioma pastylka Jasny / Ciemny / Systemowy) jest dobry i w tej aplikacji **już ma swoją formę**: `SegmentedControl` w Ustawienia → Wygląd, ten sam, co „Rozmiar czcionki”. Proponuję go przyjąć i dodać jedno szybkie wejście, bez wymyślania nowego komponentu.

**A. Ustawienia → Wygląd** (karta `AppearanceSettingsSection`, pierwszy wiersz, nad „Rozmiarem czcionki”):

```
Motyw                                   [ ☀ Jasny | ☾ Ciemny | ▭ Jak w systemie ]
Jak w systemie: zmienia się razem z ustawieniem komputera lub telefonu.
```

- `SegmentedControl` z `touchFriendly` (44 px na telefonie), ikona + etykieta; przy 375 px schodzi pod opis i zajmuje całą szerokość (trzy równe segmenty — sprawdzić, czy „Jak w systemie” mieści się bez ucinania przy `data-font-scale="xlarge"`; jeśli nie, tor przewija się w poziomie, jak każe DESIGN.md, etykiet nie ucinamy).
- Zmiana działa od razu (optymistycznie, jak rozmiar czcionki) i zapisuje się na koncie.
- Pod „Jak w systemie”, gdy jest wybrane: Meta z bieżącym wynikiem („Teraz: ciemny”), żeby było widać, co system podał.

**B. Szybkie wejście** — ten sam stan, ikony bez etykiet:

- desktop: w stopce menu bocznego, obok przycisku Ustawień (`Sidebar`), trójdzielny przełącznik z samych ikon; przy zwiniętym menu (4.25rem) jeden przycisk z ikoną bieżącego motywu, który otwiera menu z trzema pozycjami;
- telefon: w arkuszu „Więcej” (`MobileNavOverflowSheet`) wiersz „Motyw” z tym samym przełącznikiem (ikona + krótka etykieta, bo arkusz ma miejsce).
- Każdy segment z ikoną ma `aria-label` („Jasny motyw”, …) i widoczną nazwę w dymku; grupa `role="radiogroup"` przez `SegmentedControl`.

Dlaczego nie pojedynczy przycisk słońce/księżyc w nagłówku: przełącza tylko dwa stany, więc „Jak w systemie” znika albo chowa się za trzecim kliknięciem, którego nikt nie odkryje; do tego nagłówek telefonu ma już znak, „Co nowego” i „Wyloguj” w 3.5rem.

Ikony: `IconSun` jest w `StrokeIcons`; dopisać `IconMoon` i `IconMonitor` w tym samym stylu (obrys 2, siatka 24).

## 6. Zapis na koncie i brak mignięcia

**Gdzie:** `profiles.preferences.theme` ∈ `"light" | "dark" | "system"` — kolumna `preferences JSONB` już jest (migracja `102_user_preferences.sql`) i trzyma `font_scale` oraz `uniform_background`. **Migracja nie jest potrzebna.** Brak klucza = D2 (jasny).

**Ścieżka — wzór 1:1 z rozmiaru czcionki** (`FontScaleScript`, `FontScaleSync`, `actionSetFontScale`, `normalizeFontScale`):

| Element | Co robi |
|---|---|
| `src/lib/auth/theme.ts` | typ `ThemePreference`, `THEME_LABELS`, `normalizeTheme()` |
| `profile.ts` / `auth.ts` | `theme` w `ProfileRow` i w sesji (obok `fontScale`) |
| `actionSetTheme()` w `user-preferences.ts` | zapis do `preferences` (jak `actionSetFontScale`) **i** cookie `ontime_theme` (nie-httpOnly, `path=/`, `SameSite=Lax`, rok) |
| logowanie (`api/auth/login*`) | po udanym logowaniu ustawia `ontime_theme` z profilu — nowe urządzenie dostaje właściwy motyw już na pierwszej stronie po logowaniu |
| `ThemeScript` w `<head>` (obok `FontScaleScript`) | synchronicznie, przed pierwszym malowaniem: czyta cookie `ontime_theme`, potem `localStorage`; dla `system` pyta `matchMedia('(prefers-color-scheme: dark)')`; ustawia `data-theme` i `style.colorScheme` na `<html>` |
| `ThemeSync` w `AppShellClient` | gdy wartość z serwera różni się od tej ze skryptu (zmiana na innym urządzeniu), poprawia `<html>`, cookie i `localStorage`; dla `system` słucha zmian `matchMedia`; zdarzenie `storage` synchronizuje inne karty |
| przełączenie | na czas jednej klatki klasa `html.theme-switching` z `*{transition:none!important}` — bez tego wszystkie elementy z `transition-colors` przez 150–200 ms przechodzą z jasnego w ciemny (zmierzone: w podglądzie przegląd kolorów zaraz po przełączeniu czytał jeszcze jasne wartości) |
| `viewport.themeColor` w `layout.tsx` | dwie wartości z `media: (prefers-color-scheme: …)` plus aktualizacja `<meta name="theme-color">` przez `ThemeSync` — pasek przeglądarki na telefonie w kolorze nagłówka |

Dlaczego cookie, a nie tylko `localStorage` (jak przy czcionce): `localStorage` jest pusty na nowym urządzeniu i w nowej przeglądarce, więc pierwsza strona mignęłaby jasnym, zanim `ThemeSync` dostanie dane z serwera. Cookie ustawione przy logowaniu jest na miejscu przed pierwszym bajtem HTML. Serwer nie musi go czytać (root layout zostaje bez `cookies()`); czyta go skrypt.

Uwaga dla testów lokalnych: cookies `localhost` są wspólne dla wszystkich portów, więc zmiana motywu w jednej sesji dev przestawia ją we wszystkich (to samo zjawisko co z `ontime_admin_panel`).

## 7. Kolejność wdrożenia — cienkie plasterki

Po każdym: `tsc`, `lint`, pełne `vitest`, `npm run audit:design`, podgląd w przeglądarce (1280 i 375 px) w obu motywach. Każdy plasterek zostawia jasny motyw **piksel w piksel jak dziś** (poza D4/D5, gdy zatwierdzone), a ciemny jest dostępny tylko przez ręczne `data-theme` do plasterka 5.

| # | Plasterek | Kryteria akceptacji |
|---|---|---|
| 1 | **Tokeny i test kontrastu.** Blok `html[data-theme="dark"]` w `globals.css` (§3), tokeny semantyczne w `@theme inline` (§2.1), `.theme-light`, `@media print`, `--tw-ring-offset-color`. Test `audit-theme-contrast` czytający wartości z CSS. | Test liczy każdą parę z §3.3 i pada przy jednej parze pod progiem (sprawdzone celowo zepsutą wartością). Jasny bez zmian: porównanie zrzutów 5 ekranów przed/po = identyczne. |
| 2 | **Codemod powierzchni:** `bg-white*`, `ring-white`, `border-white`, `from-white`, gradient Kreatora → `card`; scrim. Reguła w `audit:design`: zakaz `bg-white`, `ring-white`, `bg-slate-900/N`. | 0 wystąpień w `src/` (audyt). `git diff --stat` ≈ liczby z §4.2 (± kilka). Jasny bez zmian wizualnie. |
| 3 | **Codemod kroku 600 i fokusu:** `text-{fam}-600` → 700, `ring/outline-indigo-600` → `focus`, baza fokusu na `var(--color-focus)`. Reguła w `audit:design`: zakaz `text-{indigo,emerald,amber,red}-600` (i aliasów). | Audyt 0. Fokus Tabem na przycisku, polu, chipie wybranym i wierszu tabeli: w ciemnym pierścień bez białej obwódki, ≥ 3:1 (zmierzone `getComputedStyle`). |
| 4 | **Ręczne miejsca:** wypełnienia 700+ (19 plików), `SUMMARY_COLORS` → zmienne, SVG z hexami, `BrandLoader`, `globals.css` (15 `rgb()`, błysk notatnika), `NoteColorPicker`, obwódka próbek zębów. | Lista z §4.2 odhaczona plik po pliku. `ColorLegend` i harmonogram lokalizacji czytelne w obu motywach (zrzut). |
| 5 | **Preferencja i przełącznik.** `theme.ts`, `actionSetTheme`, cookie przy logowaniu, `ThemeScript`, `ThemeSync`, `theme-switching`, `themeColor`; wiersz „Motyw” w Ustawieniach (§5 A). | Ustawienie przeżywa wylogowanie i logowanie w innej przeglądarce (cookie wyczyszczone ręcznie). **Brak mignięcia:** nagranie / seria zrzutów od nawigacji przy ciemnym motywie i twardym przeładowaniu: żadna klatka z jasnym tłem (sprawdzić też z dławieniem sieci „Slow 4G”). „Jak w systemie” podąża za zmianą emulowanego `prefers-color-scheme` bez przeładowania. Druga karta przełącza się sama. Test jednostkowy `normalizeTheme` i akcji (zapis nie gubi `font_scale`). |
| 6 | **Szybkie wejście** w menu bocznym i arkuszu „Więcej” (§5 B), ikony `IconMoon`, `IconMonitor`. Decyzja o `text-slate-300` (§4.3). | Przełączenie z menu bocznego zmienia też wiersz w Ustawieniach (jeden stan). 375 px: segmenty ≥ 44 px, bez ucinania etykiet przy `xlarge`. Etykiety dla czytnika obecne. |
| 7 | **Okna i powierzchnie unoszone:** `ModalShell`, `sidePanel*Class`, `TypeaheadDropdown`, popovery, toasty → `bg-raised` + ramka `line`; cienie ciemne. | Przy 375 px i 1280 px okno nad panelem bocznym odróżnia się od panelu (różne tło), `elementFromPoint` u góry i u dołu w nakładce. |
| 8 | **Przegląd modułów w ciemnym** (ekrany z §4.1 + nieobjęte: handlowiec przez konto testowe handlowca, Kreator ZD z policzoną listą, każdy panel boczny i okno z danymi, toasty, pusty stan, błąd, ładowanie). Ten sam przegląd `getComputedStyle` co w §4.1 przy wyłączonych przejściach + zrzut każdego ekranu. Aktualizacja DESIGN.md (sekcja „Motyw ciemny”, zasada „600 = wypełnienie”, zakaz `bg-white`, usunięcie zdania „Aplikacja ma tylko jasny motyw”). Decyzja D2 na nowo. | Każdy ekran: 0 jasnych teł poza sygnałami, 0 tekstu poniżej AA, 0 przewijania w poziomie przy 375 px. Lista ekranów z wynikiem w tym pliku. |

Plasterki 2–4 są niezależne od siebie, ale dotykają setek tych samych plików — robić po kolei, nie równolegle. Plasterek 5 może iść równolegle do 2–4 (inne pliki), gdyby był pośpiech; wtedy przełącznik ukryty flagą do końca 4.

## 8. Ryzyka

- **Nowy kod po wdrożeniu** wróci do `bg-white` i `text-indigo-600` z przyzwyczajenia — dlatego reguły w `audit:design` (krok CI) w plasterkach 2 i 3, nie tylko zapis w DESIGN.md.
- **Codemod a `tailwind-merge`:** `cn()` (`src/lib/cn.ts`) to `twMerge` bez własnej konfiguracji, który nieznaną nazwę po `bg-` / `text-` / `ring-` uznaje za kolor (DESIGN.md opisuje to przy rozmiarach tekstu). Nowe nazwy (`card`, `raised`, `primary`, `focus`, `scrim`, `inverse`) powinny więc łączyć się poprawnie (`cn("bg-card", "bg-indigo-50")` → zostaje ostatnia) — w plasterku 1 test na to, zanim codemod wejdzie.
- **Przeglądarka i dane spoza CSS:** treść maili w podglądzie, załączniki, zdjęcia produktów — zostają jasne w ramce `.theme-light`; to celowe.
- **Druk** z ciemnego motywu bez `@media print` wydrukowałby ciemne tła — w plasterku 1.

## Załącznik: jak powtórzyć pomiar

- Kontrast: skrypt w notatkach sesji (`contrast.mjs`) liczy wszystkie pary z §3.3 dla jasnego, jasnego po poprawkach i ciemnego; plasterek 1 robi z niego test w repo.
- Przegląd ekranów: wstrzyknięcie bloku zmiennych + `*{transition:none!important}` do działającej aplikacji, potem dla każdego widocznego elementu `getComputedStyle` (kolor tekstu wobec najbliższego nieprzezroczystego tła). Kolory w `oklab` (warianty z przezroczystością Tailwinda) przegląd pomija — w plasterku 8 policzyć je przez `canvas` albo przeliczyć `oklab → sRGB`.

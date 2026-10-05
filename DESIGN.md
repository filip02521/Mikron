---
name: OnTime
description: Prośby handlowców, harmonogram zakupów i realizacja dostaw — OnTime · Mikran
colors:
  petrol: "#0f7380"
  petrol-deep: "#0d5d67"
  petrol-pressed: "#0f4b53"
  petrol-tint: "#d4edef"
  petrol-mist: "#edf7f8"
  graphite: "#151920"
  graphite-soft: "#363c46"
  ink-secondary: "#4a515c"
  ink-muted: "#626a76"
  ink-faint: "#8b939f"
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
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.025em"
  overline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.04em"
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
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "1.75rem"
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
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.625rem 0.875rem"
    height: "2.5rem"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.panel}"
    padding: "1.75rem"
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
  segmented-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    padding: "0.375rem 0.75rem"
  table-header:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.overline}"
    padding: "0.875rem 1.25rem"
---

# Design System: OnTime

## Overview

**Creative North Star: "Pulpit dyspozytora"**

OnTime to stanowisko dyspozytora: spokojna, gęsta powierzchnia, na której wszystko jest pod ręką, a kolor pojawia się tylko tam, gdzie coś wymaga reakcji. Tło to chłodny grafit i jasne szarości. Na nim leżą białe karty z delikatnym cieniem, a jedyny akcent marki, Petrol, oznacza „tu działasz”: główną akcję, aktywną pozycję menu, zaznaczenie. Statusy mają osobny, stały słownik: zielony gotowe, bursztyn uwaga, czerwony błąd. Nie mieszają się z marką.

Gęstość jest zaletą. Tabele z setkami pozycji, liczby w kolumnach z cyframi o stałej szerokości i krótkie etykiety to normalna praca działu zakupów, magazynu i handlowców. Akcje są pewne i wyraźne: główny przycisk to pełny Petrol z jednoznacznym czasownikiem i liczbą („Zapisz 421 cen”). Nigdy nie konkuruje z drugim przyciskiem tej samej wagi.

Interfejs nie ma motywu ciemnego w aplikacji. Ciemny gradient marki należy wyłącznie do ekranów logowania.

**Key Characteristics:**
- Grafit i szarości, jeden akcent Petrol, statusy tylko zielony / bursztyn / czerwony.
- Białe karty na szarym płótnie, cienie miękkie i krótkie.
- Gęste tabele, cyfry tabelaryczne, nagłówki kolumn wersalikami.
- Główna akcja pełna i jednoznaczna, z liczbą w etykiecie.
- Geist w całym interfejsie, Geist Mono dla kodów i numerów katalogowych.

## Colors

Chłodna, niemal monochromatyczna paleta grafitu z jednym nasyconym akcentem i trzema kolorami stanów.

### Primary
- **Petrol** (#0f7380): kolor marki i jedynego „tu działasz”. Główne przyciski, aktywna pozycja menu (pasek z lewej i tło Petrol Tint), linki, zaznaczone checkboxy, pasek postępu, pierścień fokusu, hover wiersza tabeli (wewnętrzny pasek 3 px z lewej).
- **Petrol Deep** (#0d5d67): hover głównej akcji, kolor zaznaczonego tekstu.
- **Petrol Pressed** (#0f4b53): stan wciśnięcia głównej akcji.
- **Petrol Tint** (#d4edef) i **Petrol Mist** (#edf7f8): tła zaznaczenia (aktywny link, zaznaczenie tekstu, wybrany wiersz, komunikat informacyjny).

### Neutral
- **Grafit** (#151920): tekst główny, tytuły, wartości.
- **Grafit Miękki** (#363c46): tekst przycisków drugorzędnych.
- **Atrament Drugi** (#4a515c): tekst komórek tabel, opisy.
- **Atrament Przygaszony** (#626a76): nagłówki kolumn, podpisy, metadane.
- **Atrament Blady** (#8b939f): placeholdery, wartości zerowe, separatory tekstowe.
- **Linia Mocna** (#c9ced6), **Linia** (#e1e4e9), **Linia Miękka** (#eef0f3): obramowania kontrolek, kart i wierszy tabel, od najmocniejszej.
- **Studnia** (#f6f7f9): tło nagłówka tabeli, hover wiersza, tor przełącznika segmentowego.
- **Płótno** (#f3f5f7): tło aplikacji pod kartami.
- **Karta** (#ffffff): powierzchnie treści, menu boczne.

### Status
- **Gotowe** (#ecfdf5 tło / #065f46 tekst): zapisane, zrealizowane, zgodne.
- **Uwaga** (#fffbeb tło / #f59e0b sygnał / #78350f tekst): zaległe, do przejrzenia, tryb podglądu (pasek 3 px u góry ekranu).
- **Błąd** (#fef2f2 tło / #dc2626 przycisk / #b91c1c tekst): błąd zapisu, rozbieżność, akcja nieodwracalna na produkcji.

### Named Rules
**The One Accent Rule.** Petrol jest jedynym kolorem marki. Pozostałe rodziny barw Tailwinda (indigo, violet, blue, cyan, sky) są w `globals.css` przemapowane na Petrol lub grafit, dlatego nowa klasa `indigo-600` to nadal Petrol. Nie dodawaj drugiego akcentu.

**The Status Is Not Brand Rule.** Zielony, bursztyn i czerwony znaczą wyłącznie stan (gotowe, uwaga, błąd). Nigdy nie służą jako dekoracja ani akcent sekcji.

## Typography

**Display Font:** Geist (z ui-sans-serif, system-ui)
**Body Font:** Geist
**Label/Mono Font:** Geist Mono (numery katalogowe, symbole, kody)

**Character:** Jedna rzeczowa rodzina bezszeryfowa w całym produkcie. Hierarchię budują waga i rozmiar, nie zmiana kroju.

### Hierarchy
- **Headline** (600, 1.5rem na telefonie / 1.75rem od sm, 1.25, tracking -0.025em): tytuł strony w nagłówku.
- **Title** (600, 1.125rem / 1.25rem od lg, tracking -0.025em): tytuł karty i sekcji. Wariant zwarty: 1rem, a w chrome Kreatora 13px.
- **Body** (400, 0.9375rem, 1.55): tekst aplikacji, opisy, komunikaty.
- **Body Dense** (400, 0.875rem, 1.45): komórki tabel, podpowiedzi pod polami.
- **Label** (600, 0.75rem, tracking 0.025em): etykiety pól formularza.
- **Overline** (600, 0.75rem, tracking 0.04em, wersaliki): nagłówki kolumn tabel. Nagłówki grup menu: 10px, 700, tracking 0.12em.
- **Code** (Geist Mono, 0.75rem): numery katalogowe i symbole w tabelach.

Skala tekstu reaguje na ustawienie użytkownika: `html[data-font-scale]` podnosi bazę z 16px do 17.6px lub 20px, a cały układ skaluje się w rem.

### Named Rules
**The Tabular Numbers Rule.** Każda kolumna z kwotami, ilościami lub procentami używa cyfr o stałej szerokości (`tabular-nums`), żeby liczby dało się porównywać w pionie.

## Layout

Szkielet to menu boczne o szerokości 16rem (zwijane do paska ikon 4.25rem) i główna kolumna na szarym płótnie. Na telefonie menu zastępuje dolny pasek z czterema pozycjami i „Więcej”.

Szerokość treści zależy od rodzaju ekranu. Panele pracy dziennej mają wąską kolumnę (max 48rem, szerszą na 2xl). Ekrany administracyjne i zakupowe mają kolumnę 56rem, a od xl do 2xl 64–72rem. Kreator ZD wykorzystuje całą szerokość. Wewnętrzny margines strony to 0.75rem na telefonie i 1.25rem od lg. Sekcje układają się w stos z odstępem 1rem, a karta ma padding 1.5rem (1.75rem od sm).

Tabele mają minimalną szerokość 640px i na wąskich ekranach przewijają się w poziomie wewnątrz karty. Strona nigdy nie przewija się w poziomie. Przełączniki z wieloma opcjami też przewijają się w poziomie, nie ucinają etykiet.

## Elevation & Depth

Głębia jest warstwowa i cicha: szare płótno, na nim białe karty z dwuwarstwowym cieniem, który ledwie odrywa kartę od tła. Elementy pływające (modale, menu, sticky pasek wyszukiwania) dostają mocniejszy, ale nadal miękki cień. Sticky chrome ma półprzezroczyste tło karty z lekkim rozmyciem, żeby przewijana treść była czytelna pod spodem.

### Shadow Vocabulary
- **Karta** (`box-shadow: 0 1px 2px rgba(21,25,32,.05), 0 6px 20px -8px rgba(21,25,32,.12)`): karty treści, modale.
- **Spoczynek** (`box-shadow: 0 1px 2px rgba(21,25,32,.06)`): drobne kontrolki, aktywny segment.
- **Uniesienie** (`box-shadow: 0 4px 14px -4px rgba(21,25,32,.1)`): elementy pływające.
- **Marka** (`box-shadow: 0 4px 14px -6px rgba(15,115,128,.25)`): tylko kafel ikony marki.

### Named Rules
**The Quiet Lift Rule.** Cień zawsze ma przesunięcie i miękkie rozmycie, a jego krycie nie przekracza 0.12. Nie używaj kolorowych poświat ani twardych cieni bez rozmycia.

## Shapes

Lekko zaokrąglone, prostokątne formy. Kontrolki (przyciski, pola, odznaki, segmenty) mają promień 6px, powierzchnie zagnieżdżone 8px, a karty paneli 10px. Pełne zaokrąglenie (pill) mają tylko liczniki w menu i paski postępu. Obramowania są jednopikselowe w tonach Linii. Kolorowe obramowanie z boku karty pojawia się wyłącznie jako 3-pikselowy pasek aktywnej pozycji menu albo wiersza tabeli.

## Components

Komponenty są pewne i wyraźne: jedna oczywista główna akcja na ekran, czytelne stany i żadnych ozdobników.

### Buttons
- **Shape:** zaokrąglenie kontrolki (6px). Rozmiary: sm (0.375rem 0.625rem, 12px), md (0.5rem 1rem, 14px), lg (0.625rem 1.25rem, 16px).
- **Primary:** pełny Petrol, biały tekst, delikatny cień spoczynku. Etykieta to czasownik, często z liczbą („Zapisz 421 cen”).
- **Hover / Focus:** hover Petrol Deep, wciśnięcie Petrol Pressed. Fokus to obrys 2px Petrol z odstępem 2px. Wyłączony przycisk ma krycie 50% i kursor zakazu.
- **Secondary:** biała karta z obramowaniem Linia i tekstem Grafit Miękki; hover jaśniejszym tłem Studni.
- **Ghost:** bez tła, tekst Atrament Drugi; hover tłem Linii Miękkiej.
- **Danger:** pełny czerwony. Zarezerwowany dla akcji nieodwracalnych i zapisu na produkcji (LIVE).

### Chips
- **Style:** odznaki statusu (Badge), płaskie tło bez obramowania, 12px średnia waga. Kolor ma tylko znaczenie stanu: neutralny, zielony, bursztyn, Petrol (informacja), czerwony.
- **State:** odznaki nie są klikalne; filtrowanie robi przełącznik segmentowy.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** Karta (#ffffff) na Płótnie.
- **Shadow Strategy:** cień Karty (patrz Elevation & Depth).
- **Border:** 1px Linia.
- **Internal Padding:** 1.5rem, od sm 1.75rem. Karty z tabelą mają padding 0, a tabela dochodzi do krawędzi.

### Inputs / Fields
- **Style:** białe tło, obramowanie Linia, promień 6px, minimalna wysokość 44px na telefonie i 40px od sm, tekst 16px na telefonie (bez auto-zoomu) i 14px od sm.
- **Focus:** obramowanie Petrol i miękki pierścień.
- **Error / Disabled:** stany ostrzeżenia i błędu barwią obramowanie i tło (bursztyn, czerwony), a komunikat pod polem przyjmuje ten sam ton. Wyłączone pole ma tło Studni.

### Navigation
- **Menu boczne:** białe na szarym płótnie, grupy z nagłówkiem 10px wersalikami. Aktywna pozycja ma tło Petrol Tint i 3-pikselowy pasek Petrol z lewej. Liczniki to pigułki w dwóch poziomach (neutralny i uwaga).
- **Telefon:** dolny pasek z 4 pozycjami i „Więcej”, aktywna zakładka w tym samym języku co menu boczne.

### Data Table
Sygnaturowy komponent produktu. Nagłówek ma tło Studni i wersaliki 12px z rozstrzeleniem 0.04em. Komórki mają padding 1rem 1.25rem (1.5rem przy krawędziach) i tekst Atrament Drugi 14px. Hover wiersza zmienia tło na Studnię i dodaje wewnętrzny pasek Petrol z lewej. Zmiana wartości pokazuje starą wartość przekreśloną i nową pogrubioną z procentem zmiany, a duże zmiany są w bursztynie.

### Segmented Control
Przełącznik widoków: tor ze Studni z obramowaniem, aktywny segment na białej karcie z cieniem spoczynku. Liczniki w etykiecie są przygaszone. Przy wielu opcjach tor przewija się w poziomie, etykiety nie są ucinane.

### Status Panel
Karta „co teraz” na górze ekranu pracy. Pogrubione zdanie stanu z liczbą („421 cen do zapisu”), jedno zdanie wyjaśnienia i główna akcja po prawej. Na telefonie akcja schodzi pod tekst.

## Do's and Don'ts

### Do:
- **Do** używaj Petrol (#0f7380) tylko do akcji, zaznaczenia i fokusu, a nowe ekrany buduj na tokenach z `globals.css` i klasach z `ontime-theme.ts`.
- **Do** dawaj jedną pełną główną akcję na ekran, z czasownikiem i liczbą w etykiecie.
- **Do** stosuj `tabular-nums` w każdej kolumnie liczb i Geist Mono dla numerów katalogowych.
- **Do** pokazuj stan pracy zdaniem („433 pozycje czekają na Twoją decyzję”) z poprawną polską odmianą liczebników.
- **Do** przewijaj szerokie tabele i przełączniki w poziomie wewnątrz karty. Strona ma zawsze szerokość ekranu.

### Don't:
- **Don't** dodawaj drugiego koloru akcentu ani nie używaj zieleni, bursztynu i czerwieni jako dekoracji.
- **Don't** przenoś ciemnego gradientu logowania do aplikacji.
- **Don't** dawaj cieni z kryciem powyżej 0.12, kolorowych poświat ani twardych cieni bez rozmycia.
- **Don't** buduj ekranu pracy z rzędu kafelków z liczbami, jeśli te same liczby są już w zakładkach lub tabeli.
- **Don't** ucinaj etykiet przełączników ani przycisków wielokropkiem.

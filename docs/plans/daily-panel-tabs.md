# Plan: zakładki panelu dziennego (P2)

**Status:** wdrożone (MVP) — `?view=dzis|tydzien|narzedzia`, legacy `#plan` → tydzień.

## Cel

Zmniejszyć scroll i rozproszenie uwagi przez podział `/podsumowanie` na **3 widoki** z jednym backendem (`fetchSummaryWorkspace`), bez utraty funkcji z toolbaru.

## Proponowane zakładki

| Zakładka | Zawartość | URL (propozycja) |
|----------|-----------|------------------|
| **Dziś** | Weryfikacja (banner), rezygnacje, kolejka: zaległe → prośby → na dziś | `/podsumowanie` lub `?view=dzis` |
| **Tydzień** | Plan bieżący + następny, dostawcy na żądanie (skrót) | `?view=tydzien` |
| **Narzędzia** | Wyszukiwarka, sync terminów, urlopy, nowa prośba, ukryci dostawcy | `?view=narzedzia` |

## Zasady UX

1. **Stan zakładki w URL** (`searchParams`) — odświeżenie i link do sekcji zachowują widok.
2. **Toolbar wspólny, kontekstowy** — na „Dziś” metryki i postęp dnia; na „Tydzień” liczba kart w planie; na „Narzędzia” akcje administracyjne.
3. **Nawigacja** — zastąpić obecne `#dzis` / `#plan` segmented control u góry karty (sticky), bez duplikatu anchorów.
4. **Deep linki** — stare `#plan` przekierować na `?view=tydzien`; `#dzis` → domyślna zakładka.
5. **Mobilka** — zakładki jako poziomy scroll chipów (jak w aplikacjach bankowych), nie trzy pełne strony w DOM naraz.

## Architektura kodu (szkic)

```
SummaryWorkspace
├── DailyPanelTabs (client, URL sync)
├── DailyPanelToolbar (props: activeView)
└── view === 'dzis'  → DailyTodayView (obecna sekcja „Do obsługi”)
    view === 'tydzien' → DailyWeekView (WeekPlanner ×2, on-demand)
    view === 'narzedzia' → DailyToolsView (search, sync, hidden suppliers)
```

- Wydzielić `DailyTodayView`, `DailyWeekView`, `DailyToolsView` z obecnego `SummaryWorkspace.tsx` (~450 linii → 4 pliki).
- **Nie** duplikować `useDailyPanelRunner` — jeden provider na poziomie workspace (opcjonalnie `DailyPanelContext`).
- Modale (szuflada, urlop, edycja, weryfikacja) zostają na poziomie workspace — dostępne z każdej zakładki.

## Migracja danych / API

- Brak zmian w API — tylko podział renderowania.
- `useDailyDayProgress` i baseline sessionStorage bez zmian.

## Ryzyka

| Ryzyko | Mitigacja |
|--------|-----------|
| Użytkownicy przyzwyczajeni do scrolla jednej strony | Domyślnie „Dziś”; krótki onboarding w `PanelDailyHelp` |
| Utrata widoku „wszystko naraz” | Opcjonalny tryb „Pełny widok” w ustawieniach (faza 2) |
| Regresja skrótów klawiszowych (`/`, `Z` w szufladzie) | Testy e2e / checklist QA |

## Kryteria akceptacji (gdy wdrażamy)

- [ ] Przełączenie zakładki bez pełnego przeładowania strony (client navigation).
- [ ] Postęp dnia widoczny na zakładce „Dziś”.
- [ ] Plan tygodnia i tryb planowania tylko na „Tydzień”.
- [ ] „Przelicz terminy” i wyszukiwarka na „Narzędzia” (lub sticky mini-toolbar na wszystkich — do decyzji w review).
- [ ] Build + istniejące testy `daily-*-progress` zielone.

## Kolejność implementacji (szacunek)

1. `DailyPanelTabs` + URL (`?view=`)
2. Wydzielenie `DailyTodayView` (najmniejsze ryzyko)
3. `DailyWeekView`
4. `DailyToolsView` + przeniesienie toolbaru
5. Help, deep linki, QA mobilne

**Szacowany nakład:** 1–2 dni dev + pół dnia QA z zespołem zakupów.

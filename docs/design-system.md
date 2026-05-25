# OnTime — design system (skrót)

Paleta nawiązuje do ekranu logowania: **indigo + sky** na jasnym tle. Ciemny gradient (`indigo-800 → sky-900 → slate-950`) zostaje **tylko na auth**.

## Tokeny CSS (`globals.css`)

| Token | Użycie |
|-------|--------|
| `--brand-indigo`, `--brand-sky` | Marka, focus, akcenty |
| `--primary`, `--primary-muted` | Przyciski, zaznaczenie tekstu |
| `--shadow-card-elevated` | Karty, modale (jak karta logowania) |
| `--shadow-brand` | Logo gradientowe |

Tło aplikacji: subtelny gradient na `body` (fixed), bez ciężkich animacji.

## Klasy (`ontime-theme.ts`)

- `brandMarkAppClass` — logo w sidebarze (gradient)
- `navLinkActiveClass` — aktywna nawigacja: indigo + pasek sky po lewej
- `buttonPrimaryClass` — lekki gradient na primary
- `surfaceCardClass` — karty sekcji

## Zasady

1. **Semantyka statusów** (amber zaległe, red błąd, emerald sukces) — bez zmian pod markę.
2. **Gradient** — logo, primary button, pas w sidebarze, tło strony; nie na całych tabelach.
3. Nowe ekrany — preferuj tokeny CSS i `ontime-theme`, nie losowe `indigo-600`.

## Panel dzienny (Faza 4)

- Pas marki u góry karty panelu + ikona gradient
- Postęp dnia: gradient na segmentach + procent, cień karty
- Zakładki: `panelStickyTabsClass`
- Baner weryfikacji: `--shadow-card-elevated` (kolor amber bez zmian)
- Sekcje / kafelki metryk: spójne cienie i delikatne tło indigo→sky

## Faza 5 — tokeny operacyjne

W `ontime-theme.ts`: linki (`brandLinkClass`), checkboxy, zakładki, plan tygodnia, filtry „Moje”, karty wyróżnione.

Zaktualizowane obszary: `summary/` (panel, plan, prośby), `queue/`, `moje/`, kafelki ikon w `StrokeIcons`.

Semantyka bez zmian: amber (zaległe), emerald (sukces), sky (informacja magazyn), violet (informacja handlowca).

## Mobile handlowca

- `MobileSalesHeader` — pas marki, cień jak karty
- `MobileSalesNav` — aktywna zakładka: pasek gradient u góry, badge w kolorze marki
- `SalesUpdatesBanner` — delikatne tło indigo→sky, przycisk primary

## Kolejne kroki (opcjonalnie)

- Pozostałe moduły (`orders/`, `admin/`) przy okazji edycji

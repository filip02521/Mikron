# OnTime — blueprint technologiczny i UI

Dokument dla modelu AI (lub zespołu), który ma zbudować **podobny projekt wizualnie i technicznie**, ale w **innej dziedzinie biznesowej**. Opisuje wzorce, nie logikę domenową (dostawcy, magazyn itd.).

Szczegóły palety: [design-system.md](./design-system.md). Stos ogólny: [README.md](../README.md).

---

## 1. Stos technologiczny (rdzeń)

| Warstwa | Technologia | Wersja / uwagi |
|---------|-------------|----------------|
| Framework | **Next.js** (App Router) | 16.x — RSC, Server Actions, `loading.tsx` |
| UI runtime | **React** | 19.x |
| Język | **TypeScript** | strict |
| Node | **Node.js** | ≥ 20.9 (prod: 24 LTS, `.nvmrc`) |
| Stylowanie | **Tailwind CSS** v4 | `@import "tailwindcss"` w `globals.css`, `@theme inline` |
| PostCSS | `@tailwindcss/postcss` | `postcss.config.mjs` |
| Merge klas | **tailwind-merge** | helper `cn()` w `src/lib/cn.ts` |
| Walidacja | **Zod** | formularze, API, env |
| Daty | **date-fns** | strefa `Europe/Warsaw` w logice biznesowej |
| Baza + auth | **Supabase** | PostgreSQL, Auth, RLS, `@supabase/ssr` |
| E-mail | **Resend** | opcjonalnie |
| Testy jednostkowe | **Vitest** + happy-dom | logika w `src/lib/` |
| Testy E2E | **Playwright** | Chromium |
| Deploy (LAN) | Windows NSSM + nginx reverse proxy | `installer/` |

**Czego nie ma:** shadcn/ui, Radix, MUI, Chakra, styled-components, CSS Modules jako główny system. UI jest **własne, lekkie komponenty** + tokeny w `ontime-theme.ts`.

---

## 2. Tożsamość wizualna (marka)

### Paleta

- **Marka:** indigo + sky na jasnym tle (`#4f46e5`, `#0284c7`).
- **Tło aplikacji:** jasny szary + subtelny gradient `slate → sky` (fixed na `body`).
- **Auth (login, reset hasła):** ciemny gradient `indigo-800 → sky-900 → slate-950` — **tylko ekrany logowania**, nie cała aplikacja.
- **Karty:** białe (`--card`), obramowanie `slate-200/80`, cień `--shadow-card-elevated`.

### Zasady wizualne

1. **Gradient** — logo, przycisk primary, pasek marki; nie na całych tabelach ani aktywnych linkach menu.
2. **Semantyka kolorów** (nie zmieniać pod markę):
   - `amber` / `orange` — zaległe, ostrzeżenie
   - `red` — błąd, niebezpieczna akcja
   - `emerald` — sukces, potwierdzenie
   - `sky` — informacja operacyjna (np. magazyn)
   - `violet` — informacja dla innej roli (np. handlowiec)
   - `indigo` — marka, nawigacja primary
3. **Zaokrąglenia:** małe (`rounded-md`, `--radius` 6px) — profesjonalny B2B, nie „bubble UI”.
4. **Cienie:** delikatne, wielowarstwowe na kartach (`--shadow-card-elevated`).

### Typografia

- **Font:** [Geist Sans](https://vercel.com/font) + Geist Mono (`next/font/google` w `layout.tsx`).
- **Rozmiar bazowy:** `15px` (`0.9375rem`), `line-height: 1.55`.
- **Nagłówki stron:** `font-semibold`, `tracking-tight`, `text-slate-900`.
- **Etykiety sekcji:** `text-[11px] uppercase tracking-wide text-slate-500`.

---

## 3. Tokeny CSS (`src/app/globals.css`)

Skopiuj strukturę `:root` i dostosuj hex marki:

```css
:root {
  --brand-indigo: #4f46e5;
  --brand-sky: #0284c7;
  --background: #f4f6f9;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-border: #e2e8f0;
  --primary: var(--brand-indigo);
  --primary-muted: #eef2ff;
  --shadow-card-elevated: 0 1px 2px ..., 0 8px 24px -8px ...;
  --shadow-brand: 0 4px 14px -6px rgba(79, 70, 229, 0.12);
}
```

W nowym projekcie zmień nazwy prefiksów (`--brand-*`) i ewentualnie odcień, ale **zachowaj** rozdzielenie: tokeny CSS → `@theme` → klasy w `*-theme.ts`.

---

## 4. Warstwa motywu (`src/lib/ui/ontime-theme.ts`)

Centralny plik klas Tailwind (nie komponentów). W nowym projekcie nazwij np. `app-theme.ts`.

### Kluczowe eksporty do odtworzenia

| Klasa / funkcja | Rola |
|-----------------|------|
| `appShellClass`, `appMainClass`, `appMainInsetClass` | Shell aplikacji |
| `sidebarShellClass`, `navLinkActiveClass`, `sidebarNavToneActiveClass(tone)` | Sidebar desktop |
| `surfaceCardClass` | Karty sekcji |
| `buttonPrimaryClass` | Gradient primary |
| `brandMarkAppClass`, `brandIconTileClass` | Logo / ikona sekcji |
| `panelStickyChromeClass` | Sticky nagłówek zakładek |
| `panelWorkspaceShellClass` | Wąska kolumna operacji (`max-w-3xl`) |
| `salesWorkspaceShellClass`, `salesTeamShellClass` | Widoki użytkownika końcowego |
| `adminPageShellClass` | Szersze tabele admina |
| `mobileSalesNavClass`, `mobileNavLinkActiveClass` | Dolny pasek mobile |
| `systemNoticeTourClass`, `systemNoticeActionClass` | Banery systemowe |
| `roleBadgeClass(role)` | Plakietki ról |

**Wzorzec:** zamiast losowych `indigo-600` w komponentach — import z `*-theme.ts` lub tokenów CSS `var(--primary)`.

---

## 5. Biblioteka komponentów UI (`src/components/ui/`)

Lekkie prymitywy — buduj ekrany z nich, nie z biblioteki zewnętrznej.

| Komponent | Zastosowanie |
|-----------|--------------|
| `Button` | `primary` \| `secondary` \| `outline` \| `ghost` \| `danger`; rozmiary `sm` \| `md` \| `lg` |
| `Field`, `Input` | Formularze z etykietą i błędem |
| `Card` | Obudowa sekcji |
| `Badge` | Statusy, liczniki |
| `Alert` | Błędy inline |
| `SystemNotice` | Banery: `pinned`, `action`, `tour` |
| `ModalShell`, `ConfirmDialog` | Modale |
| `EmptyState` | Puste listy z CTA |
| `PageHeader` | Tytuł + akcje strony |
| `SectionTabNav`, `SegmentedControl` | Zakładki |
| `DataTable` | Tabele z nagłówkami |
| `Toast`, `UndoToast` | Powiadomienia + cofnięcie |
| `Spinner`, `ActionLoadingOverlay` | Ładowanie |
| `HelpBlock`, `HelpPopover` | Pomoc kontekstowa |
| `TypeaheadDropdown` | Wyszukiwanie z listą |
| `OverflowMenu` | Menu „⋯” |
| `AppBrandMark` | Logo zegar OnTime |
| `Kbd` | Skróty klawiszowe |

**Button primary** używa `buttonPrimaryClass` z motywu — jeden punkt zmiany gradientu.

---

## 6. Ikony

- **Własne SVG** w `src/components/icons/StrokeIcons.tsx` — styl **stroke** (Lucide-like), `strokeWidth={2}`, `viewBox="0 0 24 24"`.
- Brak paczki `lucide-react` — ikony są inline dla kontroli rozmiaru i spójności.
- Kafelki sekcji: `sectionIconTileBrandClass` (gradient) lub wariant soft.

W nowym projekcie: skopiuj wzorzec `Svg` + eksporty nazwane; dodawaj ikony per domena.

---

## 7. Layout aplikacji

### Desktop

```
┌─────────────┬──────────────────────────────────┐
│  Sidebar    │  Main (scroll)                   │
│  (fixed)    │  - banery (preview, tour, sync)  │
│             │  - treść strony (max-width shell) │
└─────────────┴──────────────────────────────────┘
```

- `AppShell` (server) → `AppShellClient` (client): role, preview admina, onboarding.
- `Sidebar.tsx` — grupy nawigacji, badge liczników, tony semantyczne (`NavTone`).
- Treść: `appMainInsetClass` = `px-3 py-5 sm:px-4 lg:px-5`.

### Mobile

- **Handlowiec:** `MobileSalesHeader` + treść + `MobileSalesNav` (4 zakładki + „Więcej”).
- **Operacje (zakupy/magazyn):** `MobileOperationsHeader` + `MobileOperationsNav`.
- Aktywna zakładka = ten sam język co aktywny link sidebara (biała karta + ring).
- `min-h-11` na dotyk (44px).

### Auth

- Bez sidebara (`isAuthLayoutPath`) — pełny ekran gradient + karta (`BrandMomentLayout`).
- Po logowaniu: krótki ekran `auth/entering` (spinner marki).

---

## 8. Wzorce ekranów (do sklonowania koncepcyjnie)

| Wzorzec | Przykład w OnTime | Elementy |
|---------|-------------------|----------|
| **Panel operacyjny** | `/podsumowanie` | sticky tabs, pasek postępu, sekcje w kartach, footer akcji |
| **Kolejka / inbox** | `/kolejka`, `/weryfikacja` | tabela, filtry chip, selection bar |
| **Lista użytkownika** | `/moje` | wiersze rozwijane, akcje inline, empty guide |
| **Formularz prośby** | `/prosba` | sekcje `ProsbaFormSection`, meta strip, toolbar |
| **Hub admina** | `/admin/*` | szersza kolumna, `adminHubBodyClass`, tabele |
| **Tablica / feed** | `/tablica` | karty wątków, pinned strip |
| **Plan / kalendarz** | `/plan` | siatka tygodnia `weekPlannerGridClass` |

Każdy ekran: `page.tsx` (server, dane) + `*Client.tsx` (interakcja) + opcjonalnie `loading.tsx` (skeleton).

---

## 9. Architektura kodu (poza UI)

```
src/
  app/              # trasy Next.js (App Router)
  components/
    ui/             # prymitywy
    layout/         # shell, sidebar, mobile nav
    icons/          # SVG
    [domena]/       # ekrany biznesowe
  lib/
    ui/             # ontime-theme.ts, brand.ts
    auth/           # sesja, role, login flow
    data/           # zapytania Supabase
    [domena]/       # logika biznesowa (bez React)
  types/            # typy DB
```

- **Server Components** domyślnie; `"use client"` tylko przy stanie, eventach, hookach.
- **Server Actions** w `src/app/actions/` — mutacje z rewalidacją.
- **Logika biznesowa** w `src/lib/` — testowalna przez Vitest bez DOM.

---

## 10. Auth i role (szkielet)

- Supabase Auth + tabela `profiles` (rola, `sales_person_id`, flagi onboardingu).
- Role: `admin`, `zakupy`, `magazyn`, `sales`, `sales_manager` — nawigacja filtrowana po roli.
- `DEV_ADMIN_MODE` tylko dev — nie na produkcji.
- Ciasteczka sesji: `src/lib/supabase/cookie-options.ts` — `Secure` przy HTTPS.
- `NEXT_PUBLIC_APP_URL` = dokładny URL w przeglądarce (krytyczne za nginx).

---

## 11. UX — powtarzalne zachowania

- **Undo toast** — cofnięcie akcji przez ~10 s (`UndoToast`).
- **Keyboard shortcuts** — `KeyboardShortcutsHint`, `Kbd`.
- **Onboarding tour** — panel boczny + `SystemNotice variant="tour"` + blokada nawigacji.
- **Empty states** — ilustracja tekstowa + przycisk CTA, nie pusta tabela.
- **Loading** — `loading.tsx` per route, `PanelRouteLoading`, `Spinner`.
- **Pomoc** — `HelpPopover` / `HelpBlock` przy złożonych panelach.
- **Sync strip** — delikatny pasek „odświeżono / synchronizuj”.

---

## 12. Checklist: nowy projekt „jak OnTime”

### Faza 1 — szkielet (dzień 1)

- [ ] `create-next-app` + TypeScript + Tailwind v4 + App Router
- [ ] Skopiuj strukturę `globals.css` (tokeny + gradient body)
- [ ] `cn.ts` + `app-theme.ts` (na bazie `ontime-theme.ts`)
- [ ] `Button`, `Field`, `Card`, `PageHeader`, `SystemNotice`
- [ ] `layout.tsx` z Geist + `AppShell` (sidebar + main)
- [ ] Ekran logowania w stylu `BrandMomentLayout`

### Faza 2 — nawigacja

- [ ] Sidebar z grupami i `NavTone`
- [ ] Mobile bottom nav (4 + overflow)
- [ ] `roleBadgeClass` i filtrowanie menu po roli

### Faza 3 — domena

- [ ] Supabase schema + RLS
- [ ] 1 panel operacyjny (sticky tabs + karty)
- [ ] 1 lista użytkownika + 1 formularz
- [ ] Empty states + loading routes

### Faza 4 — produkcja

- [ ] `.env` + `setup-check`
- [ ] `installer/install-windows-service.ps1` lub odpowiednik
- [ ] nginx → port 3000

---

## 13. Co skopiować dosłownie vs co zmienić

| Skopiuj | Zmień pod nową domenę |
|---------|-------------------------|
| `globals.css` tokeny (kolory marki) | Nazwa produktu, hex marki |
| `ontime-theme.ts` struktura klas | Nazwa pliku, `max-width` shelli |
| `components/ui/*` | Teksty, warianty jeśli potrzeba |
| `cn.ts`, layout shell | Pozycje menu, ikony |
| Wzorzec RSC + Client + Actions | Tabele, endpointy, reguły biznesowe |
| `StrokeIcons` wzorzec | Ikony semantyczne domeny |
| Installer Windows | Hostname, port, repo git |

---

## 14. Prompt startowy dla modelu AI

Możesz wkleić do nowego czatu:

```
Zbuduj aplikację webową B2B w stylu projektu OnTime (docs/stack-and-ui-blueprint.md):

- Next.js 16 App Router, React 19, TypeScript, Tailwind v4
- Paleta: indigo + sky, jasne tło, ciemny gradient tylko na login
- Własne lekkie komponenty UI (Button, Card, SystemNotice…) — bez shadcn/MUI
- Tokeny CSS w globals.css + centralny plik app-theme.ts z klasami Tailwind
- Layout: sidebar desktop + dolny pasek mobile, max-w-3xl na panele operacyjne
- Ikony: własne SVG stroke w jednym pliku
- Supabase auth + role w profiles
- Semantyka kolorów: amber=zaległe, emerald=sukces, violet/sky=informacja

Domena: [OPIS NOWEJ DZIEDZINY]
Główne ekrany: [LISTA]
Role użytkowników: [LISTA]
```

---

## 15. Pliki referencyjne (najważniejsze)

| Plik | Po co |
|------|--------|
| `src/app/globals.css` | Tokeny, tło, typografia |
| `src/lib/ui/ontime-theme.ts` | Wszystkie klasy powtarzalne |
| `docs/design-system.md` | Skrót palety i faz UI |
| `src/components/ui/Button.tsx` | Wzorzec wariantów |
| `src/components/layout/AppShellClient.tsx` | Shell + mobile |
| `src/components/layout/Sidebar.tsx` | Nawigacja desktop |
| `src/components/brand/BrandMomentLayout.tsx` | Auth / 404 |
| `src/components/icons/StrokeIcons.tsx` | Ikony |
| `src/app/layout.tsx` | Fonty, metadata |

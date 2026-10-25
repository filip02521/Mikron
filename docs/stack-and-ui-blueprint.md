# OnTime — blueprint technologiczny i UI

Dokument dla modelu AI (lub zespołu), który ma zbudować **podobny projekt wizualnie i technicznie**, ale w **innej dziedzinie biznesowej**. Opisuje wzorce, nie logikę domenową (dostawcy, magazyn itd.).

Zasady wizualne (paleta, typografia, komponenty, układ ekranu, ładowanie, ikony, ruch): [DESIGN.md](../DESIGN.md) — jedyne źródło, tu ich nie powtarzamy. Użytkownicy i cel produktu: [PRODUCT.md](../PRODUCT.md). Stos ogólny: [README.md](../README.md).

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
| Daty | **date-fns** | strefa `Europe/Warsaw` w logice biznesowej |
| Baza | **PostgreSQL 16** | `pg` (node-postgres) w `src/lib/db/`; klient w stylu PostgREST (`from().select()`) to własna warstwa `src/lib/db/query-builder.ts`; schemat Drizzle w `src/lib/db/schema.ts` częściowy |
| Auth | **lokalna** | `app_users` / `app_sessions`, cookie `ontime_session` (`src/lib/auth-local/`); RLS wyłączone, autoryzacja w kodzie aplikacji |
| E-mail | **Amazon SES SMTP** | `nodemailer`, opcjonalnie (`SMTP_*`) |
| Testy jednostkowe | **Vitest** + happy-dom | logika w `src/lib/` |
| Testy E2E | **Playwright** | Chromium |
| Deploy (LAN) | Windows NSSM + nginx reverse proxy | `installer/` |

**Czego nie ma:** shadcn/ui, Radix, MUI, Chakra, styled-components, CSS Modules jako główny system, Supabase. UI to **własne, lekkie komponenty** + klasy w `src/lib/ui/ontime-theme.ts`.

---

## 2. Interfejs — gdzie co jest w kodzie

Reguły: [DESIGN.md](../DESIGN.md). Tu tylko mapa plików do odtworzenia w nowym projekcie.

| Warstwa | Plik / katalog | Uwagi |
|---------|----------------|-------|
| Tokeny CSS | `src/app/globals.css` | `:root` → `@theme` → klasy; palety Tailwinda przemapowane na jeden akcent |
| Klasy motywu | `src/lib/ui/ontime-theme.ts` | w nowym projekcie np. `app-theme.ts`; zamiast surowych kolorów w komponentach — import stąd albo `var(--primary)` |
| Prymitywy | `src/components/ui/` | `Button`, `Field`, `Card`, `ModalShell`, `SegmentedControl`, `SystemNotice`, `BrandLoader`… |
| Ikony | `src/components/icons/StrokeIcons.tsx` | własne SVG stroke, bez paczki ikon |
| Shell i nawigacja | `src/components/layout/` | `AppShell` → `AppShellClient`, `Sidebar`, `MobileSalesNav`, `MobileOperationsNav` |
| Ekrany logowania / 404 | `src/components/brand/BrandMomentLayout.tsx` | bez sidebara (`isAuthLayoutPath`) |
| Znak marki | `src/lib/ui/brand-app-icon-svg.ts` | opis: `docs/brand/README.md` |

---

## 3. Wzorce ekranów (do sklonowania koncepcyjnie)

Anatomia ekranu (nagłówek, zakładki, panele, stany): DESIGN.md → Layout → Anatomia ekranu.

| Wzorzec | Przykład w OnTime |
|---------|-------------------|
| **Panel operacyjny** | `/podsumowanie` |
| **Kolejka / inbox** | `/kolejka`, `/weryfikacja` |
| **Lista użytkownika** | `/moje` |
| **Formularz prośby** | `/prosba` |
| **Hub admina** | `/admin/*` |
| **Tablica / feed** | `/tablica` |
| **Plan / kalendarz** | `/plan` |

Każdy ekran: `page.tsx` (server, dane) + `*Client.tsx` (interakcja) + opcjonalnie `loading.tsx` (ładowanie wg DESIGN.md → Ładowanie).

---

## 4. Architektura kodu (poza UI)

```
src/
  app/              # trasy Next.js (App Router)
    actions/        # Server Actions (mutacje)
    api/            # trasy API, w tym api/cron
  components/
    ui/             # prymitywy
    layout/         # shell, sidebar, mobile nav
    icons/          # SVG
    [domena]/       # ekrany biznesowe
  lib/
    ui/             # ontime-theme.ts, brand.ts
    auth/, auth-local/  # sesja, role, login flow
    db/             # pool pg, query builder
    data/           # zapytania do bazy
    [domena]/       # logika biznesowa (bez React)
  proxy.ts          # routing, sesja, role
  types/            # typy DB
```

- **Server Components** domyślnie; `"use client"` tylko przy stanie, eventach, hookach.
- **Server Actions** w `src/app/actions/` — każda zaczyna od strażnika roli (`require*()`), patrz `SECURITY.md`.
- **Logika biznesowa** w `src/lib/` — testowalna przez Vitest bez DOM.

---

## 5. Auth i role (szkielet)

- Lokalne konta: `app_users` + `app_sessions`, profil w `profiles` (rola, `sales_person_id`, obszary robocze, flagi onboardingu).
- Role (`UserRole` w `src/types/database.ts`): `admin`, `zakupy`, `zakupy_zeby`, `magazyn`, `sales`, `sales_manager` — nawigacja filtrowana po roli (`src/lib/nav.ts`), dostęp opisany w `SECURITY.md`.
- `DEV_ADMIN_MODE` nie jest czytany przez kod aplikacji (tylko `scripts/setup-check.ts`) — nie ma trybu bez logowania.
- Ciasteczka sesji: `src/lib/auth-local/cookies.ts` — `Secure` na produkcji przy `https://`.
- `NEXT_PUBLIC_APP_URL` = dokładny URL w przeglądarce (krytyczne za nginx).

---

## 6. Checklist: nowy projekt „jak OnTime”

### Faza 1 — szkielet

- [ ] `create-next-app` + TypeScript + Tailwind v4 + App Router
- [ ] Skopiuj strukturę `globals.css` (tokeny) i reguły z DESIGN.md
- [ ] `cn.ts` + `app-theme.ts` (na bazie `ontime-theme.ts`)
- [ ] Prymitywy z `src/components/ui/` potrzebne pierwszemu ekranowi
- [ ] `layout.tsx` z fontami + `AppShell` (sidebar + main)
- [ ] Ekran logowania w stylu `BrandMomentLayout`

### Faza 2 — nawigacja

- [ ] Sidebar z grupami
- [ ] Mobile bottom nav (4 + „Więcej”)
- [ ] Filtrowanie menu po roli

### Faza 3 — domena

- [ ] Schemat PostgreSQL (migracje SQL) + strażnicy ról w akcjach
- [ ] 1 panel operacyjny
- [ ] 1 lista użytkownika + 1 formularz
- [ ] Puste stany + ładowanie tras

### Faza 4 — produkcja

- [ ] `.env` + `setup-check`
- [ ] `installer/install-windows-service.ps1` lub odpowiednik
- [ ] nginx → port 3000

---

## 7. Co skopiować dosłownie vs co zmienić

| Skopiuj | Zmień pod nową domenę |
|---------|-------------------------|
| `globals.css` tokeny | Nazwa produktu, odcień akcentu |
| `ontime-theme.ts` struktura klas | Nazwa pliku, szerokości shelli |
| `components/ui/*` | Teksty, warianty jeśli potrzeba |
| `cn.ts`, layout shell | Pozycje menu, ikony |
| Wzorzec RSC + Client + Actions | Tabele, endpointy, reguły biznesowe |
| `StrokeIcons` wzorzec | Ikony semantyczne domeny |
| Installer Windows | Hostname, port, repo git |

---

## 8. Prompt startowy dla modelu AI

Możesz wkleić do nowego czatu:

```
Zbuduj aplikację webową B2B w stylu projektu OnTime (docs/stack-and-ui-blueprint.md, DESIGN.md):

- Next.js 16 App Router, React 19, TypeScript, Tailwind v4
- System wizualny z DESIGN.md: grafit + jeden akcent, statusy tylko zielony / bursztyn / czerwony
- Własne lekkie komponenty UI (Button, Card, SystemNotice…) — bez shadcn/MUI
- Tokeny CSS w globals.css + centralny plik app-theme.ts z klasami Tailwind
- Layout: sidebar desktop + dolny pasek mobile
- Ikony: własne SVG stroke w jednym pliku
- PostgreSQL + lokalne logowanie (sesja w cookie), role w profilu, autoryzacja w akcjach serwera

Domena: [OPIS NOWEJ DZIEDZINY]
Główne ekrany: [LISTA]
Role użytkowników: [LISTA]
```

---

## 9. Pliki referencyjne (najważniejsze)

| Plik | Po co |
|------|--------|
| `DESIGN.md` | System wizualny: tokeny, typografia, komponenty, zasady |
| `src/app/globals.css` | Tokeny, tło, typografia |
| `src/lib/ui/ontime-theme.ts` | Wszystkie klasy powtarzalne |
| `src/components/ui/Button.tsx` | Wzorzec wariantów |
| `src/components/layout/AppShellClient.tsx` | Shell + mobile |
| `src/components/layout/Sidebar.tsx` | Nawigacja desktop |
| `src/components/brand/BrandMomentLayout.tsx` | Auth / 404 |
| `src/components/icons/StrokeIcons.tsx` | Ikony |
| `src/app/layout.tsx` | Fonty, metadata |

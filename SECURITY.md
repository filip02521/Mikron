# Bezpieczeństwo — OnTime / system-dostaw-web

## Model

1. **Proxy (`src/proxy.ts`)** — routing, sesja, role, podgląd panelu admina.
2. **Server actions / SSR** — `require*()`, scope helpers (`canAccessSalesPerson`).
3. **Supabase service role** — domyślny klient danych w aplikacji (`createAdminClient()`).
4. **RLS w Postgres** — druga linia obrony przy bezpośrednim API z JWT użytkownika.

## Role

| Rola | Dostęp |
|------|--------|
| `admin` | Pełny; mutacje w podglądzie innego panelu zablokowane (`requireAdminForMutation`) |
| `zakupy` | Operacje zakupowe, dostawcy, panel dzienny |
| `magazyn` | Kolejka, notatki magazynowe (bez edycji kurierów) |
| `sales` | Panel handlowca |
| `sales_manager` | Zespół w scope grup + własny panel handlowca |

## Admin — podgląd panelu (cookie)

- Cookie `admin_panel_context`: `admin` | `zakupy` | `sales`.
- **Read-only preview** (handlowiec / magazyn w UI): mutacje admina zablokowane.
- **Wyjątek — tablica zakupów i prośby operacyjne**: dozwolone w cookie `admin` lub `zakupy`.
- **Zakupy w podglądzie**: admin może wykonywać realną pracę zakupową.

## Endpointy

| Endpoint | Auth |
|----------|------|
| `GET /api/health` | Produkcja: `Authorization: Bearer $CRON_SECRET` |
| `GET /api/health/live` | Publiczny ping `{ status: "ok" }` |
| `GET /api/auth/login-directory` | Rate limit IP; wyszukiwanie min. 3 znaki |
| Cron routes | Bearer `$CRON_SECRET` |

## Bootstrap

- `/setup` tylko gdy brak admina w bazie.
- Produkcja: wymagany `SETUP_TOKEN` w URL (`/setup?token=...`).
- Lock `bootstrap-admin` + rate limit na action.

## Sekrety produkcyjne

- `CRON_SECRET` — health + crony
- `PASSWORD_RESET_OTP_SECRET` — min. 32 znaki, **nie** service role key
- `SETUP_TOKEN` — pierwszy admin (min. 16 znaków)
- **Nie ustawiaj** `E2E_LAB=1` na produkcji

## Weryfikacja przed deployem

```bash
npm run verify:deploy   # migracje + env + audyty
npm test
npm run build
```

Migracje Supabase: **068–070** (RLS aliasów Subiekt, kierownik, sales_people).

Pełna weryfikacja polityk RLS (068–070): ustaw `SUPABASE_DB_PASSWORD` w `.env.local`.

## RLS `sales_people` (070)

| Rola | SELECT przez JWT |
|------|------------------|
| `admin` | wszystkie (polityka admin) |
| `zakupy` | wszystkie (`is_operations`) |
| `magazyn` | wszystkie (`is_magazyn`) |
| `sales` | tylko własna karta (`my_sales_person_id`) |
| `sales_manager` | własna + zespół w scope grup |

Aplikacja (SSR / actions) używa **service role** — UI handlowca bez zmian.

## Migracja JWT (w toku)

| Ścieżka | Klient | Status |
|---------|--------|--------|
| `getSessionUser()` | JWT → `fetchOwnProfileForSession()` | ✅ RLS `profiles` |
| `completeSalesOnboarding()` | JWT → update własnego profilu | ✅ |
| Middleware / lookup po id | service role → `fetchProfileByUserId()` | bez zmian |
| Reszta actions / data | service role | backlog iteracyjny |

Nowe mutacje własnych danych użytkownika: adnotacja `@user-jwt-ok`.

## Cookies sesji

`httpOnly: false` — wymagane przez `@supabase/ssr` (odświeżanie sesji w przeglądarce). Admin panel cookie jest `httpOnly: true`.

## CI / audyt

- `npm run audit:admin-mutations` — mutacje admin bez `requireAdminForMutation`.
- `npm run audit:service-role` — `createAdminClient()` w actions wymaga `@service-role-ok`.
- Oba audyty w GitHub Actions (`security-audit` job).

## Error boundaries

Wspólny komponent: `src/components/errors/RouteErrorScreen.tsx`.

`error.tsx`: globalny + `/admin`, `/zakupy`, `/podsumowanie`, `/kolejka`, `/moje`, `/prosba`, `/zespol`.

## Znane ograniczenia (backlog)

- Dalsza migracja odczytów/mutacji sales na user JWT + RLS (orders, notepad itd.).
- Service-role w `src/lib/data/*` — kolejne iteracje z `@service-role-ok` lub JWT.

# Bezpieczeństwo — OnTime / system-dostaw-web

## Model

1. **Proxy (`src/proxy.ts`)** — routing, sesja, role, podgląd panelu admina.
2. **Server actions / SSR** — `require*()`, scope helpers (`canAccessSalesPerson`).
3. **PostgreSQL (`createAdminClient()`)** — jeden użytkownik DB `ontime_app`, **RLS wyłączone**.
4. **Autoryzacja** — `proxy.ts` + `require*()`; sesja cookie `ontime_session` (httpOnly).

## Role

| Rola | Dostęp |
|------|--------|
| `admin` | Pełny; mutacje w podglądzie innego panelu zablokowane (`requireAdminForMutation`) |
| `zakupy` | Operacje zakupowe, dostawcy, panel dzienny |
| `zakupy_zeby` | Zakupy w module Zęby (`/zeby`, `teethNavGroups` w `src/lib/nav.ts`) |
| `magazyn` | Kolejka, notatki magazynowe (bez edycji kurierów) |
| `sales` | Panel handlowca |
| `sales_manager` | Zespół w scope grup + własny panel handlowca |

## Admin — podgląd panelu (cookie)

- Cookie `ontime_admin_panel` (`src/lib/auth/admin-panel-context.ts`): `admin` | `zakupy` | `zakupy_zeby` | `magazyn` | `sales` | `sales_manager`; wybrany handlowiec w podglądzie: `ontime_preview_sales_person`.
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

- `DATABASE_URL` — PostgreSQL (`ontime_app`)
- `SESSION_SECRET` — min. 32 znaki (hash sesji)
- `STORAGE_ROOT` / `STORAGE_SIGNING_SECRET` — pliki lokalne
- `CRON_SECRET` — health + crony
- `PASSWORD_RESET_OTP_SECRET` — min. 32 znaki, osobny od `SESSION_SECRET`
- `SETUP_TOKEN` — pierwszy admin (min. 16 znaków)
- **Nie ustawiaj** `E2E_LAB=1` na produkcji

## Weryfikacja przed deployem

```bash
npm run verify:deploy   # env + audyty
npm run verify:deploy:postgres   # + db:migrate (staging)
npm test
npm run build
```

Szczegóły bazy: [docs/database-local-postgres.md](docs/database-local-postgres.md).  
Cutover: [docs/cutover-postgres.md](docs/cutover-postgres.md).  
Zamknięcie migracji: [docs/migration-closure-checklist.md](docs/migration-closure-checklist.md).

## Scope danych (zamiast RLS)

RLS jest **wyłączone**. Ograniczenia roli (`sales` / `sales_manager` / …) egzekwuje warstwa aplikacji (`require*()`, `canAccessSalesPerson`).

| Rola | Dostęp (aplikacja) |
|------|---------------------|
| `admin` | pełny |
| `zakupy` / `zakupy_zeby` / `magazyn` | operacje w swoim panelu |
| `sales` | własna karta handlowca |
| `sales_manager` | własna + zespół w scope grup |

Nowe mutacje własnych danych użytkownika: adnotacja `@user-jwt-ok`.

## Cookies sesji

Sesja `ontime_session` jest `httpOnly: true`. Cookie podglądu panelu admina też jest `httpOnly: true`.

## CI / audyt

- `npm run audit:admin-mutations` — mutacje admin bez `requireAdminForMutation`.
- `npm run audit:db-access` / `audit:service-role` — `createAdminClient()` w actions wymaga `@db-ok` / `@service-role-ok`.
- Joby w GitHub Actions (`.github/workflows/ci.yml`): `lint`, `unit`, `security-audit`, `build`, `e2e`, `integration` (postgres:16 + `db:migrate`); osobno `codeql.yml`.

## Error boundaries

Wspólny komponent: `src/components/errors/RouteErrorScreen.tsx`.

`error.tsx`: globalny + `/admin`, `/zakupy`, `/podsumowanie`, `/podsumowanie-miesieczne`, `/kolejka`, `/moje`, `/prosba`, `/zespol`, `/urlopy`, `/ustawienia`, `/zamowienia`, `/zeby`.

## Znane ograniczenia

- Klient DB zachowuje API PostgREST (`from().select()`); pełny schemat Drizzle jest opcjonalnym follow-upem.
- Jednorazowy skrypt `scripts/migrate-storage-from-supabase.ts` nadal czyta Storage API przy cutoverze.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Interfejs — zasady w DESIGN.md

`DESIGN.md` jest normatywny dla każdej zmiany UI. Każde dłuższe ładowanie (obszar, panel, okno, strona, długa operacja) pokazuje animowane logo OnTime `BrandLoader` ze zdaniem, co się dzieje — nie szkielet ani sam `Spinner` (ten zostaje tylko w przyciskach). Szczegóły: DESIGN.md → Components → Ładowanie.

# Baza danych — PostgreSQL, NIE Supabase

Projekt używa **PostgreSQL** jako bazy danych — zarówno na produkcji, jak i lokalnie.
Supabase został odłączony z tego projektu i nie jest używany.

## Konwencje

- **Baza danych to PostgreSQL** — wszystkie zapytania, migracje i logika bazodanowa muszą być pisane pod PostgreSQL.
- **Nie używaj Supabase** — nie dodawaj zależności Supabase, nie używaj Supabase SDK, nie zakładaj Supabase-specific funkcji (RLS, `auth.uid()`, `private` schema).
- **Migracje** — pliki SQL w `supabase/migrations/` to tylko katalog migracji (nazwa historyczna). Są to zwykłe migracje PostgreSQL uruchamiane przez panel admina lub skrypt (`npm run db:migrate`, `scripts/db-migrate.ts`). Obok jest nakładka `db/migrations/` (lokalna autentykacja, wyłączenie RLS, uprawnienia): `0000_*` idzie przed `supabase/migrations/`, reszta po nich.
- **Role PostgreSQL** — `ontime_app` (aplikacja), `ontime_migrator` (DDL/migracje). Panel admina używa `DATABASE_MIGRATE_URL` dla migracji.
- **Klient DB** — aplikacja używa `pg` (node-postgres) przez `src/lib/db/pool.ts` oraz własnego query buildera z API w stylu PostgREST (`from().select()`, `src/lib/db/query-builder.ts`, przez `createAdminClient()`). Pakietu `@supabase/*` nie ma w zależnościach — nie dodawaj go.
- **Auth** — lokalna autentykacja (`app_users`, `app_sessions`), nie Supabase Auth.
- **RLS** — wyłączone (`db/migrations/0002_disable_rls_remap_fk.sql`). Autoryzacja w warstwie aplikacji.
- **`auth.uid()`** — stub zwracający `NULL` (`db/migrations/0000_supabase_compat_stubs.sql`).

## Złote zasady

1. Każda nowa funkcja bazodanowa musi działać na czystym PostgreSQL.
2. Migracje nie mogą zależeć od `private` schema ani Supabase RLS helpers.
3. Jeśli potrzebujesz DDL — użyj `DATABASE_MIGRATE_URL` (rola `ontime_migrator`).
4. Jeśli potrzebujesz odczytu/zapisu danych — użyj `DATABASE_URL` (rola `ontime_app`).
5. Nie zakładaj istnienia `supabase` jako usługi — tylko jako nazwę katalogu z migracjami.

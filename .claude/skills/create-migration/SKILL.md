---
name: create-migration
description: Tworzy nową migrację PostgreSQL w supabase/migrations/ z kolejnym numerem i sprawdza ją pod zasady projektu (czysty PostgreSQL, bez RLS/auth.uid()/private). Użycie: /create-migration <krótki_opis_snake_case> [co ma zmienić]
disable-model-invocation: true
argument-hint: <opis_snake_case> [co ma zmienić]
---

Utwórz migrację dla: $ARGUMENTS

## Kroki

1. **Numer** — weź najwyższy prefiks liczbowy z `supabase/migrations/*.sql` i dodaj 1, zachowując 3 cyfry:
   `ls supabase/migrations | grep -oE '^[0-9]+' | sort -n | tail -1`
   Nazwa: `NNN_<opis_snake_case>.sql`. Nie używaj numeru, który już istnieje (duplikaty prefiksów wymagają wpisu w `PREFIX_ORDER` w `scripts/db-migrate.ts` — unikaj).
   `db/migrations/` (format `000N_`) to warstwa kompatybilności po odejściu od Supabase — nowych migracji funkcjonalnych tam nie dodawaj.

2. **Nagłówek** jak w istniejących plikach:
   ```sql
   -- NNN_opis.sql
   -- Co i po co (1–3 linie po polsku).
   ```

3. **Treść — złote zasady:**
   - Czysty PostgreSQL. Idempotentnie: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP ... IF EXISTS`.
   - Schemat `public.` jawnie.
   - **Zakazane:** `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, `auth.uid()`, `auth.jwt()`, schemat `private`, role `authenticated`/`anon`/`service_role`, `supabase_*`.
   - Nowe tabele/sekwencje: nadaj uprawnienia roli aplikacji, wzorując się na `db/migrations/0004_grants.sql` (rola `ontime_app`).
   - Zmiany destrukcyjne (DROP COLUMN/TABLE, zawężenie typu) — zapytaj użytkownika przed zapisaniem.

4. **Kontrola** po zapisaniu pliku:
   `grep -nEi 'row level security|create policy|auth\.(uid|jwt)|private\.|authenticated|service_role|anon\b' supabase/migrations/NNN_*.sql`
   Każde trafienie = popraw przed oddaniem.

5. **Nie uruchamiaj** migracji sam. Na koniec podaj nazwę pliku i komendę dla użytkownika:
   `npm run db:migrate` (używa `DATABASE_MIGRATE_URL`, rola `ontime_migrator`).
   Jeśli zmiana dotyka typów w `src/types` albo zapytań w `src/lib`, wypisz pliki do aktualizacji.

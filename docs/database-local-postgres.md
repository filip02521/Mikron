# Lokalny PostgreSQL (OnTime)

Migracja z Supabase Cloud → PostgreSQL 16 na Windows Server (LAN).

## Architektura

- Aplikacja Next.js (NSSM) łączy się przez `DATABASE_URL` (rola `ontime_app`)
- Autoryzacja: cookie `ontime_session` + tabele `app_users` / `app_sessions`
- Pliki: `STORAGE_ROOT` (domyślnie `D:\OnTime\storage`)
- RLS wyłączone — autoryzacja w `proxy.ts` + `require*()`

## Dev lokalny

```bash
docker compose -f docker-compose.db.yml up -d
# albo macOS Homebrew:
#   brew install postgresql@16 && brew services start postgresql@16
#   utwórz role ontime_app / ontime_migrator (hasło:dev) i bazę ontime_dev
# .env.local:
# DATABASE_URL=postgresql://ontime_app:dev@127.0.0.1:5432/ontime_dev
# DATABASE_MIGRATE_URL=postgresql://ontime_migrator:dev@127.0.0.1:5432/ontime_dev
# SESSION_SECRET=dev-session-secret-min-32-characters-long
# STORAGE_ROOT=./.storage-dev
# STORAGE_SIGNING_SECRET=dev-storage-signing-secret-32c
npm run db:migrate
npm run seed
npm run dev
```

## Produkcja Windows

1. Zainstaluj PostgreSQL 16 (EDB), usługa `postgresql-x64-16`
2. Ustaw hasła w `installer/setup-postgres-roles.sql` i uruchom jako `postgres`
3. `npm run db:migrate` z `DATABASE_URL` migratora
4. Uzupełnij `.env` (nie `.env.local`):
   - `DATABASE_URL`, `SESSION_SECRET`, `STORAGE_ROOT`, `STORAGE_SIGNING_SECRET`
5. Katalogi: `D:\OnTime\storage\{teeth-ocr,teeth-orders,department-board}`, `D:\OnTime\backups`
6. Backup: `.\installer\install-postgres-backup-task.ps1`

## Cutover A→B

Zobacz [docs/cutover-postgres.md](cutover-postgres.md) oraz `scripts/cutover/`.

```powershell
# Skrót T0 (app STOP):
# 1. pg_dump data-only z Supabase (port 5432 direct)
# 2. psql -f scripts/cutover/import_app_users.sql
# 3. pg_restore --data-only --disable-triggers
# 4. npx tsx scripts/cutover/verify-counts.ts
# 5. npx tsx scripts/migrate-storage-from-supabase.ts
# 6. .env → lokalny PG, Start-Service OnTime
```

## Weryfikacja

```bash
npm run verify:db-env
npm run verify:deploy:postgres
```

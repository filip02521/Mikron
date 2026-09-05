# Weryfikacja PostgreSQL po cutover

Automatyczna checklista „działa po staremu”. Uruchom po każdym imporcie danych lub przed T0 produkcji.

## Jednym ciągiem (dev / staging)

```bash
export DATABASE_URL='postgresql://ontime_app:...@127.0.0.1:5432/ontime_dev'
export DATABASE_MIGRATE_URL='postgresql://ontime_migrator:...@127.0.0.1:5432/ontime_dev'
export SESSION_SECRET='...'   # min 32 znaki
export STORAGE_ROOT='./.storage-dev'
export STORAGE_SIGNING_SECRET='...'

npm run cutover:verify-surface   # hot paths, embeds, RPC, counts, storage refs
npm run cutover:sanity           # psql sanity-sql.sql
npm run cutover:verify-login
npm run setup-check
npm run verify:deploy
npm test
```

## Smoke HTTP (dev server)

```bash
npm run dev
curl http://127.0.0.1:3000/api/health/live
curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/auth/session
curl -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}'
```

Oczekiwane:
- `/api/health` → `"database": true`, `"schema": true`
- `/api/auth/login` (złe hasło) → `Nieprawidłowy e-mail lub hasło`
- `/api/auth/login-directory?q=fil` → lista kont z `profiles`

## Ręcznie (§6.4 planu)

- [ ] Login: admin, zakupy, magazyn, sales, sales_manager
- [ ] Reset OTP → `/ustaw-haslo`
- [ ] `/moje`, panel dzienny, `/zeby` (OCR + plik)
- [ ] Tablica działu — zdjęcie
- [ ] Cron (Windows Task Scheduler)
- [ ] Subiekt health (read-only)

## Znane wyjątki

| Obszar | Status |
|--------|--------|
| `product-zd-lookup.search.test.ts` (2 testy) | Mock Subiekt API — **nie** związane z PG |
| `job_locks` COUNT | Tabela runtime — pomijana w verify-counts |
| Supabase Storage API | Tylko `migrate-storage-from-supabase.ts` (cutover) |

## Powierzchnia DB w kodzie

- **~150 plików** `src/` używa `createAdminClient()` (actions, data, services, cron)
- **3 RPC**: `try_acquire_job_lock`, `increment_delivery_stats`, `replace_external_warehouse_line_pallet_shares`
- **Auth**: `app_users` + cookie `ontime_session` (bez Supabase JWT)
- **Storage**: `STORAGE_ROOT` + signed URL `/api/storage/file`

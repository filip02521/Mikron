# Cutover T0 — Supabase → lokalny PostgreSQL

Pełna ścieżka danych A→B (plan v5.1). **Dry-run na Macu zakończony PASS** (2026-09-01).

## Macierz M1–M7 (warunki przed produkcją)

| # | Kryterium | Dev Mac (dry-run) | Produkcja Windows |
|---|-----------|-------------------|-------------------|
| M1 | PG + backup | ✅ PG16 Homebrew | `installer/setup-postgres-roles.sql` + backup Task |
| M2 | Schema | ✅ `npm run db:migrate` | to samo na `ontime` / `ontime_staging` |
| M3 | Dry-run danych | ✅ `npm run cutover:dry-run` | powtórzyć na `ontime_staging` |
| M4 | verify-counts ±0 | ✅ 66 tabel + 21 app_users | ten sam snapshot co export |
| M5 | sanity SQL | ✅ orphan=0, RPC OK | `npm run cutover:sanity` |
| M6 | storage | ✅ 31/31 plików | `npm run cutover:storage` |
| M7 | CI integration | ✅ w repo | GitHub Actions `integration` job |

## Narzędzia wymagane

| Narzędzie | Mac (dev) | Windows (prod) |
|-----------|-----------|----------------|
| PostgreSQL | 16 lokalnie (app) | **16** EDB installer |
| pg_dump | **17** (Supabase = PG 17) | PostgreSQL 17 client tools |
| Node | 24 LTS | 24 LTS |

> Export z Supabase wymaga `pg_dump` **≥ wersji serwera** (17). Import na PG **16** używa plain SQL (`public-data.sql`) z usuniętym `transaction_timeout`.

## Dry-run (Mac / staging) — jedna komenda

```bash
# .env.local: DATABASE_URL, DATABASE_MIGRATE_URL, STORAGE_ROOT
# Supabase (w komentarzu OK): archived DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

npm run cutover:export    # snapshot + auth CSV + public SQL + storage manifest
npm run cutover:import    # truncate → app_users → public → verify
npm run cutover:storage   # 31 plików → STORAGE_ROOT
npm run cutover:verify-login
npm run cutover:sanity    # wymaga psql + DATABASE_URL
npm run verify:deploy
```

Artefakty w `data/cutover/` (gitignored): `counts-source.json`, `auth_users_export.csv`, `public-data.sql`, `storage-objects.json`.

## T0 produkcja — kolejność

1. **Komunikat + STOP** — `Stop-Service OnTime`
2. **Backup** — `.env` → `.env.supabase-backup`, dump PG Supabase (ostateczny)
3. **Export** (app STOP — zero driftu):
   ```powershell
   $env:SUPABASE_DB_URL = "postgresql://postgres.xxx:...@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
   npm run cutover:export
   ```
4. **Import** (schema wcześniej: `npm run db:migrate`):
   ```powershell
   $env:DATABASE_MIGRATE_URL = "postgresql://ontime_migrator:...@127.0.0.1:5432/ontime"
   npm run cutover:import
   npm run cutover:storage
   ```
5. **Weryfikacja**:
   ```powershell
   npm run cutover:verify-login
   npm run cutover:sanity
   npm run verify:deploy:postgres
   ```
6. **Nowy `.env`** — `DATABASE_URL`, `SESSION_SECRET`, `STORAGE_ROOT`; **bez** `SUPABASE_*`
7. **Deploy** — `npm run deps:ci && npm run build && Start-Service OnTime`
8. **Smoke §6.4** — login (admin/zakupy/sales), OTP reset, pliki OCR/board, cron, `/api/health`

## Kryteria PASS (dry-run)

- [x] COUNT(*) wszystkich tabel `public` = snapshot (±0)
- [x] `app_users` = 21 (= auth.users)
- [x] `orphan_profiles` = 0
- [x] orphan FK §A.2 = 0
- [x] bcrypt 21/21 (`$2a$` / `$2b$`)
- [x] 3 RPC: `try_acquire_job_lock`, `increment_delivery_stats`, `replace_external_warehouse_line_pallet_shares`
- [x] storage 31/31

## Rollback

Przywróć `.env.supabase-backup`, `Start-Service OnTime`. Lokalny PG zostaje do analizy.

## Skrypty

| Skrypt | Rola |
|--------|------|
| `scripts/cutover/run-dry-run.ts` | orchestrator export/import/storage/full |
| `scripts/cutover/import-app-users.ts` | auth.users → app_users (wyłącza trigger) |
| `scripts/cutover/verify-counts.ts` | COUNT vs snapshot |
| `scripts/cutover/sanity-sql.sql` | integralność + RPC + bcrypt |
| `scripts/cutover/verify-login-sample.ts` | lista kont + test bcrypt |
| `scripts/migrate-storage-from-supabase.ts` | pliki z manifestu |
| `installer/cutover-t0.ps1` | wrapper Windows (legacy — preferuj npm scripts) |

## Po cutover

- Wszyscy użytkownicy logują się **od nowa** (cookie `ontime_session`, nie Supabase)
- Hasła **bez zmian** (bcrypt 1:1 z `auth.users`)
- Supabase Cloud: wstrzymać po 14 dniach stabilnej produkcji

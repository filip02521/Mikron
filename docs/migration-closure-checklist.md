# Checklist zamknięcia migracji (zał. Q)

## Dry-run (staging / dev Mac) — wykonane 2026-09-01

- [x] `npm run cutover:dry-run` — export + import PASS
- [x] verify-counts: 66 tabel public + 21 app_users
- [x] sanity-sql: orphan_profiles=0, FK §A.2=0
- [x] storage: 31/31 plików
- [x] bcrypt: 21/21 kont
- [x] `npm run verify:deploy` green (DATABASE_URL lokalny)

## Produkcja Windows (T0 — do wykonania)

- [ ] PostgreSQL 16 zainstalowany (`installer/setup-postgres-roles.sql`)
- [ ] Backup Task Scheduler (`installer/install-postgres-backup-task.ps1`)
- [ ] `npm run db:migrate` na `ontime` produkcyjnym
- [ ] Dry-run na `ontime_staging` z dumpem produkcji (identyczny runbook)
- [ ] Okno maintenance uzgodnione (plan: niedziela 06:00–10:00)
- [ ] T0: export → import → storage → verify → `.env` → build → start
- [ ] Smoke §6.4 (login, OTP, pliki, cron, health)
- [ ] ≥14 dni bez P0/P1
- [ ] Supabase Cloud: archiwum + pause

## Definition of Done (projekt)

- [ ] Produkcja na lokalnym PG ≥14 dni
- [ ] `npm run verify:deploy` green na `.env` produkcyjnym
- [ ] Brak żywych importów `@supabase/*` w runtime
- [ ] Dokumentacja: ten plik + `docs/cutover-postgres.md` + `docs/database-local-postgres.md`

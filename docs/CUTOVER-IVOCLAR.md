# Cutover Ivoclar: OnTime → OnTime Raporty

Pełna procedura: sibling repo `ontime-raporty` → `docs/CUTOVER.md`.

## Stan w OnTime (wdrożone w kodzie)

- Generowanie / wysyłka Ivoclar **usunięte** z OnTime (pipeline report + cron send).
- `/admin/mail` — odczyt `mail_send_log` + definicje jobów; **brak mutacji** (generate/send/odbiorcy).
- Dostęp: `role=admin` **lub** moduł `ivoclar_weekly_mail_center`.
  - Admin: pełny hub (System / Wysyłki OT / Ivoclar / …).
  - Tylko moduł: hub pokazuje wyłącznie zakładkę Ivoclar (bez linku do `/admin/wysylki`).
- `/zakupy/raporty-ivoclar` — bookmark: redirect do `/admin/mail` (admin lub moduł) albo komunikat o braku modułu.
- `/api/cron/scheduled-mails` — zawsze `skipped: moved_to_ontime_raporty` (legacy no-op).
- Env (server-only): `RAPORTY_RUNNER_URL` (+ opcjonalnie `RAPORTY_CRON_SECRET`) — live status `SEND` z `GET /api/ivoclar/status`.
- Cron-monitor: wiersz „Ivoclar (OnTime Raporty)” — sukces = `sent` w `mail_send_log`; no-op OT nie jest traktowany jako awaria.

## Ops (produkcja)

1. Runner musi mieć dostęp do **tego samego Supabase** co OnTime (lustro `mail_send_log`), inaczej OT nie zobaczy statusu.
2. Smoke: runner z `EMAIL_OVERRIDE_TO` + `IVOCLAR_SEND_ENABLED=1` → w OT widać `period_key` z `:test`.
3. Wyłączyć Windows SchTasks `OnTime Cron Scheduled Mails *` (reinstall `install-cron.ps1 -Install` usuwa je jako legacy).
4. Zdjąć override; `IVOCLAR_SEND_ENABLED=1` na runnerze na stałe.
5. Nadać moduł `ivoclar_weekly_mail_center` użytkownikom, którzy mają widzieć logi.
6. **Nie** ustawiać `mail_job_definitions.enabled=false` dopóki runner nie jest pewny — w OnTime i tak nie wysyła.

**Źródło prawdy wysyłki:** OnTime Raporty (FS+PA). OnTime = tylko logi + live SEND badge.

**Provider e-mail runnera:** Amazon SES SMTP (`SMTP_*`, `ontime.mikran.pl`). Kolumna `mail_send_log.resend_message_ids` jest historyczna (zapisuje message-id SMTP).

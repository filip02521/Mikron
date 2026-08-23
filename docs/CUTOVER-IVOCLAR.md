# Cutover Ivoclar: OnTime → OnTime Raporty

Pełna procedura: zobacz repozytorium sibling `ontime-raporty` → `docs/CUTOVER.md`.

## Stan w OnTime (wdrożone w kodzie)

- Generowanie / wysyłka Ivoclar **usunięte** z OnTime (pipeline report + cron send).
- `/admin/mail` — odczyt `mail_send_log` + definicje jobów; mutacje → 403.
- Dostęp: `role=admin` **lub** moduł `ivoclar_weekly_mail_center`.
- `/zakupy/raporty-ivoclar` — bookmark: redirect do `/admin/mail` (admin lub moduł) albo komunikat o braku modułu (bez wymagań roli zakupy).
- `/api/cron/scheduled-mails` — zawsze `skipped: moved_to_ontime_raporty` (legacy no-op).
- Env opcjonalny: `RAPORTY_RUNNER_URL` (+ opcjonalnie `RAPORTY_CRON_SECRET`) — live status `SEND` z `GET /api/ivoclar/status` (pole `sendEnabled` = `IVOCLAR_SEND_ENABLED` na runnerze).
- Cron-monitor: sukces = wpis `sent` w `mail_send_log` (runner).
- Login/`proxy`: `?next=/admin/mail` oraz stary bookmark respektują moduł.

## Ops (produkcja)

1. Runner: send z `EMAIL_OVERRIDE_TO` → w logach widać `:test`, potem zdjąć override.
2. Wyłączyć istniejące Windows SchTasks `OnTime Cron Scheduled Mails *` (reinstall `install-cron.ps1 -Install` usuwa je jako legacy) oraz ewentualny stary wpis Vercel (już usunięty z `vercel.json`).
3. `IVOCLAR_SEND_ENABLED=1` na runnerze.
4. Nadać moduł `ivoclar_weekly_mail_center` użytkownikom, którzy mają widzieć logi (zwłaszcza byli użytkownicy `/zakupy/raporty-ivoclar`).
5. **Nie** ustawiać `mail_job_definitions.enabled=false` dopóki runner nie jest pewny — w OnTime i tak nie wysyła.

**Źródło prawdy wysyłki:** OnTime Raporty (FS+PA). OnTime = tylko logi.

**Provider e-mail runnera:** OnTime Raporty używa **tego samego Amazon SES SMTP** co OnTime (`SMTP_*`, `ontime.mikran.pl`). Kolumna `mail_send_log.resend_message_ids` pozostaje historyczna (zapisuje message-id SMTP).

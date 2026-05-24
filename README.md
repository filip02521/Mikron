# System Dostaw (web)

Aplikacja webowa zastępująca arkusz Google Sheets — zarządzanie cyklicznymi zamówieniami u dostawców (POLSKA / ZAGRANICA / IMPORT) oraz zamówieniami indywidualnymi „Dla kogoś”.

## Stos

- **Next.js 16** (App Router)
- **Supabase** (PostgreSQL, Auth, RLS)
- **Resend** (e-maile, opcjonalnie)

## Szybki start

1. Utwórz projekt na [supabase.com](https://supabase.com) i skopiuj `.env.example` → `.env.local`.
2. Uruchom migracje SQL w Supabase **SQL Editor** (kolejno, po kolei):
   - `001_initial_schema.sql`
   - `002_auth_profile_trigger.sql` (oraz opcjonalnie `002_interval_raw.sql`, `003_stock_raw.sql` jeśli importujesz CSV)
   - `004_zakupy_role.sql` — rola zakupów
   - `005_profile_role_guard.sql`
   - `006_request_kind_informacja.sql` — **wymagane** dla „Informacja gdy dotarło”

   Sprawdzenie: `npm run setup-check` (powinno pokazać `request_kind` OK).
3. Zainstaluj zależności i uruchom dev:

```bash
npm install
cp .env.example .env.local
npm run setup-check
npm run dev
```

4. (Opcjonalnie) Dane demo:

```bash
npm run seed
```

5. Migracja z CSV (eksport z Google Sheets):

```bash
mkdir -p data
# umieść: ustawienia.csv, urlopey.csv, sprzedaz.csv, historia_indywidualne.csv
npm run migrate -- ./data
```

## Główne ekrany

| Ścieżka | Opis |
|---------|------|
| `/podsumowanie` | Panel dzienny (lewa/prawa tabela, akcje ZAMÓWIONE / GŁÓWNE / POBOCZNE) |
| `/lokalizacje/[POLSKA\|ZAGRANICA\|IMPORT]` | Harmonogramy dostawców |
| `/kolejka` | Realizacja zamówień indywidualnych |
| `/historia` | Historia standardowa i indywidualna |
| `/zamowienia/nowe` | Formularz zamówienia dla kogoś |
| `/moje` | Widok handlowca |
| `/admin` | Synchronizacja, raporty, status systemu |

## Retencja historii (6 miesięcy)

- Na ekranie `/historia` widać tylko wpisy z ostatnich **6 miesięcy**.
- **Usuwanie starych danych** działa automatycznie przy normalnej pracy (nowy wpis w historii standardowej, zakończenie/anulowanie prośby indywidualnej) — co najwyżej **raz na 24 h**, bez konfiguracji crona na serwerze aplikacji.
- Opcjonalnie to samo robi poranny endpoint `/api/cron/morning` (jeśli masz crona — Vercel lub własny).

## Cron (Vercel / własny serwer — opcjonalnie)

Nagłówek: `Authorization: Bearer <CRON_SECRET>`

| Kiedy (Europe/Warsaw, pn–pt) | Endpoint | Co robi |
|------------------------------|----------|---------|
| **6:00** | `/api/cron/morning` | Przelicza terminy dostawców (panel dzienny), domyka kolejkę realizacji |
| **Co godzinę 8:00–18:59** | `/api/cron/process-deliveries` | Zapasowe domknięcie dostaw z kolejki |

Vercel uruchamia crony w UTC; w kodzie sprawdzana jest strefa **Europe/Warsaw** (CET/CEST).

Tylko synchronizacja harmonogramów: `/api/cron/morning-sync`

E-mail „towar dotarł” wysyłany jest **od razu** po zapisie w Realizacji, nie czeka na cron.

## Testy logiki biznesowej

```bash
npm run test
```

Logika dat, urlopów i podsumowania jest w `src/lib/orders/` — zgodna z oryginalnym skryptem GAS v12.

## Role użytkowników

- **admin** — pełny dostęp (tabela `profiles`, `role = admin`)
- **sales** — własne zamówienia (`sales_person_id` w profilu)

W developmencie: `DEV_ADMIN_MODE=true` omija wymóg logowania.

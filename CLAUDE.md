@AGENTS.md

# Projekt w skrócie

OnTime — wewnętrzny system dostaw i zakupów (dostawcy, zamówienia ZD/ZK, magazyn, odprawy) połączony z Subiektem przez REST API. Next.js 16 (App Router) + React 19, Tailwind 4, PostgreSQL przez `pg`, testy Vitest i Playwright.

- `src/app/<moduł>/` — ekrany (np. `zamowienia`, `zakupy`, `dostawy`, `zk`, `moje`, `tablica`, `admin`); `src/app/api/` — trasy, w tym `cron/*`.
- `src/lib/` — logika domenowa (`subiekt`, `orders`, `sales`, `customs`, `stock-watch`, `db`, `auth`).
- `supabase/migrations/` + `db/migrations/` — migracje SQL (patrz niżej, AGENTS.md).

# Sprawdzenie zmiany

- `npx tsc --noEmit`, `npm run lint`, `npm test` (Vitest) — zawsze przed oddaniem.
- `npm run audit:design` — po zmianie UI; `npm run audit:db-access` i `npm run audit:server-action-redirect` — po zmianie akcji lub tras.
- `npm run test:e2e` (Playwright) — przy zmianie przepływu ekranu.

# Dokumentacja — przeczytaj, gdy zadanie dotyczy tematu

- `DESIGN.md` — każda zmiana UI.
- `docs/integrations/subiekt.md`, `subiekt-errors.md` — wszystko, co woła Subiekt.
- `docs/zamowienia-jeden-silnik.md` — logika zamówień do dostawców (Kreator, Braki, Automat).
- `docs/database-local-postgres.md` — lokalna baza i migracje.
- `docs/server-deploy.md`, `cron-windows-server.md`, `production-urls.md` — deploy, crony, adresy produkcji.
- `docs/plans/` — plany w toku (np. `ciemny-tryb.md`, `odprawa-celna.md`).

# Szkice maili (Gmail MCP)

- Zero załączników, chyba że użytkownik wprost poda plik do dołączenia.
- Nie używaj `replyToMessageId`. Odpowiedź w wątku dokleja cytat oryginału z obrazkami z podpisów (`~WRD*.jpg`, `image00*.png`), z których Gmail robi puste załączniki. `update_draft` cytatu nie usuwa — serwer dokleja go z powrotem.
- Zamiast tego nowy szkic z tematem `Re: <temat wątku>` i numerem zamówienia/sprawy w treści.
- Przed oddaniem szkicu sprawdź `get_draft`: brak `attachments`.
- Pisz w 1. osobie liczby pojedynczej, w imieniu Filipa: „I confirm”, „I would like to ask”, „przesyłam”, „proszę”, „mam do odbioru” — nie „we”, „our team”, „prosimy”, „mamy”. Liczba mnoga tylko tam, gdzie chodzi o firmę jako stronę umowy („our order”, „our invoice”, „nasze zamówienie”).

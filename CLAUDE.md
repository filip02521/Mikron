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

# Dokumenty od dostawców — najpierw Dysk Google, potem Gmail

- Faktury, potwierdzenia zamówień, dokumenty dostawy i inne pliki od dostawców szukaj najpierw na Dysku Google (konektor Drive, `search_files`). Do Gmaila sięgaj dopiero, gdy na Dysku ich nie ma — i powiedz wtedy, skąd jest plik.
- Załączniki z poczty trafiają na Dysk automatycznie pod nazwą `RRRR-MM-DD Dostawca – ZD nn-M-mm-rrrr – nazwa pliku`; w opisie pliku jest nadawca, temat, numer ZD i link do maila.
- Zapytanie: `title contains 'Dostawca'` albo `fullText contains 'numer'`, sortowanie `modifiedTime desc` (pole `name` nie działa).
- Brak pliku na Dysku nie znaczy, że dokumentu nie ma — część faktur idzie na inne skrzynki.

# Linki do maili (Gmail MCP)

- Link do maila buduj z szesnastkowego ID wiadomości (pole `id`, np. `1a1c4b3676b29982`): `https://mail.google.com/mail/u/0/#all/<id>`.
- Nie podawaj linków z pola `viewUrl` konektora (`…?authuser=…#all/thread-f:…|msg-f:…`) — nie otwierają się.
- Bierz ID konkretnej wiadomości, nie wątku — ID wątku bywa inne i może wskazywać usunięty szkic.
- Obok linku podaj nadawcę, temat i datę, żeby mail dało się znaleźć ręcznie.
- Szkice: zamiast linku napisz, że szkic jest w „Wersjach roboczych”, i podaj adresata oraz temat.

# Szkice maili (Gmail MCP)

- Załączaj dokumenty, których dotyczy mail i które da się pobrać (faktura, packing list, deklaracja zgodności, potwierdzenie przelewu, plik zamówienia) — bez pytania. W podsumowaniu wypisz, co załączono i czego nie udało się załączyć.
- Zero śmieciowych załączników: żadnych obrazków z podpisów ani pustych plików z cytowanego wątku (patrz niżej).
- Nie używaj `replyToMessageId`. Odpowiedź w wątku dokleja cytat oryginału z obrazkami z podpisów (`~WRD*.jpg`, `image00*.png`), z których Gmail robi puste załączniki. `update_draft` cytatu nie usuwa — serwer dokleja go z powrotem.
- Zamiast tego nowy szkic z tematem `Re: <temat wątku>` i numerem zamówienia/sprawy w treści.
- `update_draft` usuwa pliki ze szkicu — przy zmianie szkicu z załącznikami utwórz nowy z tymi samymi plikami i usuń stary.
- Plik do załączenia musi leżeć w katalogu projektu albo w scratchpadzie — pobrany załącznik z `tool-results` najpierw tam skopiuj pod czytelną nazwą.
- Przed oddaniem szkicu sprawdź `get_draft` w formacie `RAW` (zwykły widok nie pokazuje załączników szkicu): części `Content-Disposition: attachment` to tylko dokumenty dodane celowo.

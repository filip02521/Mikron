# Integracja z Subiektem

Aplikacja **nie łączy się bezpośrednio** z bazą SQL Subiekta GT ani z biblioteką Sfera (wymaga Windows + .NET). Zakładamy **HTTP API** — np.:

- mostek / usługa na serwerze z Subiektem (InsERT Sfera, własny middleware),
- gotowy connector od integratora,
- Subiekt Nexo z warstwą REST udostępnioną przez partnera.

## Konfiguracja (.env.local)

| Zmienna | Wymagane | Opis |
|---------|----------|------|
| `SUBIEKT_API_BASE_URL` | tak | Bazowy URL API, np. `https://192.168.1.10:8443/api` |
| `SUBIEKT_API_KEY` | zależnie | Klucz / token (Bearer lub nagłówek) |
| `SUBIEKT_API_USER` | zależnie | Login (Basic) |
| `SUBIEKT_API_PASSWORD` | zależnie | Hasło (Basic) |
| `SUBIEKT_API_AUTH_MODE` | nie | `bearer` (domyślnie), `basic`, `api-key-header` |
| `SUBIEKT_API_KEY_HEADER` | nie | Domyślnie `X-Api-Key` |
| `SUBIEKT_API_HEALTH_PATH` | nie | Ścieżka testu, domyślnie `/` |
| `SUBIEKT_API_TIMEOUT_MS` | nie | Limit czasu (ms), domyślnie `15000` |

## Test połączenia

1. Uzupełnij `.env.local` i zrestartuj `npm run dev`.
2. Wejdź w **Administracja** → karta **Integracja Subiekt** → **Test połączenia**.
3. Albo (zalogowany admin): `GET /api/subiekt/health`.

## Co potrzebujemy od Ciebie (następny krok)

Żeby podłączyć konkretne funkcje, prześlij proszę:

1. **Wersja** — Subiekt GT, Nexo, czy inna?
2. **Typ API** — REST (URL + dokumentacja), czy tylko Sfera (wtedy potrzebny osobny serwis-most)?
3. **Endpointy** — np. lista towarów po symbolu, stany magazynowe, tworzenie ZK/PZ.
4. **Przykład** — jedno żądanie curl/Postman (bez haseł; można zamaskować token).
5. **Cel biznesowy** — co ma robić System Dostaw:
   - podpowiedź dostępności przy symbolu w prośbie handlowca,
   - import stanów do kolejki magazynu,
   - wystawianie dokumentów po „Zamówione”,
   - coś innego?

## Kod w repozytorium

- `src/lib/subiekt/config.ts` — odczyt env
- `src/lib/subiekt/client.ts` — `subiektFetch` / `subiektJson` / test połączenia
- `src/app/actions/subiekt.ts` — akcje admina
- `src/app/api/subiekt/health/route.ts` — endpoint diagnostyczny

Kolejne moduły (np. `src/lib/subiekt/products.ts`) dodamy po ustaleniu kontraktu API.

# Integracja z Subiektem (REST API v1)

Aplikacja łączy się z **HTTP REST API** Subiekta (odczyt SELECT z MSSQL) — nie bezpośrednio z Sferą ani SQL.

## Sieć firmowa (LAN)

API jest dostępne tylko w sieci pracy, np.:

```text
http://192.168.0.140:5080/api/v1
```

**Wymagania:**

1. Komputer uruchamiający `npm run dev` (lub produkcję) musi być w tej samej sieci co host `192.168.0.140`.
2. Serwis Subiekta nasłuchuje na LAN (nie tylko `127.0.0.1`).
3. Z domu test połączenia **nie zadziała** — to normalne; konfiguracja i kod są gotowe na pracę.

### Szybki start w pracy

1. Skopiuj zawartość [`.env.subiekt.work.example`](../../.env.subiekt.work.example) do `.env.local`.
2. Zrestartuj dev: `npm run dev`.
3. **Administracja** → **Integracja Subiekt** → **Test połączenia**.
4. Opcjonalnie: wyszukaj towar lub dostawcę w panelu (read-only).

Sprawdzenie z terminala (na PC w LAN):

```bash
curl -s http://192.168.0.140:5080/api/v1/health
```

Oczekiwana odpowiedź:

```json
{ "data": { "status": "ok", "timestamp": "...", "sqlConfigured": true } }
```

## Konfiguracja (.env.local)

| Zmienna | Wymagane | Opis |
|---------|----------|------|
| `SUBIEKT_API_BASE_URL` | tak | Bazowy URL z `/api/v1`, np. `http://192.168.0.140:5080/api/v1` |
| `SUBIEKT_API_AUTH_MODE` | nie | `none` gdy klucz wyłączony; inaczej `bearer`, `basic`, `api-key-header` |
| `SUBIEKT_API_KEY` | zależnie | Token — tylko gdy włączony na serwerze Subiekta |
| `SUBIEKT_API_USER` / `SUBIEKT_API_PASSWORD` | zależnie | Basic auth |
| `SUBIEKT_API_KEY_HEADER` | nie | Domyślnie `X-Api-Key` |
| `SUBIEKT_API_HEALTH_PATH` | nie | Domyślnie `/health` |
| `SUBIEKT_API_TIMEOUT_MS` | nie | Domyślnie `15000` |

## Endpointy API (odczyt)

Wszystkie listy zwracają envelope:

```json
{
  "data": [ ... ],
  "pagination": { "page", "pageSize", "totalCount", "totalPages" }
}
```

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/health` | Status usługi i SQL |
| GET | `/products` | Towary (`search`, `symbol`, `page`, `pageSize`, …) |
| GET | `/products/:id` | Jeden towar |
| GET | `/kontrahenci` | Kontrahenci |
| GET | `/kontrahenci/dostawcy` | Dostawcy |
| GET | `/kontrahenci/odbiorcy` | Odbiorcy |
| GET | `/documents` | Dokumenty (filtry `typ`, `dataOd`, `dataDo`, …) |
| GET | `/documents/zk` | Zamówienia od klientów (typ 16) |
| GET | `/documents/zd` | Zamówienia do dostawców (typ 15) |
| GET | `/examples` | Przykłady zapytań |
| GET | `/docs` | Dokumentacja OpenAPI (HTML) |

## Kod w repozytorium

| Plik | Rola |
|------|------|
| `src/lib/subiekt/config.ts` | Env, auth |
| `src/lib/subiekt/client.ts` | HTTP, test `/health` |
| `src/lib/subiekt/api.ts` | `searchSubiektProducts`, `searchSubiektZk`, … |
| `src/lib/subiekt/types.ts` | Typy envelope i encji |
| `src/lib/subiekt/paths.ts` | Stałe ścieżek |
| `src/app/actions/subiekt.ts` | Akcje admina (test, lookup) |
| `src/components/admin/SubiektIntegrationPanel.tsx` | UI w Administracji |

## Użycie w kodzie (server-only)

```ts
import { searchSubiektProducts, searchSubiektZk } from "@/lib/subiekt/api";

const { data, pagination } = await searchSubiektProducts({
  symbol: "ABC",
  pageSize: 20,
});
```

Wywołuj tylko z Server Actions / Route Handlers — klient przeglądarki nie ma dostępu do API w LAN.

## Podpowiedzi w formularzach próśb

Przy składaniu i uzupełnianiu próśb (gdy `SUBIEKT_API_BASE_URL` jest ustawione i API odpowiada w LAN):

| Pole | Zachowanie |
|------|------------|
| **Symbol lub nazwa** | Wpisz ≥2 znaki w polu symbol **lub** produkt → lista z Subiekta; wybór uzupełnia **symbol**, **produkt** i **ilość** (zamówienie: domyślnie 1; informacja: bez ilości). |
| **Dostawca** | Wyszukiwarka z listy aplikacji (natychmiast, bez czekania na Subiekt przy każdym znaku). Opcjonalnie — można wysłać prośbę bez dostawcy, jeśli wybrano towar z Subiekta. |
| **Dostawca z ZD (prośba handlowca)** | Po **wysłaniu** prośby serwer w tle szuka dostawcy w ZD (`supplier_resolve_pending`). Sukces → status **Nowe** (panel dzienny); brak dopasowania → **Weryfikacja**. Handlowiec nie czeka przy wyborze towaru. |

Miejsca: `/prosba`, `/zamowienia/nowe`, szybka prośba w panelu dziennym, edycja prośby, `/weryfikacja`.

Komponenty: `SubiektProductLineFields`, `SupplierPickerField`, `SubiektFeedbackAlert`. Akcje: `actionSubiektSuggestProducts`, `actionSubiektSuggestSuppliers`.

**Komunikaty błędów** (brak połączenia, nie znaleziono, timeout): [subiekt-errors.md](./subiekt-errors.md) — słownik w `src/lib/subiekt/feedback.ts`.

### Termin dostawy w „Moje zamówienia”

Dla zamówień (nie informacji) aplikacja szuka w Subiekcie dokumentu **ZD** z pasującą pozycją (symbol, nazwa lub `tw_Id`) **wyłącznie u dostawcy powiązanego z Subiektem** (`suppliers.subiekt_kh_id` / kh_Id z prośby). Bez powiązania — tylko szacunek z historii dostaw (`delivery_stats`). Termin z pól `dok_TerminRealizacji` / `dok_DataRealizacji`. Wymaga LAN i `SUBIEKT_API_BASE_URL`.

**Ograniczanie obciążenia API (Moje zamówienia):**

- wynik na handlowca w cache Next **2 h** (`zd-eta-v4`);
- w procesie: cache list ZD i pełnych dokumentów **2 h** (`subiekt-runtime-cache.ts`);
- wyszukiwanie z `dataOd` (domyślnie 18 mies.) + `khId` + max **3 frazy** na prośbę;
- **wczesne przerwanie** — kolejne frazy tylko gdy brak dopasowania;
- max **24** pełne dokumenty na przebieg (wspólny limit dla wszystkich dostawców).

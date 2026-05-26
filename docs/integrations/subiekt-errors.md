# Subiekt — komunikaty błędów i sytuacji

Centralny słownik: `src/lib/subiekt/feedback.ts`  
UI: `SubiektFeedbackAlert` (ton: info / warning / error)

## Kody (`SubiektErrorCode`)

| Kod | Kiedy | Ton | Co robi użytkownik |
|-----|--------|-----|---------------------|
| `not_configured` | Brak `SUBIEKT_API_BASE_URL` | info | Wpisuje pola ręcznie |
| `short_query` | &lt; 2 znaki w wyszukiwaniu towaru | info | Dopisuje literę |
| `empty_query` | Puste wyszukiwanie (admin) | info | Wpisuje frazę |
| `not_found_product` | API OK, 0 towarów | info | Wpisuje symbol/opis ręcznie |
| `not_found_supplier` | API OK, 0 w Subiekcie | info | Wybiera z listy app / zostawia puste |
| `not_found_app_supplier` | Brak w app (i często w Subiekcie) | info | Inna nazwa lub ręcznie |
| `timeout` | Przekroczony `SUBIEKT_API_TIMEOUT_MS` | warning | Ponów w LAN lub ręcznie |
| `network` | Ogólny błąd sieci | warning | Sprawdź LAN, restart API |
| `unreachable` | Connection refused / fetch failed | warning | Ping/curl do hosta z .env |
| `unauthorized` | HTTP 401/403 | error | Klucz API / authMode |
| `http_error` | Inne 4xx | error | IT / logi REST |
| `server_error` | 5xx | error | Ponów / zgłoś IT |
| `invalid_response` | Zły JSON | warning | Wersja API, ręcznie |
| `health_degraded` | `/health` → degraded | warning | Ograniczone podpowiedzi |
| `sql_not_configured` | `sqlConfigured: false` | error | Konfiguracja MSSQL po stronie API |
| `subiekt_unavailable` | Błąd Subiekta, ale lista app działa | warning | Wybór z systemu |
| `unknown` | Nieklasyfikowany wyjątek | error | Ręcznie + test w Administracji |

## Wyjątki (serwer)

| Klasa | Mapowanie |
|-------|-----------|
| `SubiektNotConfiguredError` | `not_configured` |
| `SubiektTimeoutError` | `timeout` |
| `SubiektNetworkError` | `network` / `unreachable` |
| `SubiektRequestError` | wg statusu HTTP |

## Odpowiedzi akcji

```ts
// Sukces z pustą listą (nie błąd sieci!)
{ ok: true, items: [], feedback: notFoundProductFeedback(query) }

// Błąd połączenia
{ ok: false, feedback: SubiektFeedback }

// Dostawca: Subiekt padł, app działa
{ ok: true, suggestions: [...], subiektWarning: ... }
```

## Gdzie w UI

- `SubiektProductLineFields` — towar (symbol + nazwa) w formularzach próśb
- `SupplierPickerField` — dostawca
- `SubiektIntegrationPanel` — test połączenia i wyszukiwanie admina

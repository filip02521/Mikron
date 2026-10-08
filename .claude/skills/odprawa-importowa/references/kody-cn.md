# Kody CN z historii maili — PODPOWIEDŹ, nie źródło prawdy

Źródłem prawdy są **zatwierdzone karty w OnTime** (`customs_product_cards`, widok `/zakupy/odprawy`).
Ta lista pozwala szybko znaleźć poprzednią decyzję. Przed użyciem sprawdź kod w ISZTAR, chyba że karta w OnTime jest już zatwierdzona.
Gdy kod trafi na zatwierdzoną kartę, nie dopisuj go tutaj.

| Towar | Kod z maila | VAT | Źródło | Uwaga |
|---|---|---|---|---|
| Instrumenty protetyczne ręczne (nożyki, łopatki, kleszczyki, nożyczki) | 9018 49 00 (z maila) | 8% wyrób med. z dokumentem / 23% | odpowiedź do DHL, 09.2026 | **⚠ nie istnieje w CN 2026** — właściwy 9018 49 90 (pozostałe) albo 9018 49 10 (wiertła) |
| Krążki z cyrkonu dentystycznego | 6914 90 00 | 8% | odpowiedź do spedytora, 09.2026 | |
| Ceramika hybrydowa na uzupełnienia | „6419 90 00” | 8% | jw. | **⚠ nie istnieje w CN 2026** — literówka, właściwy 6914 90 00 (dział 64 to obuwie) |
| Glazura w paście | 3405 90 90 | 8% | jw. | |
| Krążki PMMA (prace tymczasowe) | 3407 00 00 | 8% | jw. | **⚠ do weryfikacji**: 3407 to masy modelarskie i woski dentystyczne; PMMA może należeć do działu 39 |
| Dyski woskowe do frezowania | 3407 00 00 | 23% | jw. | |
| Mikrosilnik protetyczny | 9018 49 90 (alt. 8501 40 20 bezszczotkowy) | 23% | jw. | w mailu podano dwa warianty — decyzja agencji |
| Paleta porcelanowa do mieszania | 6914 10 00 | (brak w mailu) | jw. | |
| Wosk modelowy w płytkach (UK) | (w mailu brak kodu) | z deklaracją zgodności | odpowiedź do agencji (UK), 08.2026 | |
| Scan body (kasety ze znacznikami do implantów) | (brak) | 8% z deklaracją | odpowiedź do DHL, 09.2026 | |

## Znane błędy w historii maili

Sprawdzone w nomenklaturze CN 2026 (`src/lib/customs/cn-nomenclature.json`). Agencje odprawiły te przesyłki mimo błędu, więc obecność kodu w mailu niczego nie dowodzi.

| Kod z maili | Ile razy | Stan | Zamiast |
|---|---|---|---|
| 9018 49 00 | 52 | nie istnieje | 9018 49 90; wiertła 9018 49 10 |
| 3824 99 99 | 6 | nie istnieje | podpozycja 3824 99 ma m.in. 3824 99 92 i 3824 99 96 — wybierz z ISZTAR |
| 6419 90 00 | 3 | nie istnieje | 6914 90 00 (literówka) |

Dyski z cyrkonu od jednego z dostawców z Chin szły pod dwoma kodami (3824 99 99 w 2025, 6914 90 00 w 2026) — jedna klasyfikacja do ustalenia na karcie.

Opisy z maili też bywają błędne: zakres pozycji z nazwą jednego artykułu, grupa opisana inaczej niż na fakturze, lista wszystkich części w jednym opisie, inne wymiary niż na fakturze.

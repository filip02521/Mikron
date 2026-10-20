# Kreator ZD — karta produktu i miniwykresy

Plan z briefu (jtbd + impeccable shape), 2026-10-20. Gałąź: `claude/zd-product-card` (na bazie PR #219).

- [x] 1. Miniwykres 12 × 30 dni w „Sprzed.” + bogaty dymek (HoverCard) zamiast `title`; znacznik „jednorazowy skok?” z tym samym wykresem.
- [x] 2. „Starczy” jako minipasek dni zapasu z kreską czasu dostawy; znacznik palet „N pal.” w „Do ZD”.
- [x] 3. Karta produktu (panel boczny): otwieranie nazwą / Enter, klawiatura (↑/↓, ←/→, Esc), zdanie decyzji, „Dlaczego tyle” krok po kroku.
- [x] 4. Karta: wykres 12 mies. z kropkami naszych ZD, bloki stan / w drodze / prośby (nowa akcja serwera: historia ZD + otwarte ZD towaru).
- [x] 5. Panel stanu: istniejące podsumowanie w docku („24 pozycje · szt · zł · bez ceny”) + „N pal.”; ↑/↓ między wierszami, Enter otwiera kartę.
- [x] 6. Karta: historia zakupów (wszystkie ZD, migracja 189 + nocny odczyt) i sprzedaż wg klientów z `/orders/zd/estimate/{towarId}`. Reguła „przelotowy” czeka na daty przyjęć PZ/FZ z API (docs/integrations/subiekt-abc-xyz-api-gaps.md).

Otwarte: produkcja niedostępna przy analizie (sesja wygasła) — dane ERP z lokalnego Subiekta LIVE.

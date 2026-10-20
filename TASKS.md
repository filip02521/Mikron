# Kreator ZD — karta produktu i miniwykresy

Plan z briefu (jtbd + impeccable shape), 2026-10-20. Gałąź: `claude/zd-product-card` (na bazie PR #219).

- [x] 1. Miniwykres 12 × 30 dni w „Sprzed.” + bogaty dymek (HoverCard) zamiast `title`; znacznik „jednorazowy skok?” z tym samym wykresem.
- [x] 2. „Starczy” jako minipasek dni zapasu z kreską czasu dostawy; znacznik palet „N pal.” w „Do ZD”.
- [x] 3. Karta produktu (panel boczny): otwieranie nazwą / Enter, klawiatura (↑/↓, ←/→, Esc), zdanie decyzji, „Dlaczego tyle” krok po kroku.
- [x] 4. Karta: wykres 12 mies. z kropkami naszych ZD, bloki stan / w drodze / prośby (nowa akcja serwera: historia ZD + otwarte ZD towaru).
- [x] 5. Panel stanu: istniejące podsumowanie w docku („24 pozycje · szt · zł · bez ceny”) + „N pal.”; ↑/↓ między wierszami, Enter otwiera kartę.
- [x] 6. Karta: historia zakupów (wszystkie ZD, migracja 189 + nocny odczyt) i sprzedaż wg klientów z `/orders/zd/estimate/{towarId}`. Reguła „przelotowy” czeka na daty przyjęć PZ/FZ z API (docs/integrations/subiekt-abc-xyz-api-gaps.md).

Otwarte: produkcja niedostępna przy analizie (sesja wygasła) — dane ERP z lokalnego Subiekta LIVE.

## Automat ZD — Polkard (test z akceptacją) — 2026-10-20

Cel: Kreator liczy Polkard wg strategii z backtestu, co 3 dni gotowa propozycja ZD; Filip akceptuje / odrzuca / poprawia, decyzje zapisane.

- [x] A. Backtest na całej puli (52 dostawców) przez prawdziwy kod Kreatora (mapZdEstimateLineToManual + sales track „gentle” + historia + opakowania). Kryterium: dla każdego dostawcy znana najlepsza para (cykl, dni zapasu, estymator) i porównanie z rzeczywistością (dni bez towaru, średni zapas).
- [x] B. Strategia w silniku jako czysta funkcja (zd-demand-policy): tempo = max(30 d, 90 d / 3), cel = tempo × dni zapasu dostawcy-strategii; ustawienia per dostawca (domyślnie: jak dziś). Kryterium: test jednostkowy + backtest woła tę samą funkcję.
- [ ] C. Ustawienia strategii dostawcy (migracja + UI w Kreatorze): strategia, dni zapasu, cykl dni. Kryterium: Polkard włączony, reszta bez zmian (diff list „Do ZD” dla innych dostawców = 0).
- [ ] D. Propozycje automatu: co `cykl` dni nocny przebieg zapisuje propozycję (linie, ilości, powód); w Kreatorze baner „Propozycja z …” → wczytaj / odrzuć z powodem. Kryterium: propozycja = to samo co Policz w Kreatorze tego dnia.
- [ ] E. Dziennik decyzji: przy Utwórz ZD z propozycji zapis zaakceptowane / zmienione (propozycja vs ZD per linia) / odrzucone. Kryterium: raport różnic po każdej propozycji.
  - Wynik (20.10.2026, 45 dostawców z rekonstrukcją ≥70%): dostawa ≤3 d → co 3 d + podłoga 90 d wygrywa z rzeczywistością (Polkard 25 d: −33% dni bez towaru, −33% zapasu); podłoga 90 d daje −10–18% dni bez towaru przy +1–2% zapasu. Dostawa >3 d (import) → krótkie cele przegrywają; zostaje „jak dziś”.
- [ ] F. Pełne testy, review, authz-reviewer (nowe akcje), weryfikacja w przeglądarce; migracje do wgrania na produkcji.

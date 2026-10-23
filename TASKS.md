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
- [x] C. Ustawienia strategii dostawcy (migracja + UI w Kreatorze): strategia, dni zapasu, cykl dni. Kryterium: Polkard włączony, reszta bez zmian (diff list „Do ZD” dla innych dostawców = 0).
- [x] D. Propozycje automatu: co `cykl` dni nocny przebieg zapisuje propozycję (linie, ilości, powód); w Kreatorze baner „Propozycja z …” → wczytaj / odrzuć z powodem. Kryterium: propozycja = to samo co Policz w Kreatorze tego dnia.
- [x] E. Dziennik decyzji: przy Utwórz ZD z propozycji zapis zaakceptowane / zmienione (propozycja vs ZD per linia) / odrzucone. Kryterium: raport różnic po każdej propozycji.
  - Wynik (20.10.2026, 45 dostawców z rekonstrukcją ≥70%): dostawa ≤3 d → co 3 d + podłoga 90 d wygrywa z rzeczywistością (Polkard 25 d: −33% dni bez towaru, −33% zapasu); podłoga 90 d daje −10–18% dni bez towaru przy +1–2% zapasu. Dostawa >3 d (import) → krótkie cele przegrywają; zostaje „jak dziś”.
- [ ] F. Pełne testy, review, authz-reviewer (nowe akcje), weryfikacja w przeglądarce; migracje do wgrania na produkcji.

## Automat ZD — polscy dostawcy (Faza I) — 2026-10-23

Spec: `docs/integrations/strategia-zakupowa-pl-automatyzacja.md` (decyzje §7, backtest §8). Silnik bez zmian wzoru:
`max30_90`, cykl 7 dni. Rozszerzamy automat z Polkardu; ryzyko świadome — każdy stopień autonomii osobno.

- [x] 0. Backtest 10 dostawców PL (`scripts/backtest-zd-pl/`). Kryterium: P2 `max30_90` co 7 d nie gorszy od rzeczywistości w brakach i zapasie u ≥ 7/10 — wynik 7/10, braki 4,1% vs 6,6%, zapas −4%.
- [ ] 1. Domknąć Polkard (zadanie F wyżej): pełne testy, review, authz-reviewer, migracje 190/193 na produkcji. Kryterium: propozycje Polkardu powstają na produkcji. **Zależy od Filipa (produkcja).**
- [x] 2. Flaga „polski dostawca”: `suppliers.subiekt_country_id` z `adr_IdPanstwo` (sync przy dopasowaniu kh_Id) + `free_shipping_threshold`, `zd_supplier_order_policy.auto_level` (0–4), `cutoff_time`. Kryterium: test syncu; karta dostawcy pokazuje kraj; liczba PL = Subiekt.
- [ ] 3. Włączenie 10 dostawców z backtestu: `max30_90`, `target_days` 25, `cycle_days` 7, `auto_proposals` (stopień 1). Kryterium: dla każdego propozycja = Policz w Kreatorze tego dnia (diff 0); inni dostawcy bez zmian. **Zmiana danych na produkcji — po zgodzie.**
- [x] 4. Bezpieczniki §3.5 jako flagi linii (`zd_auto_proposals.lines[].flags`): sufit, pik, skok vs 4 ostatnie ZD, nowość > 500 zł, wartość ZD > 2× mediany, brak danych. Kryterium: test jednostkowy per flaga; flagi widoczne w panelu propozycji.
- [x] 5. Minimum i próg darmowej dostawy (§3.4): ZD poniżej progu bez pilnych linii → `deferred`; dopełnienie A/B ≤ 15%. Kryterium: testy na granicach progu.
- [ ] 6. Okno handlowców (stopień 2): statusy `open_for_sales/frozen/held/deferred/sent`, `zd_auto_proposal_events`, prośba z towarem dostawcy → linia propozycji z autorem, limit +50% (bez limitu z ZK), odcięcie 14:00 D−1, sygnał w aplikacji (bez maili), widoczne wszystkie propozycje. Kryterium: e2e — handlowiec dokłada, po 14:00 nie może; zdarzenie w dzienniku.
- [x] 7. Klasy ABC (zysk z `asortyment`, 12 mies.) / XYZ (52 tyg.) → `zd_sku_class`, cron miesięczny; KPI §5 (braki A, rotacja, martwy zapas, korekta człowieka, minima). Kryterium: KPI tygodniowe na panelu zakupów zgodne z ręcznym SQL na próbce.
- [ ] 8. Auto-zatwierdzenie (stopień 3) — ta sama ścieżka co klik (`create_attempted_at`), tylko linie bez flag; najpierw 2–3 dostawcy z korektą < 10% przez 4 cykle. Kryterium: 4 cykle bez duplikatu ZD; automatyczne cofnięcie stopnia po brakach A / nieudanym create.
- [ ] 9. Auto-mail z PDF ZD (stopień 4) przez pocztę dostawców. Kryterium: 4 cykle bez reklamacji.
- [ ] 10. Denon i Amadar: przed stopniem 3 przejrzeć SKU, które w backteście tracą (braki wyższe niż w rzeczywistości).
- [ ] API (Tomasz, równolegle): `sales/weekly` z max-z-dokumentu, cena zakupu, `tw_StanMin/Maks/IdPodstDostawca` w `/products`.

Kolejność: 1 → 3; 6 po 4; 8 po 6 i 4 cyklach pomiaru; 9 po 8.
- Zadania 2, 4, 5, 7 zrobione zespołem (4 sesje), scalone 2026-10-23 po audycie; backtest roczny potwierdził strategię (spec §9). Denon do stopnia 1 do czasu kompletów Vertex.

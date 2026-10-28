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
- [x] 2. (Decyzja 2026-10-23: „polski” = Lokalizacja OnTime POLSKA, kraj z Subiekta tylko kontrola rozjazdu w karcie.) Flaga „polski dostawca”: `suppliers.subiekt_country_id` z `adr_IdPanstwo` (sync przy dopasowaniu kh_Id) + `free_shipping_threshold`, `zd_supplier_order_policy.auto_level` (0–4), `cutoff_time`. Kryterium: test syncu; karta dostawcy pokazuje kraj; liczba PL = Subiekt.
- [ ] 3. Włączenie 10 polskich dostawców (decyzja 2026-10-23): Amadar, Denon, Everall7, Formed, Hansen Dental, Kol-Dental, Makromed, POL-INTECH, Polkard BIS — `max30_90`, cel 25, co 7 dni, stopień 1; **DT Shop — co 14 dni** (wysyłka z Niemiec, backtest §10.4). Bez Ivoclar EXCEL. Wcześniej: `max30_90`, `target_days` 25, `cycle_days` 7, `auto_proposals` (stopień 1). Kryterium: dla każdego propozycja = Policz w Kreatorze tego dnia (diff 0); inni dostawcy bez zmian. **Zmiana danych na produkcji — po zgodzie.**
  - Przed włączeniem: backtest v2 (spec §11) dla każdego z 10 — cel/cykl z rekomendacji, nie stałe 25/7 (DT Shop v2: co 14 / cel 35; Denon: co 7 / cel 40).
  - Od 2026-10-26 (spec §13): backtest sam dobiera cykl i cel, automat włącza się tylko przyciskiem „Włącz automat” w jego wyniku. Dla każdego z 10: Automat ZD → dostawca → Włącz automat → Znajdź najlepsze ustawienia → Włącz. Polkard i DT Shop (już w automacie) mają wyniki sprzed doboru — przeliczyć i przestawić.
- [x] 8. Silnik: podłoga 90 d odejmuje prośby tylko z ostatniego okna profilu (spec §11) — odjąć prośby z każdego z trzech okien 30 d. Kryterium: test — prośba sprzed 45 dni nie podnosi tempa. Zrobione: prośby per okno (`zdProsbaFloorWindowRanges`, bez nakładania okien), backtest i test zgodności to samo; wyniki §11 (DT Shop, Denon) do przeliczenia.
- [x] 4. Bezpieczniki §3.5 jako flagi linii (`zd_auto_proposals.lines[].flags`): sufit, pik, skok vs 4 ostatnie ZD, nowość > 500 zł, wartość ZD > 2× mediany, brak danych. Kryterium: test jednostkowy per flaga; flagi widoczne w panelu propozycji.
- [x] 5. Minimum i próg darmowej dostawy (§3.4): ZD poniżej progu bez pilnych linii → `deferred`; dopełnienie A/B ≤ 15%. Kryterium: testy na granicach progu.
- [ ] 6. Okno handlowców (stopień 2): statusy `open_for_sales/frozen/held/deferred/sent`, `zd_auto_proposal_events`, prośba z towarem dostawcy → linia propozycji z autorem, limit +50% (bez limitu z ZK), odcięcie 14:00 D−1, sygnał w aplikacji (bez maili), widoczne wszystkie propozycje. Kryterium: e2e — handlowiec dokłada, po 14:00 nie może; zdarzenie w dzienniku.
- [x] 7. Klasy ABC (zysk z `asortyment`, 12 mies.) / XYZ (52 tyg.) → `zd_sku_class`, cron miesięczny; KPI §5 (braki A, rotacja, martwy zapas, korekta człowieka, minima). Kryterium: KPI tygodniowe na panelu zakupów zgodne z ręcznym SQL na próbce.
- [ ] 8. Auto-zatwierdzenie (stopień 3) — ta sama ścieżka co klik (`create_attempted_at`), tylko linie bez flag; najpierw 2–3 dostawcy z korektą < 10% przez 4 cykle. Kryterium: 4 cykle bez duplikatu ZD; automatyczne cofnięcie stopnia po brakach A / nieudanym create.
  - Częściowo (PR #239, 2026-10-25): pomiar gotowości 4 tygodni (`src/lib/orders/zd-automat-status.ts`), cofnięcie stopnia po brakach A (migracja 198) i po nieudanym create (`zdAutomatCreateFailRollback`), cykl życia propozycji (199), sekcja „Automat ZD” w panelu dziennym. Brak: samo auto-zatwierdzenie.
- [ ] 9. Auto-mail z PDF ZD (stopień 4) przez pocztę dostawców. Kryterium: 4 cykle bez reklamacji.
- [x] 11. Przebieg w panelu dziennym (spec §14, 2026-10-28): lista automatu z dziś bez przeliczania przy otwarciu, górny panel z zamówieniami na dziś i etapem sprawdzenie → ZD → wysłane, „Wyślij mail” dla ZD bez wysyłki, etap „wysłane” (migracja 200, także „Wysłałem ręcznie”). **Migracja 200 na produkcji — po wdrożeniu (Admin → Migracje).**
- [ ] 12. „Zatwierdź wszystkie bez uwag” w górnym panelu (spec §14.1 A) — krok między stopniem 2 a 3. Kryterium: N propozycji bez flag → N ZD, każde dokładnie raz (blokada `create_attempted_at`), błąd jednego nie zatrzymuje reszty.
- [ ] 10. Przed stopniem 3: zestaw Vertex Orthoplast 4 kg + 2×1 L (bez ZD od roku) — kupowany czy składany w Subiekcie? Składany → komplet „rozpisz na składniki”. Backtest: dodać pary paczka↔sztuka (dziś ich nie modeluje, stąd gorszy Denon).
- [ ] API (Tomasz, równolegle): `sales/weekly` z max-z-dokumentu, cena zakupu, `tw_StanMin/Maks/IdPodstDostawca` w `/products`.

Kolejność: 1 → 3; 6 po 4; 8 po 6 i 4 cyklach pomiaru; 9 po 8.
- Zadania 2, 4, 5, 7 zrobione zespołem (4 sesje), scalone 2026-10-23 po audycie; backtest roczny potwierdził strategię (spec §9).

## Audyt procesu zamówień — poprawki (2026-10-28)

Raport: `docs/audyt-procesu-zamowien-2026-10-28.md`, zmiany: `docs/zamowienia-jeden-silnik.md` §6.

- [x] Zaległe ZD poza „w drodze” + nocne odświeżenie statusów; ZK bez rezerwacji poza wolnym towarem.
- [x] KFS: tabela `subiekt_sales_corrections` (mig. 200), nocny odczyt, odjęcie w silniku (okno + profil).
- [x] Pełny brak w oknie → tempo z profilu; p75 przy 5–9 próbkach czasu dostawy.
- [x] Prośby: rezerwacja zmniejsza prośbę (nie need), odejmowanie przy opakowaniach.
- [x] Podbicie: bez thin_cover/sell_through po mnożniku braków, cel bez zapasMin; skok vs ZD tylko w classic; profil na sprzedaży sprzed mnożnika.
- [x] Dziennik decyzji per linia (mig. 201) + KPI `lineCorrection` + pamięć korekt (cel × mediana, flaga `habit`).
- [x] Panel dzienny „poza planem” liczy towar raz.
- [ ] Produkcja: migracje 200, 201; sprawdzić po pierwszej nocy `[catalog-zd-sync] korekty KFS` i `zaległe ZD` w logu.
- [ ] Powód korekty (klient / promocja / cena / rytm) w oknie „Utwórz ZD” — dziś dziennik bez powodów, więc pamięć korekt nie odróżnia jednorazowej decyzji pod klienta.
- [ ] Prośba dostarczona przed oknem obniża sprzedaż w oknie (L4 w raporcie) — wymaga daty wydania klientowi.
- [ ] Tomasz (API): KFS w `sprzedazOkres`, `zkDataOd` dla ZK bez rezerwacji.
- [x] Karta produktu: „Ruch towaru” (ZD + przyjęcia + sprzedaż w jednej osi, zakres od okna zapasu, min. miesiąc, 3/12 mies., cała historia) i „Starsze zakupy” (cała kopia ZD na żądanie).
- [x] Przegląd całości (28.10): dziennik zapisuje `pattern_factor` (stosunek do surowej propozycji), pamięć korekt poza parami i składami, kroki po indeksie w budżecie slotu `catalog-zd-sync`, przełącznik zakresu z `SegmentedControl`.

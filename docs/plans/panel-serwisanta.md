# Panel Serwisanta — stan prac i co dalej

Gałąź: `claude/exciting-edison-zfp8ar`. Makiety: koncepcja całego panelu
(https://claude.ai/artifact/BjFAJtFwBrTrCRWPzgqfzQ) i sprzęt zastępczy
(https://claude.ai/artifact/S5o19W7FLmKF3Cteqnxk7R).

## Zrobione

### 1. Części serwisowe (flaga w Subiekcie)
- Towary z cechą Subiekta **„Części serwisowe”** są w szacunku ZD w trybie „tylko na prośbę”.
  Zakupy zamawiają je dopiero po prośbie, w ilości z prośby.
- Cechę bierzemy z lokalnego indeksu `subiekt_scope_names` / `subiekt_product_scope_index`
  (odświeża go stock-watch). Nadpisanie id cechy: `app_settings` klucz `service_parts_cecha` = `{ "cechaId": N }`.
- Kreator ZD: odznaka „serwis” przy nazwie, bez akcji „Na prośbę”. Okno „Tylko na prośbę”
  pokazuje tylko wpisy ręczne i licznik części z cechy. Zdjęcie trybu z części serwisowej
  kończy się komunikatem „zdejmij cechę w Subiekcie”.
- Kod: `src/lib/orders/service-parts.ts`, `src/lib/data/service-parts.ts`,
  `src/lib/orders/zd-order-engine.ts`, `src/app/actions/zd-estimate.ts`.

### 2. Ekran `/serwis` — Części serwisowe
- Kafle: do zgłoszenia, brak, poniżej minimum, zgłoszone. Wskaźnik stanu względem minimum,
  grupy z Subiekta, szukanie `/`, odczyt stanów na żywo z `/products?cechaId=`.
- „Zgłoś brak”: okno z ilością (bez wartości domyślnej) i uwagą → prośba (`individual_orders`)
  z uwagą „Zgłoszenie serwisu: …”, na kartę serwisanta albo jedyną kartę „Serwis” w grupie Serwis.
- Kod: `src/app/serwis/`, `src/components/serwis/ServicePartsPanel.tsx`,
  `src/components/serwis/ServicePartReportDialog.tsx`, `src/app/actions/service-parts.ts`.

### 3. Rola `serwis`
- Migracja `207_serwis_role.sql`. Konto wymaga karty handlowca (grupa Serwis).
- Admin → Konta: rola „Serwis” na liście, pole „Karta serwisanta (grupa Serwis)”, opis roli w „Opis ról”.
- Menu konta serwis: cztery pozycje (Zlecenia, Części serwisowe, Sprzęt zastępczy, Katalog modeli), bez zakładek
  na stronach; na telefonie nagłówek z „Wyloguj” i dolna nawigacja z tymi samymi pozycjami. Zakupy, admin
  i magazyn mają te same cztery pozycje w zwijanej sekcji „Serwis”.
- Zabroniona strona prowadzi na start roli (`homePathForUser` → `homePathForRole`); wcześniej serwis i handlowiec
  dostawali `/podsumowanie`, którego nie mogą otworzyć — pętla przekierowań.
- Start i dostęp tylko do `/serwis` i ustawień. Strażnik `requireServicePanel`
  (serwis, magazyn, zakupy, admin). Podpowiedzi klientów/towarów z Subiekta przez
  wąski `requireSubiektSuggestLookup` (bez dostawców, terminów ZD, NIP-ów).

### 4. Sprzęt zastępczy `/serwis/zamienniki`
- Migracja `208_service_loaners.sql`: `service_loaner_units` + `service_loaner_events`
  (historia tylko dopisywana: `ontime_app` ma INSERT/SELECT).
- Kafle modeli, pas „Do zrobienia” (po terminie, zwrot ≤ 3 dni, > 14 dni), oś obłożenia
  8 tyg. wstecz / 3 w przód, lista, panel egzemplarza (licznik dni, statystyki, historia).
- Akcje: dodaj egzemplarz (ZAST-NNN albo SN), wydaj (klient z Subiekta lub ręcznie,
  zwrot 7/14/21/30 dni), przyjmij zwrot (stan techniczny, opcjonalnie do przeglądu),
  przedłuż, przegląd start/koniec. Zmiany stanu w transakcji z `FOR UPDATE`.
- Kod: `src/lib/orders/service-loaners.ts` (+ testy), `src/lib/data/service-loaners.ts`,
  `src/app/actions/service-loaners.ts`, `src/components/serwis/Loaner*.tsx`.

Testy: `npx vitest run src` (zielone), `npx tsc --noEmit`, eslint na zmienionych plikach.
Przegląd uprawnień (agent `authz-reviewer`) bez uwag krytycznych/wysokich.

### 5. Zlecenia serwisowe `/serwis/zlecenia`
- Migracja `209_service_orders.sql`: `service_orders` (numer ZS/RR/MM/NNN, klient z Subiekta albo
  wpisany ręcznie, model z Subiekta albo nazwa spoza kartoteki, SN, usterka, akcesoria, termin dla klienta),
  `service_order_events` (historia tylko dopisywana), `service_order_parts`, `service_model_parts` (BOM).
- Statusy: przyjęte → diagnoza → w naprawie (↔ czeka na część) → gotowe → wydane; anulowanie z powodem.
  Krok wstecz dozwolony, „wydane” i „anulowane” końcowe (`src/lib/orders/service-orders.ts` + testy).
- Lista według tego, co trzeba zrobić: Czeka na część, W serwisie, Gotowe do wydania, Do RW, Zamknięte
  (zwinięte). Kafle z tymi samymi nazwami filtrują listę. Skróty: `/` szukaj, `P` przyjmij sprzęt.
- Panel zlecenia: oś postępu (`StatusStepper`), przyciski przejść, opis prac, części, RW, zamiennik, historia
  (`EventTimeline`). Powiązanie z zamiennikiem: egzemplarz wydany na tablicy (najpierw ten u klienta);
  panel egzemplarza pokazuje numer zlecenia, a przy „gotowe” zlecenie przypomina o odbiorze zamiennika.
  Zwrot egzemplarza odpina go od zlecenia (zdarzenie w historii zlecenia); jeden egzemplarz — jedno zlecenie.
- Rola serwis startuje na zleceniach. Widoki serwisu to pozycje menu bocznego (bez zakładek na stronach).

- Przyjęcie: po wyborze klienta z Subiekta lista „Sprzęt klienta z faktur i paragonów” — pozycje jego
  FS (`/documents/fs?kh_id=`) i PA (`/documents/pa?odbiorcaId=`) z 10 lat z numerem seryjnym w Uwagach
  („N. numer” = pozycja N, prefiks „S/N:” pomijany; wiersze bez numeru należą do poprzedniej, o ile cały
  wiersz wygląda na numer — adres z paragonu nie). Usługi (`tw_Rodzaj = 2`, np. licencje z kluczem)
  odpadają. Klik w numer wpisuje model i numer seryjny (`src/lib/subiekt/client-equipment*.ts`).
  Ograniczenie: paragony detaliczne idą na zbiorczego kontrahenta (994 z 1000 sprawdzonych) — klient
  detaliczny nie ma ich pod swoją kartoteką.

### 5a. Panel zlecenia idzie za krokiem (`serviceOrderPanelView`)
| Status | Co widać | Krok główny |
|---|---|---|
| Przyjęte | usterka, akcesoria, zamiennik na górze; bez części i notatki | Zacznij diagnozę |
| Diagnoza | „Co ustaliła diagnoza”, pobieranie części (najpierw katalog modelu) | Zacznij naprawę |
| W naprawie | „Opis prac”, części | Oznacz jako gotowe |
| Czeka na część | pasek „Czeka na: N szt. część · od … · prośba do zakupów: status”; wejście pyta o część i może złożyć prośbę (ta sama co „Zgłoś brak”, uwaga „Zgłoszenie serwisu: ZS/…”) | Wznów naprawę |
| Gotowe do wydania | „Zadzwoń do klienta” (tel:), **Dokumenty**: faktura za naprawę (FS klienta z 90 dni, numer ręcznie albo „bez faktury” z powodem) + RW na części | Wydaj klientowi (zdanie pod nim mówi, czego brakuje) |
| Wydane | podsumowanie; brakujące dokumenty da się uzupełnić | — |
| Anulowane | powód; części tylko do oddania albo RW | — |

Braki dokumentów tylko ostrzegają: zamknięte zlecenie bez faktury (lub „bez faktury”) albo z częściami bez RW
jest w grupie „Brak dokumentów”. Migracja `210_service_orders_documents.sql`.

### 6. Części do zlecenia i RW (wystawiane ręcznie)
- „Pobierz część”: najpierw katalog modelu, potem dowolny towar z Subiekta (tw_Id sprawdzany w Subiekcie).
  „Zapamiętaj w katalogu modelu” dopisuje część do BOM. Część można oddać, dopóki nie ma RW.
- Części bez RW odejmują się od „dostępne” w Częściach serwisowych („N pobrane bez RW”).
- „Do RW”: pozycje zsumowane po towarze, „Kopiuj pozycje (symbol, ilość)”, numer RW z Subiekta → zlecenie
  rozliczone. Zamknięte bez RW zostają na liście „Do RW”, aż ktoś wpisze numer.
  Numer RW wpisuje się od „gotowe do wydania” — wcześniej kolejna część nie miałaby gdzie trafić.

### 7. Katalog części modeli `/serwis/modele`
- Model + część z Subiekta + zwykła ilość; podpowiedź modeli, które były w naprawie, a nie mają katalogu.

### 8. Drobne
- Zamienniki: „Wycofaj egzemplarz” (z powodem), model sprawdzany w Subiekcie przy dodaniu,
  wspólna oś historii `EventTimeline` (components/ui).
- Zgłoszenia braku dostają dostawcę od razu: przypięty w Kreatorze ZD, inaczej ostatni z historii ZD
  (na kopii dev 39 z 99 części); bez źródła — Weryfikacja jak dotąd.
- Kreator ZD: część z cechą, która ma też ręczny wpis, jest traktowana jak część serwisowa (odznaka,
  brak „Na prośbę”, odmowa zdjęcia przed kasowaniem — notatka zostaje).
- Zamienniki po terminie: odznaka przy „Sprzęt zastępczy” w menu i pasek na pozostałych stronach serwisu (bez maila).

## Uruchomienie lokalne

```bash
npm ci
npm run db:migrate
npm run dev
```

1. Admin → Zespół → Handlowcy: karta **„Serwis”** w grupie **Serwis**.
2. Admin → Użytkownicy → Nowe konto: rola **Serwis**, karta „Serwis”.
3. W Subiekcie: cecha „Części serwisowe” na częściach. Indeks cech odświeża stock-watch
   (albo Kreator ZD → synchronizacja zakresów).

## Do zrobienia

1. **RW przez mostek Subiekta**: dziś RW wystawia się ręcznie (źródła mostka nie ma w tym repo).
   Gdy mostek dostanie `/documents/rw/create`, „Do RW” może je tworzyć jednym kliknięciem.
2. **Wydruk potwierdzenia przyjęcia** — świadomie pominięty (decyzja: tylko zapis w OnTime).
3. Produkcja: migracje `207`, `208`, `209`, `210`, karta i konto „Serwis”.

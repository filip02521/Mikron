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

1. **Zlecenia serwisowe** (`/serwis/zlecenia`): przyjęcie sprzętu klienta, statusy
   (przyjęte → diagnoza → w naprawie → czeka na część → gotowe → wydane), powiązanie
   z wydanym zamiennikiem.
2. **Pobranie części do zlecenia i RW na każde zlecenie.** Mostek Subiekta umie dziś tylko
   `/documents/zd/create`. Decyzja: dopisać RW do mostka (OnTime wystawia z podglądem)
   albo na start liczyć zużycie w OnTime, a RW wystawiać ręcznie.
3. **Katalog części dla modelu (BOM)**: przypięcie części do modelu sprzętu, podpowiedzi
   w panelu pobrania.
4. Sprzęt zastępczy, drobne:
   - przycisk „Wycofaj egzemplarz” (status `wycofany` jest w bazie),
   - weryfikacja `twId` w Subiekcie przy dodaniu egzemplarza,
   - poranne powiadomienie o egzemplarzach po terminie,
   - wspólny komponent osi historii (`EventTimeline`) zamiast lokalnej listy w panelu.
5. Zgłoszenia serwisu trafiają do „Weryfikacji”, bo prośba nie ma dostawcy. Do decyzji:
   automatyczne przypisanie dostawcy z karty towaru.
6. Kolejność w Kreatorze ZD: wpis ręczny „tylko na prośbę” dla części serwisowej jest
   kasowany przed odmową zdjęcia trybu (`actionClearZdEstimateOnRequest`). Nieszkodliwe,
   ale można odwrócić kolejność.
7. Produkcja: migracje `207` i `208`, karta i konto „Serwis”.

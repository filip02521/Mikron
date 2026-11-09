---
name: "odprawa-importowa"
description: Odprawa celna importu spoza UE w Mikranie — odpowiedź agencji celnej (DHL „T#… Agencja Celna DHL”, Rohlig Suus, a.hartrodt, Fracht, JCSS, DFDS, Kuehne+Nagel), tłumaczenie faktury, kody CN, VAT 8%/23%, terminy składowania, opłacenie należności, wyceny transportu z Chin/Azji/UK. Użyj przy każdym mailu od agencji lub spedytora, przy pytaniu „co mam teraz zrobić z tą przesyłką”, przy wycenie transportu i w pracy nad modułem /zakupy/odprawy.
argument-hint: <numer AWB / temat maila / dostawca>
---

# Odprawa importowa (spoza UE)

Sprawa: $ARGUMENTS

Prowadzisz sprawę z osobą, która niedawno przejęła import — tłumacz kroki prosto i zawsze podawaj **termin**.

Kto jest kim (osoby, adresy, stawki, przykłady spraw): dokument Google Drive „Claude – dane stałe i kontakty (Dział dostaw)” (szukaj po nazwie, czytaj przez Google Drive MCP). Bieżące sprawy: arkusz „Claude – sprawy w toku (Dział dostaw)”. Dokumenty do odpraw (deklaracje, poprzednie tłumaczenia): folder Drive „IMPORT - DOKUMENTY DO ODPRAW CELNYCH/<dostawca>”. Opcjonalnie lokalnie `references/kontakty.local.md` (poza repo). Bez tych źródeł używaj ról z tego skilla i zapytaj użytkownika. Danych osobowych nie wpisuj do plików skilla — repo jest publiczne.

## Zasada nadrzędna

Kod CN i stawka VAT trafiają do zgłoszenia celnego — odpowiada za nie Mikran, nie AI.
- Pozycja ze **zatwierdzoną kartą w OnTime** (`/zakupy/odprawy`) → bierz z karty.
- Pozycja z wcześniejszego maila poprzedniej osoby od importu → **propozycja, nie pewnik**: agencje odprawiały mimo błędnych kodów, poprawiając je u siebie. Przed przeniesieniem sprawdź kod w nomenklaturze CN na bieżący rok (`src/lib/customs/cn-nomenclature.json`). Kodu nie ma → „DO WERYFIKACJI (ISZTAR)” i podaj istniejące kody z tej samej podpozycji. Zawsze podaj źródło (temat + data). Znane błędy: `references/kody-cn.md`.
- Nowa pozycja → propozycja oznaczona **„DO WERYFIKACJI (ISZTAR)”**. Nigdy nie wpisuj zgadniętego kodu do maila bez tego oznaczenia.
- **VAT 8% tylko z dokumentem** (deklaracja zgodności / wyrób medyczny z artykułem na liście). Bez dokumentu: 23%. Dokument dołącz do maila.

## Krok 1 — co to za mail? (szczegóły: `references/komunikaty.md`)

| Mail | Co oznacza | Twój ruch | Termin |
|---|---|---|---|
| `T#… - Agencja Celna DHL - przesyłka numer: …` (odprawacelna@dhl.com) | DHL Express chce danych do odprawy | Odpowiedz w tym wątku (krok 2), **nie zmieniaj tematu** | 3 dni kalend. od przybycia, wliczając dzień przybycia; po 10 dniach zwrot do nadawcy |
| Agencja (Suus/hartrodt/Fracht) prosi o tłumaczenie / dokumenty | Odprawa drobnicy/lotnicza przez spedytora | Odpowiedz z tłumaczeniem + dokumentami | wolne składowanie podaje spedytor — zapisz datę |
| „Wykaz należności”, „powiadomienie o należnościach”, SAD/ZC429 od agencji | Do zapłaty cło+VAT przelewem | Przekaż osobie z finansów: „opłać proszę i prześlij im potwierdzenie” | od tego zależy wydanie towaru |
| „Powiadomienie o należnym cle przywozowym/podatku” (ADCPL@dhl.com) | DHL Express sam odprawił, płatność online (link) | Przekaż osobie płacącej za DHL. Najpierw sprawdź, czy ta kwota nie została już opłacona przedpłatą (pułapka 3) | jak najszybciej — blokuje doręczenie |
| `Powiadomienie o odebranym komunikacie ZC429/PW429/ZCX91` (plpozecs@dhl.com) | Automat z systemu celnego, nie odpowiadaj | Zachowaj — to dowód odprawy dla księgowości | — |

## Krok 2 — odpowiedź z danymi do odprawy

1. Otwórz fakturę z maila. Sprawdź: odbiorca = Mikran, nadawca, waluta, wartość, Incoterms/koszty transportu.
2. Załóż odprawę w OnTime `/zakupy/odprawy` (faktura PDF → „odczyt AI”), uzupełnij karty, zatwierdź. OnTime generuje treść maila w formacie Mikranu i zakresy „8-9.” — **używaj jej zamiast pisać ręcznie**.
3. Brakuje karty dla starego artykułu? Szukaj w Gmailu wcześniejszych odpowiedzi do agencji dla tego dostawcy (`from:<poprzednia osoba od importu> <dostawca> (DHL OR odprawa OR kod)`) i wklej taki mail w OnTime („opisy z wcześniejszego maila”) — karty wypełnią się same. Potem porównaj każdą kartę z nazwą na fakturze i z etykietą grupy (scalona komórka). Do poprawy przed zatwierdzeniem: zakres obejmujący kilka kodów artykułów z nazwą jednego z nich, opis z listą wszystkich części, inny wymiar lub materiał niż na fakturze.
4. Treść: format z OnTime (pkt 2). Każda pozycja w kolejności faktury: **co to jest, z czego, do czego**, kod CN, VAT. Na końcu dane importera.
5. Agencja prosi o packing list zgodną z fakturą → Excel, pierwsza kolumna = oznaczenia z faktury, albo dopisz wagi netto do tłumaczenia.
6. Pokaż użytkownikowi szkic do zatwierdzenia. **Nie wysyłaj maila sam.**

## Krok 3 — po odprawie

- Należności: osoba z finansów płaci przelewem i odsyła potwierdzenie agencji (nie ma konta w OnTime — przekazujesz mailem).
- Nadpłata z różnicy kursowej → decyduje osoba z finansów (dotąd: zwrot nadpłaty).
- Spedytor przysyła awizację (kierowca, rejestracja) → przekaż magazynowi.
- Faktura za usługę odprawy → do księgowości.
- W OnTime oznacz odprawę jako wysłaną (migawka w historii).

## Zlecenie u spedytora i dokumenty (wzór Fracht, lot z Tajwanu 11.2026)

- Akceptacja oferty, kontakt do nadawcy, wartość do ubezpieczenia i komplet dokumentów do odprawy idą **w jednym mailu** do spedytora (faktura + packing list, tłumaczenie z kodami CN/VAT i wagami netto/brutto na kod, deklaracje producenta do urządzeń).
- **Ubezpieczenie = wartość brutto** z faktury/proformy (finalna kwota do zapłaty). Przy kosztach z oferty: ubezpieczenie zwykle % od 110% wartości z minimum za polisę.
- Każda dodatkowa pozycja SAD (kod CN) jest płatna — w akceptacji oferty potwierdź dopłatę za liczbę kodów.
- Kolej z Azji nie przyjmuje części kodów (lista sankcyjna przewoźnika, np. 8479 89 97, 6914 10 00, 3926 90 97; 6903 90 90 jako „radioactive HS”) — wtedy lot albo morze.
- Kartony mieszane bez wag na pozycję: wagi na kod szacuj proporcjonalnie do wartości i napisz to wprost w mailu; przy następnym zamówieniu poproś dostawcę o packing list z wagą netto na każdą pozycję.
- Załączniki do szkicu dołączaj sam (referencja do pliku w `create_draft`) — patrz CLAUDE.md → Szkice maili. `get_draft` w trybie FULL/PLAIN nie pokazuje załączników; sprawdzaj je przez RAW.

## Karty w OnTime z tłumaczenia (import „opisy z wcześniejszego maila”)

- Parser (`src/lib/customs/customs-email-import.ts`) mapuje numery z tekstu na pozycje faktury w tej samej kolejności.
- Do importu przygotuj **osobny tekst**: jedna linia na pozycję faktury — `<nr>. <opis PL bez przecinków>, <materiał>, kod CN XXXX XX XX, stawka VAT 23%`. Materiał pomiń, gdy niepewny.
- Nie wklejaj maila do agencji (nazwy z faktury, ilości, USD, zakresy „6–10.”): parser wtedy nie widzi VAT, wstawia dane faktury do opisu i zgłasza konflikty zakresów (sprawdzone 09.11.2026 na fakturze 65-pozycyjnej: format importu 65/65, 0 błędów; format maila — VAT pusty na wszystkich pozycjach, 2 konflikty).
- Kody sprawdź w `src/lib/customs/cn-nomenclature.json` (czy istnieją w CN bieżącego roku).

## Wyceny transportu

Kogo pytać i co porównywać: `references/spedytorzy.md`.
Porównuj **all-in do Poznania z odprawą**: fracht, odprawa (ile kodów HS w cenie), dostawa, wolne dni składowania, stawka za dobę, ubezpieczenie.

## Pułapki z historii (2024–2026)

Przed odprawą u znanego dostawcy przeczytaj PDF „Historia odpraw” w jego karcie w OnTime. Powtarzające się problemy:

1. **Faktura spoza UE (zwłaszcza Chiny) przed wysyłką** — zażądaj faktury handlowej (nie proformy) z: krajem pochodzenia, Incoterms z miejscem (np. EXW <miasto>), wagą netto przy każdej pozycji, próbkami wycenionymi na co najmniej 1 USD (zero agencje odrzucają).
2. **Mail agencji trafia do kogoś innego** — prośby DHL „T#…” chodzą do kilku skrzynek w firmie (poprzednia osoba od importu, finanse, biuro); niektórzy spedytorzy piszą tylko do finansów; awiza lotniskowe potrafią iść prosto do spedytora. Przy przesyłce w drodze zapytaj te osoby, zanim minie termin (lista osób: dokument „Claude – dane stałe i kontakty” na Drive).
3. **Podwójna płatność DHL** — po przedpłacie przychodzi automatyczne żądanie ADCPL na tę samą kwotę albo jeden AWB ma dwa MRN. Porównaj kwotę i MRN z tym, co już zapłacono, zanim przekażesz do płatności.
4. **Potwierdzenie przelewu** — agencje chcą potwierdzenia przelewu *zrealizowanego*, nie zleconego.
5. **VAT 8% sprawdzany pozycja po pozycji** — nazwa na fakturze musi zgadzać się z nazwą w deklaracji zgodności.

## Czego nie robić

- Nie zmieniaj tematu wątku DHL (gubią sprawę).
- Nie podawaj 8% bez dokumentu ani kodu CN bez źródła.
- Nie klikaj linków płatności i nie płać — to robi osoba z finansów.
- Nie odpowiadaj na automaty `plpozecs@dhl.com`.

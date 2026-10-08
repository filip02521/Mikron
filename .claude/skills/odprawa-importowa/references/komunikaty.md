# Komunikaty celne i od agencji — jak je czytać

Źródło: korespondencja z agencjami celnymi 2024–2026. Gdy trafisz na nowy typ maila, dopisz go tutaj (bez danych osobowych — te idą do `kontakty.local.md`).

## DHL Express — małe przesyłki lotnicze (AWB 10 cyfr)

Kolejność typowej sprawy:

1. **`T#1PO… - Agencja Celna DHL - przesyłka numer: <AWB>`** od `odprawacelna@dhl.com`
   - W załączniku faktura (`<AWB>.INV…pdf`) i list przewozowy (`<AWB>.AWB…pdf`).
   - Chcą: (1) potwierdzenia danych z faktury (odbiorca, nadawca, wartość, waluta, Incoterms),
     (2) tłumaczenia każdej pozycji po kolei: co to, z jakiego materiału, do czego służy,
     (3) danych importera: pełna nazwa, adres, NIP — zgodnych z fakturą.
   - Składowanie płatne **po 3 dniach kalendarzowych** liczonych od dnia przybycia na magazyn, wliczając ten dzień.
   - Brak dokumentów przez **10 dni** → zwrot do nadawcy.
   - Przychodzi też `[T#…] Automatyczna Odpowiedź` od `no-reply@dhl.com` — potwierdzenie, że odpowiedź dotarła. Nic nie rób.
   - DHL wysyła je na adresy podane przez importera w upoważnieniu. Sprawdź, czy obecna osoba od importu jest na liście (`kontakty.local.md`). Zmiana adresów: formularz z maila DHL / dhlexpress.pl/slownik-importowy („Aktualizacja danych firmy”).
2. **`Powiadomienie o odebranym komunikacie ZCX91 / ZC429 / PW429 - dot. AWB <AWB> <MRN>`** od `plpozecs@dhl.com`
   - Automaty z systemu celnego (WinSADMS). Numer `26PL44302D00…` to numer zgłoszenia (MRN).
   - ZC429 przychodzi po zakończonej odprawie, z PDF/XML zgłoszenia — dokument do księgowości.
   - Dokładnego znaczenia ZCX91 i PW429 w tej korespondencji nie potwierdzono — jeśli to ważne, zapytaj agencję zamiast zgadywać.
   - Od 01.07.2026 nie ma zwolnienia z cła dla przesyłek do 150 EUR (informacja DHL w stopce automatów).
3. **`Powiadomienie o należnym cle przywozowym/podatku`** od `ADCPL@dhl.com`
   - Kwota do zapłaty + link do płatności online (karta/BLIK). Blokuje doręczenie.
   - Przekaż osobie płacącej za DHL; wcześniej sprawdź, czy kwota nie jest już opłacona przedpłatą.

## Spedytorzy — przesyłki lotnicze (MAWB 3+8 cyfr) i morskie/drobnica

Typowa kolejność (przesyłka lotnicza ze spedytorem):

1. Spedytor zgłasza przylot i przysyła **wycenę obsługi w PL z dostawą do Poznania** → potwierdzasz („Tak, proszę działać”).
2. Podaje okres wolny od składowania. Zwykle kilka dni od przylotu, potem stawka za kg wagi płatnej i dobę z minimum. **Zapisz datę.**
3. Wysyłasz dokumenty + tłumaczenie z kodami CN i VAT.
4. Agencja (AC) zgłasza braki. Przykład: oznaczenia na fakturze ≠ packing list → odesłać packing listę w Excelu z oznaczeniami jak na fakturze albo dopisać wagi netto.
5. „Wykaz należności celno-podatkowych” + SAD + ZC429 → osoba z finansów płaci przelew i odsyła potwierdzenie.
6. Awizacja dostawy: kierowca, telefon, rejestracja → magazyn.
7. Faktura za odprawę.

UK (po Brexicie to import), drobnica: tłumaczenie → deklaracja zgodności → powiadomienie o należnościach (płatność **przed** zgłoszeniem) → przelew i potwierdzenie → „towar po odprawie” → doręczenie → faktura za odprawę. Należności liczone po kursie z dnia wyliczenia; gdy zgłoszenie jest w innym miesiącu, wychodzi drobna nadpłata lub niedopłata.

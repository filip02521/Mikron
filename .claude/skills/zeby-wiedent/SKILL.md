---
name: "zeby-wiedent"
description: Rozbicie faktur Wiedent (Wytwórnia Zębów Sztucznych Wiedent, Łódź) za zęby akrylowe Estetic na klapki „6” (przód) i „8” (bok) do wpisania w fakturze zakupu. Użyj przy każdej fakturze FS-xxx/26 / FV nnnn od Wiedent, przy pytaniu „ile klapek”, „co mam wpisać na fakturę”, „co jest przodem a co bokiem”, oraz przy kontroli liczenia magazynu (ilość „6” i „8”).
argument-hint: <faktury Wiedent (PDF z KSeF / zdjęcie + wklejka) + łączne klapki „6” i „8” z magazynu + nr ZD>
---

# Zęby Wiedent: klapki do wpisania

Faktury: $ARGUMENTS

## Fakty

- Dostawca: Wytwórnia Zębów Sztucznych Wiedent Sp. J., Łódź, NIP 727-101-99-08. Produkt na fakturze zawsze „Zęby akrylowe Estetic <kolor>”, j.m. szt, cena 1,47 netto/ząb, VAT 8%.
- Faktura nie mówi, która linia to przód, a która bok.
- Klapka = jedna płytka zębów. Przód: 6 zębów. Bok: 8 zębów. Magazyn liczy klapki „6” i „8”.
- Mikran wpisuje fakturę zakupu w klapkach: „6” po 8,82 netto, „8” po 11,76 netto.

## Co użytkownik przysyła (i czego NIE wymagać)

1. Faktury Wiedent – najlepiej PDF z KSeF; może być zdjęcie + wklejka linii, byle z tabelą VAT do kontroli.
2. Łączne klapki „6” i „8” z magazynu na CAŁĄ dostawę (np. z kartki: „6” 121×18=2178, „8” 165×12=1980).
3. Nr ZD – do kontroli ceny za ząb.

NIE proś o liczenie magazynu per faktura ani per kolor – użytkownik przysyła faktury właśnie po to, żeby to rozpisać (decyzja Filipa 09.11.2026).

## Dlaczego wystarczy suma z magazynu

Każdy ząb kosztuje 1,47, więc faktura zgadza się co do grosza przy KAŻDYM podziale, w którym klapki „6” × 6 + klapki „8” × 8 = zęby z faktury. Podział między faktury nie zmienia kwot. Wystarczy więc:
- suma klapek = magazyn,
- per faktura: zęby z klapek = zęby z faktury.

## Procedura

1. Spisz wszystkie linie każdej faktury (ilość + kolor). Kontrola: suma ilości × 1,47 = netto z tabeli VAT. Nie zgadza się = brakuje linii – poproś o resztę.
2. Kontrola: klapki z magazynu „6”×6 + „8”×8 = suma zębów z faktur. Nie zgadza się = magazyn albo faktury niekompletne – zatrzymaj się i pokaż różnicę.
3. Uruchom skrypt z `--mag` (i `--cena` z ZD, jeśli znana). Skrypt:
   - dzieli linie regułą: wielokrotność 108 = „6”, podzielne przez 8 = „8”, podzielne tylko przez 6 (306, 186, 36, 18…) = „6” (nietypowe);
   - różnicę z magazynem przesuwa grupami 24 zębów (4 klapki „6” ↔ 3 klapki „8”), najpierw na fakturę z nietypowymi liniami, potem na największą;
   - drukuje per faktura klapki, netto, VAT, brutto i sprawdza netto = zęby × 1,47.
4. Oddaj tabelę „co wpisać”: faktura, klapki „6” × 8,82, klapki „8” × 11,76, netto, VAT, brutto + suma. Napisz, na którą fakturę poszła różnica z magazynem (to umowne, kwot nie zmienia).
5. Cena w ZD ≠ 1,47 za ząb → napisz wprost, że ZD trzeba poprawić (09.11.2026: zła cena w ZD dała 30 zł różnicy przy wpisie).

## Uruchomienie

```
python3 -I .claude/skills/zeby-wiedent/scripts/klapki.py --mag 2178 1980 --cena 1,47 plik.txt
```

Format pliku:

```
FV 1021
480 G2
768 G2
...
FV 1024
108 B2
```

## Historia reguły

- FS-910/912/913 (07.10.2026): reguła 108 dała dokładnie liczenie magazynu (1134 / 1104).
- FV 1021 + 1024 (09.11.2026): reguła dała 2074 / 2058, magazyn 2178 / 1980 – część linii 96/192/288… była przodem. Reguła jest tylko punktem startu; rozstrzyga liczenie magazynu.

## Pułapki

- Ręczne sumy bywają z literówką (FS-912: napisane 1755, faktyczne 1752). Ufaj skryptowi.
- VAT licz od sumy faktury, nie per linia.
- Przy wpisie osobnych faktur nie wpisuj sumy z kartki magazynu na jedną fakturę – rozpisz wg tabeli.
- Różnica kwoty przy wpisie przy zgodnych klapkach = zła cena za ząb w ZD albo cena brutto zamiast netto.

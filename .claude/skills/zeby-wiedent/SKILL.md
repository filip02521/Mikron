---
name: "zeby-wiedent"
description: Rozbicie faktur Wiedent (Wytwórnia Zębów Sztucznych Wiedent, Łódź) za zęby akrylowe Estetic na przody i boki oraz przeliczenie sztuk na klapki do wpisania w fakturze zakupu. Użyj przy każdej fakturze FS-xxx/26 od Wiedent, przy pytaniu „co jest przodem a co bokiem”, „ile klapek”, „rozpisz zęby per linia”, oraz przy kontroli liczenia magazynu (ilość „6” i „8”).
argument-hint: <zdjęcia/skan faktur Wiedent + liczby z magazynu, jeśli są>
---

# Zęby Wiedent: przody, boki, klapki

Faktury: $ARGUMENTS

## Fakty

- Dostawca: Wytwórnia Zębów Sztucznych Wiedent Sp. J., Łódź, NIP 727-101-99-08. Produkt na fakturze zawsze „Zęby akrylowe Estetic <kolor>”, j.m. szt, cena 1,47 netto/ząb, VAT 8%.
- Faktura nie mówi, która linia to przód, a która bok. Kolor (A1, A2, G2, R1, N3...) też nie.
- Klapka = jedna płytka zębów. Przód: 6 zębów. Bok: 8 zębów. Magazyn liczy klapki „6” i „8”.
- Mikran wpisuje fakturę zakupu w klapkach, nie w zębach.

## Reguła podziału (potwierdzona na FS-910/912/913 z 07-10-2026)

Linia to **przód** gdy ilość jest wielokrotnością 108 (108, 216, 324, 432, 540, 648, 756...). Każda inna linia to **bok** (96, 112, 128, 192, 256, 288, 368, 384, 480...).

Dlaczego: przód pakowany po 18 klapek (108 zębów), bok po 12 klapek (96) plus luzy. Zweryfikowane na 15636 zębach: reguła dała dokładnie to, co magazyn policzył ręcznie (1134 klapek „6”, 1104 klapek „8”).

Przeliczenie:
- przód: klapki = ilość / 6, cena 8,82 netto (9,53 brutto)
- bok: klapki = ilość / 8, cena 11,76 netto (12,70 brutto)

## Procedura

1. Spisz wszystkie linie każdej faktury: LP, kolor, ilość. Faktura może mieć więcej stron niż na zdjęciu. Sprawdź: suma ilości × 1,47 = wartość netto z tabeli VAT. Nie zgadza się = brakuje linii, poproś o resztę (podgląd e-Faktury z KSeF w WAPRO pokazuje wszystko).
2. Wpisz linie do `scripts/klapki.py` (format poniżej) i uruchom. Skrypt dzieli, liczy klapki, wartości i sumy, sprawdza sumę netto.
3. Jeśli magazyn podał liczby „6” i „8”: suma przód ÷ 6 i suma bok ÷ 8 muszą się zgadzać co do sztuki. Nie zgadzają się = linia niestandardowa, nie naginaj reguły, pokaż różnicę i linie, które mogą być obie (podzielne przez 24).
4. Oddaj per faktura tabelę: LP, kolor przód/bok, klapki, cena netto, wartość netto, oraz podsumowanie klapek przód/bok. Bez słowa „garnitur”, użytkownik zna „klapki”.

## Format wejścia do skryptu

```
FS-912/26
216 A2
128 A2
...
FS-910/26
216 R1
108 R1
```

Uruchomienie: `python3 -I .claude/skills/zeby-wiedent/scripts/klapki.py plik.txt` albo wejście ze stdin. Opcjonalnie `--mag 1134 1104` (klapki „6” i „8” z magazynu) dla kontroli.

## Pułapki

- Ręczne sumy na fakturze bywają z literówką (FS-912: napisane 1755, faktyczne 1752). Ufaj skryptowi, nie długopisowi.
- 216, 432, 648 dzielą się przez 8, ale są przodem (wielokrotność 108). 288, 384, 480 dzielą się przez 6, ale są bokiem. Reguła 108 ma pierwszeństwo nad samą podzielnością.
- VAT licz od sumy faktury, nie per linia, inaczej grosze się rozjadą.
- Nowa ilość spoza listy (np. 144, 240): zastosuj regułę 108, ale oznacz linię jako „do potwierdzenia” i sprawdź z liczeniem magazynu.

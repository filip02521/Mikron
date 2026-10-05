# API Subiekta — ustawianie cen według cennika dostawcy

**Dla:** Tomasz (API Subiekta)
**Host testowy:** `http://192.168.0.140:5082/api/v1` (najpierw tu), potem live `:5080`
**Kontekst:** OnTime → Zakupy → Cenniki. Użytkownik wgrywa cennik dostawcy (np. Ivoclar, 2814 pozycji), OnTime dopasowuje towary po `tw_Symbol` w obrębie cechy dostawcy, pokazuje różnice, a po zatwierdzeniu zapisuje ceny w Subiekcie.
**Data:** 2026-10-05, API v2.1.2

---

## 1. Czego potrzebujemy

Dla każdego dopasowanego towaru OnTime ustawia **dwie ceny netto, obie dokładnie z cennika**:

| Poziom | Nazwa w Subiekcie | Źródło w cenniku | Przykład (531664) |
|---|---|---|---|
| 0 | Kartotekowa (`tc_CenaNetto0`) | Cena Dealer netto PLN | 43,07 |
| 4 | detaliczna (`tc_CenaNetto4`) | Cena detaliczna netto PLN | 67,30 |

Cena detaliczna ma być **wartością z cennika co do grosza**, a nie wynikiem przeliczenia przez narzut.

## 2. Co jest dziś i dlaczego nie wystarcza

Sprawdzone na `:5082` 2026-10-05:

| Wywołanie | Poziom 0 | Poziom 4 | Problem |
|---|---|---|---|
| `PUT /products/7/price/catalog` (SQL, `recalculatePrices=true`) | 42,53 ✔ | 66,19, bez zmian | detaliczna zostaje stara |
| `PUT /products/49/price/catalog?use_sfera=true` | 43,07 ✔ | 67,28 | z narzutu 56,22% wychodzi 67,28, cennik ma 67,30 |

Narzut przy towarze nie jest stały: 472 z 1510 towarów Ivoclar mają inny niż 56,25%. Przeliczenie przez narzut nigdy nie da dokładnie ceny z cennika.

Dodatkowa niespójność: po zapisie SQL `tc_CenaBrutto0` = 45,93, po zapisie przez Sferę `tc_CenaBrutto0` = 0,00.

---

## 3. Wymagane: `PUT /products/{id}/prices`

Ustawia wskazane poziomy cen jawnie. Zalecany zapis przez Sferę, żeby Subiekt sam przeliczył brutto, narzut, marżę i zysk **z podanej ceny netto**, a nie odwrotnie.

### Body

```json
{
  "levels": [
    { "level": 0, "netto": 43.07 },
    { "level": 4, "netto": 67.30 }
  ],
  "expected": [
    { "level": 0, "netto": 42.37 },
    { "level": 4, "netto": 66.19 }
  ]
}
```

| Pole | Wymagane | Opis |
|---|---|---|
| `levels[]` | tak, min. 1 | poziomy do ustawienia; `level` 0–10, `netto` > 0, maks. 2 miejsca po przecinku |
| `expected[]` | nie | ceny, które OnTime widział przy podglądzie; gdy w bazie jest inna wartość, zwróć **409** i niczego nie zapisuj |

Poziomy spoza `levels[]` zostają **bez zmian**. Nie przeliczaj ich według ceny kartotekowej.

### Zachowanie

1. Zapis wszystkich podanych poziomów jednego towaru jest **atomowy**: zapisuje się wszystko albo nic.
2. `tc_CenaNettoN` = dokładnie podana wartość, bez zaokrąglania przez narzut.
3. `tc_CenaBruttoN` = netto × (1 + VAT sprzedaży towaru), zaokrąglone do 0,01, dla **każdego** ustawianego poziomu, także poziomu 0.
4. Narzut, marża i zysk poziomów sprzedaży przeliczone z nowych cen netto, tak jak w oknie „Kalkulacja cen”.
5. Odpowiedź zwraca stan **odczytany z bazy po zapisie**, a nie echo requestu.

### Odpowiedź 200

```json
{
  "data": {
    "tw_Id": 49,
    "tw_Symbol": "531664",
    "before": [
      { "level": 0, "netto": 42.37, "brutto": 0.00 },
      { "level": 4, "netto": 66.19, "brutto": 71.49, "narzut": 56.22 }
    ],
    "after": [
      { "level": 0, "netto": 43.07, "brutto": 46.52 },
      { "level": 4, "netto": 67.30, "brutto": 72.68, "narzut": 56.26 }
    ]
  },
  "meta": { "useSfera": true, "elapsedMs": 750 }
}
```

`before` pozwala OnTime zapisać historię i w razie potrzeby cofnąć zmianę tym samym endpointem.

### Błędy

| HTTP | Kiedy |
|---|---|
| 404 | brak towaru |
| 409 | `expected` nie zgadza się z bazą; w body aktualne ceny |
| 422 | niepoprawne body: `netto` ≤ 0, więcej niż 2 miejsca po przecinku, nieznany poziom, duplikat poziomu |
| 423 | towar zablokowany do edycji w Subiekcie, np. otwarty u innego użytkownika |
| 503 | brak SQL / Sfery |

Format błędu jak w [`subiekt-errors.md`](./subiekt-errors.md).

---

## 4. Wymagane: odczyt cen wielu towarów naraz

Dziś podgląd cennika Ivoclar to 1510 osobnych wywołań `GET /products/{id}/price/catalog`. Potrzebujemy listy:

`GET /products/prices/catalog?cechaId=2738&page=1&pageSize=200`

Filtry jak w `GET /products` (`cechaId`, `grupaId`, `symbol`, `search`, `page`, `pageSize`). Każdy element ma ten sam kształt co `GET /products/{id}/price/catalog` (`tw_Id`, `tw_Symbol`, `tw_Nazwa`, `levels[]`), uzupełniony o `vat.stawka` sprzedaży i `tw_Zablokowany`.

---

## 5. Opcjonalnie: zapis wsadowy

`POST /products/prices/batch` z body `{ "items": [ { "tw_Id": 49, "levels": [...], "expected": [...] } ] }`, maks. 200 pozycji.

- Każda pozycja zapisuje się niezależnie: błąd jednej nie zatrzymuje pozostałych.
- Odpowiedź: `results[]` z `tw_Id`, `status` (`ok` / kod błędu) i `before` / `after` jak w punkcie 3.

Bez tego OnTime woła punkt 3 po kolei: przy ~0,75 s na pozycję 1510 pozycji to ok. 19 minut. Da się z tym żyć, więc to nie blokuje.

---

## 6. Testy akceptacyjne (na `:5082`)

| # | Towar | Wywołanie | Oczekiwane |
|---|---|---|---|
| 1 | 531664 (`tw_Id` 49) | `levels` 0 = 43,07, 4 = 67,30 | po `GET`: poziom 0 = 43,07, poziom 4 = 67,30 co do grosza; brutto obu > 0 |
| 2 | 531686 (`tw_Id` 7) | tylko `levels` 0 = 42,53 | poziom 4 bez zmian (66,19) |
| 3 | jw. | `expected` z nieaktualną ceną | 409, w bazie nic się nie zmienia |
| 4 | jw. | `netto` = 0 albo 12,345 | 422 |
| 5 | towar z narzutem ≠ 56,25% | poziom 4 z cennika | zapisana dokładnie wartość z cennika, narzut przeliczony |
| 6 | dowolny | zapis, potem zapis wartościami z `before` | stan identyczny jak przed pierwszym zapisem (cofanie) |

Towary 7 i 49 na `:5082` mają już ustawioną kartotekową z testu OnTime. To nie przeszkadza w testach.

---

## 7. Po stronie OnTime (nie wymaga zmian w API)

- Dopasowanie cennika do towarów po `tw_Symbol` tylko w obrębie cechy dostawcy.
- Podgląd różnic, próg „podejrzanej” zmiany, zatwierdzenie przez użytkownika.
- Historia zmian w PostgreSQL: `before` i `after`, kto, kiedy, z którego pliku.
- Weryfikacja po zapisie: ponowny odczyt (punkt 4) i porównanie z cennikiem.

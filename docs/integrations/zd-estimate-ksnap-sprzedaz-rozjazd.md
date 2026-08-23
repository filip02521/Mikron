# Raport: rozjazd sprzedaży K-Snap (Subiekt Informator vs OnTime / API)

**Produkt:** Piny K-Snap kpl.op/100szt.  
**Symbol:** `14061000`  
**`tw_Id`:** `7598`  
**Okres:** 2026-06-21 → 2026-08-19 (60 dni)  
**Data weryfikacji:** 2026-08-20  

---

## W skrócie (o co chodzi)

**OnTime nie liczy sprzedaży samodzielnie.** Bierze gotową liczbę z API Subiekta (`sprzedazOkres`) i pokazuje ją w kolumnie **Sprzed.**

| Źródło | Sprzedaż |
|--------|----------|
| Subiekt **Informator** (zakładka Sprzedaż) | **39 szt** |
| Subiekt **API** `GET /orders/zd/estimate` | **27 szt** |
| **OnTime** Kreator ZD | **27 szt** |

Różnica: **12 szt**.  
**Knyf nie jest w OnTime** — OnTime pokazuje to samo, co API. Rozjazd jest między **Informator GT** a **tym, co API zwraca w `sprzedazOkres`** (tu: zera na pozycjach FS; PA/WZ nie tłumaczą różnicy 12).

---

## Na czym polega knyf

Informator sumuje **ilości widoczne w GT** na fakturach sprzedaży.

API estimate buduje `sprzedazOkres` z **FS+PA+WZ**; w tym case’ie WZ=0, a braki to **`ob_Ilosc: 0` na pozycjach FS**.

Na **trzech fakturach** Informator pokazuje sprzedaż K-Snap (10 + 1 + 1 = **12**), ale w API te same linie mają:

- `ob_Ilosc: 0`
- `ob_CenaNetto: 0`
- `ob_CenaBrutto: 0`

przy czym **nagłówek faktury ma normalną wartość** (`dok_WartNetto` > 0), a często **wszystkie pozycje w API mają ilość 0**.

Czyli: dokument „żyje” w Subiekcie (wartość, Informator), ale endpoint `GET /documents/fs/:id` zwraca wyzerowane ilości pozycji — i właśnie z tych zer liczy się estimate.

---

## Dokumenty — zestawienie 1:1

Wszystkie 7 FS z Informatora dla K-Snap w tym okresie:

| Nr FS | Data | Ilość w Informatorze | `ob_Ilosc` w API | Wchodzi do 27? |
|-------|------|----------------------|------------------|----------------|
| FS 4436/M/08/2026 | 2026-08-11 | 5 | **5** | tak |
| FS 4089/M/07/2026 | 2026-07-31 | 10 | **0** | **nie (−10)** |
| FS 3971/M/07/2026 | 2026-07-31 | 1 | **0** | **nie (−1)** |
| FS 3698/M/07/2026 | 2026-07-29 | 10 | **10** | tak |
| FS 1202/M/07/2026 | 2026-07-09 | 2 | **2** | tak |
| FS 3828/M/06/2026 | 2026-06-30 | 1 | **0** | **nie (−1)** |
| FS 3463/M/06/2026 | 2026-06-25 | 10 | **10** | tak |

- Suma Informator: **39**  
- Suma API (`ob_Ilosc > 0`): **27**  
- Brak: **12 = 10 + 1 + 1** (4089 + 3971 + 3828)

---

## Dowód na „złych” fakturach

### FS 4089/M/07/2026 (`dok_Id` 1833837)

- Informator: **10 szt** K-Snap @ 52,69 netto  
- API: linia `tw_Id=7598` ma `ob_Ilosc: 0`  
- Dokument: **100 pozycji, wszystkie z ilością 0**, ale `dok_WartNetto ≈ 11 190`

### FS 3971/M/07/2026 (`dok_Id` 1833570)

- Informator: **1 szt**  
- API: `ob_Ilosc: 0`  
- **15 pozycji, wszystkie qty = 0**, `dok_WartNetto ≈ 1 585`

### FS 3828/M/06/2026 (`dok_Id` 1816991)

- Informator: **1 szt**  
- API: `ob_Ilosc: 0`  
- **22 pozycje, wszystkie qty = 0**, `dok_WartNetto ≈ 1 139`

Dla porównania „zdrowa” faktura:

### FS 4436/M/08/2026

- Informator: **5 szt**  
- API: `ob_Ilosc: 5`  
- Wszystkie pozycje z ilościami > 0 — spójne.

---

## Co OnTime robi (i czego nie robi)

1. Woła `GET /orders/zd/estimate` z `towarId=7598`, `dataOd`, `dataDo`, `dniZapasu=60`.  
2. Bierze `sprzedazOkres` **bez własnego sumowania FS**.  
3. Dla tego towaru **nie ma** pary pack↔piece ani BOM — nic nie dokłada i nic nie odejmuje od sprzedaży.  
4. Opakowanie (10 szt/op) wpływa na **Do ZD**, nie na kolumnę **Sprzed.**

Potwierdzone live:

```text
GET /orders/zd/estimate?towarId=7598&dataOd=2026-06-21&dataDo=2026-08-19&dniZapasu=60
→ sprzedazOkres: 27
→ wzNiepowiazaneOkres: 0   (K-Snap: rozjazd Informator ≠ WZ; to FS z ob_Ilosc=0)
```

Dla porównania SKU z udziałem WZ (np. `605332` w innym oknie): `sprzedazOkres` obejmuje FS+PA+WZ, a `wzNiepowiazaneOkres` to breakdown — OnTime **nie** dolicza WZ drugi raz.

Uwaga poboczna: **Cel 24,55** i „65%” przy Do ZD to **sales-track** (korekta celu zamówienia), nie zmiana sprzedaży. Sprzed. nadal = 27.

---

## Hipotezy przyczyny (po stronie Subiekta)

1. **API czyta złe pole ilości** (np. inne niż Informator / inna jednostka / pole po korekcie).  
2. **Bug serializacji** `dok_Pozycja` — ilości zerowane mimo wartości nagłówka (widać na całych dokumentach 4089/3971/3828).  
3. **Stan dokumentu / typ linii** — Informator bierze inną miarę (np. z magazynu, z powiązanego WZ, z oryginalnej ilości przed korektą).  
4. Mniej prawdopodobne: problem tylko K-Snap — bo na tych FS **wszystkie** linie mają qty 0, nie tylko K-Snap.

---

## Prośba do osoby od Subiekta / API

1. Otwórz w GT: **FS 4089, 3971, 3828** — skąd Informator bierze ilości K-Snap (10 / 1 / 1)?  
2. Porównaj z `GET /documents/fs/{id}` — dlaczego `ob_Ilosc = 0` przy niezerowym `dok_WartNetto`?  
3. Sprawdź SQL estimate (`sprzedazOkres`) — czy sumuje to samo co Informator, czy tylko `ob_Ilosc`?  
4. Cel: żeby **Informator = estimate API = OnTime** dla tego samego `tw_Id` i okna dat.

---

## Podsumowanie jednym zdaniem

**OnTime pokazuje 27, bo API zwraca 27; Informator pokazuje 39, bo na trzech FS widzi ilości, których API ma jako zera — to rozjazd Subiekt Informator ↔ API, nie błąd Kreatora ZD.**

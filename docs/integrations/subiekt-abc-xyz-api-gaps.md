# Braki API Subiekta pod ABC/XYZ + ROP/EOQ (OnTime)

**Dla:** Tomasz (API Subiekta)  
**Host:** `http://192.168.0.140:5080/api/v1`  
**Kontekst:** szacunek ZD w OnTime (`/zakupy/szacunek`) + planowana matryca ABC/XYZ i algorytmy zamówień (Wilson / ROP / Croston / Min-Max).  
**Stan obecny OnTime:** model pokrycia w dniach na polach `GET /orders/zd/estimate` — **nie** ABC/XYZ, **nie** EOQ, **nie** ROP.  
**Podział OT ↔ API:** [`subiekt-abc-xyz-architecture.md`](./subiekt-abc-xyz-architecture.md)

Cel tego dokumentu: konkretna lista endpointów / pól, bez których nie da się wdrożyć specyfikacji ABC/XYZ + EOQ „w pełni”.

**Weryfikacja (2026-08-11):** treść zsynchronizowana z kodem OnTime (`zd-estimate-manual`, `types`, `subiekt.md`). Semantyka SQL estimate (FS vs WZ, definicja `otwarteZd`) pochodzi z kontraktu / zachowania API Subiekta — OnTime konsumuje gotowe pola, nie liczy ich samodzielnie.

---

## 1. Co już mamy i wystarczy (nie wymaga nowych endpointów)

| Potrzeba ze speca | Skąd dziś | Uwagi |
|---|---|---|
| Zapas fizyczny | `tw_Stan` w estimate / products | OK |
| Zapas dostępny (po rez.) | `dostepne` (gdy brak: OnTime liczy `tw_Stan − tw_StanRez`) | To jest baza cover w OT |
| Rezerwacje | `tw_StanRez`, `otwarteZkZarezerwowane`, `otwarteZkBezRez` | OnTime qty **nie** dokłada ZK do „Do ZD” — ZK tylko informacyjnie; wzór API `doZamowienia` nadal zawiera `otwarteZkBezRez` |
| Zamówione w drodze (przybliżenie) | `otwarteZd` | Po fixie API: ZD z **terminem realizacji w przyszłości**. Cover / „in transit”. **Jednostki = jednostki dokumentu ZD** (paczki przy opakowaniu) — OnTime mnoży × `unitsPerPackage` do sztuk |
| Średni popyt dzienny (przybliżenie) | `sprzedazDziennie`, albo `sprzedazOkres / dniOkresu` | Gotowa **suma w oknie** z estimate (wg API: FS). **Nie** seria tygodniowa → za mało do CV/σ |
| Pack size (częściowo) | OnTime: `zd_estimate_packaging` + `zd_product_pairs` (ręczne / sync) | Brak `GET /products/komplety` na hoście ORDERS |
| Lead time średni (przybliżenie) | OnTime `delivery_stats` (per **dostawca**) | Używane do **ETA zamówień klientów**, **nie** do qty w szacunku ZD dziś. Brak σ_L; brak L per SKU z API |
| Horyzont zapasu w szacunku | `suppliers.stock_raw` / `stock` → `dniZapasu` | To **„na ile dni trzymać zapas”**, nie lead time \(L\) i nie interwał zamówień (`interval_*`). Interwał dostawcy = kalendarz kolejnego zamówienia, osobna rzecz |

Wzór estimate (API — komentarz w typach OnTime):

```text
doZamowienia ≈ max(0, celZapasu + otwarteZkBezRez − dostepne − otwarteZd)
```

OnTime (lista „Do ZD” — bez ZK):

```text
doZamowieniaReczne = max(0, ceil(celTracked − dostepne − otwarteZdPieces))
```

gdzie `otwarteZdPieces` = jednostki ZD z API × opakowanie (gdy ustawione).

`celZapasu` z API ≈ `(sprzedazOkres / dniOkresu) × dniZapasu + zapasMin`  
(`celTracked` = ten cel po korektach sales-track / historii snapshotów w OnTime).

**Cover w OnTime (przybliżenie „effective stock” do decyzji qty):**

```text
cover ≈ dostepne + otwarteZdPieces
```

`dostepne` zwykle już netto względem rezerwacji magazynowych. To **nie** jest pełny wzór speca `onHand + inTransit − reserved` rozpisany na osobne składowe — stąd prośba o jedną udokumentowaną definicję po stronie API (sekcja P2).

---

## 2. Mapowanie etapów speca → skąd dane

### Etap 1 — ABC/XYZ (raz / miesiąc, 12 mies. sprzedaży)

| Input | Spec | Mamy w API? | Co trzeba |
|---|---|---|---|
| Obrót wartościowy | `Σ qty × cena` | ❌ estimate daje qty w oknie, bez wartości | seria + **cena jednostkowa** (zakup **lub** sprzedaż — decyzja biznesowa dla osi ABC) |
| `avg_weekly_demand` | AVG tygodni | ❌ | bucket tygodniowy 52+ (z tygodniami zerowymi) |
| `stddev_weekly_demand` | STDDEV tygodni | ❌ | to samo |
| `CV = σ / mean` | XYZ | ❌ | liczy OnTime **po** dostaniu serii |
| Ranking ABC 80/95 | cumulative revenue | ❌ | OnTime po `total_revenue` |

**Wniosek:** bez endpointu serii tygodniowej (lub gotowej klasyfikacji) matrycy **nie da się** policzyć wiarygodnie.

Matryca ABC/XYZ ma żyć w OnTime i być odświeżana okresowo — ale **źródło sprzedaży musi przyjść z API** (agregacja w MSSQL). Teoretycznie dałoby się złożyć serie z `GET /documents/fs` + linie — przy tysiącach SKU i 12 mies. to niewykonalne operacyjnie; potrzeba endpointu agregującego.

### Etap 2A — grupa X (ROP + EOQ)

| Input | Spec | Mamy? | Gdzie dodać |
|---|---|---|---|
| `avg_daily_demand` \(\bar d\) | tak | ~`sprzedazDziennie` | OK jako start; lepiej z serii |
| `std_daily_demand` \(\sigma_d\) | tak | ❌ | z serii dziennej/tygodniowej |
| Lead time \(L\) | tak | ~`delivery_stats` (średnia, dostawca; **poza** estimate) | API: historia ZD → avg; dziś **nie** podłączone do qty |
| \(\sigma_L\) | tak | ❌ | historia realizacji ZD (wystawienie → przyjęcie/termin) |
| Service level Z | A/B/C | n/a | **konfiguracja OnTime** |
| \(D\) roczny | EOQ | przybliżenie `sprzedazDziennie×365` | lepiej z 12 mies. |
| \(S\) koszt złożenia ZD | EOQ | ❌ w Subiekcie zwykle brak | **OnTime / admin** |
| \(H = C × i\) | EOQ | ❌ brak \(C\) w typach products/estimate | API: **cena zakupu**; \(i\) w OnTime |
| Warunek `effective ≤ ROP` | tak | częściowo | dziś OT zawsze liczy niedobór względem `celTracked` (horyzont zapasu), **nie** względem ROP z \(L\) |

Uwaga: **`dniZapasu` ≠ \(L\)**. Dziś cel = tempo × horyzont zapasu dostawcy. ROP ze speca = tempo × lead time + SS. To dwa różne parametry.

### Etap 2B — grupa Y (Holt-Winters / Prophet)

| Input | Mamy? | Potrzeba API |
|---|---|---|
| Szereg czasowy sprzedaży | ❌ | ta sama seria tygodniowa/miesięczna |
| Regresory (promocje, święta) | ❌ | raczej OnTime / kalendarz PL — nie Subiekt |
| `forecast_lead_time_demand` | ❌ | OnTime po serii (API nie musi robić Prophet) |

### Etap 2C — grupa Z (Croston / Min-Max)

| Input | Mamy? | Potrzeba |
|---|---|---|
| Interarrival + size (Croston) | ❌ | seria z dużą liczbą zer (gęsta siatka tygodni) |
| `max_stock_level` | ❌ | **OnTime** (parametr biznesowy) |

### Etap 3 — logistyka

| Input | Mamy? | Potrzeba API |
|---|---|---|
| Pack size | częściowo OT (`zd_estimate_packaging`, pary) | `GET /products/komplety` |
| MOQ | ❌ | nowe pole / endpoint **albo** jasny komunikat „brak w Subiekcie” |
| Effective stock | częściowo (`dostepne + otwarteZd` w szt.) | jedna udokumentowana definicja / opcjonalnie pola składowe |

---

## 3. Konkretne endpointy do wdrożenia po stronie API (priorytety)

### P0 — blokuje matrycę ABC/XYZ i σ popytu

#### `GET /orders/sales/weekly` *(nowy — rekomendowany)*

Agregacja sprzedaży **per `tw_Id` × tydzień** z ostatnich N miesięcy (domyślnie 12).

**Query:**

| Parametr | Opis |
|---|---|
| `dataOd`, `dataDo` | Zakres (albo np. `miesiac=12`) |
| `grupaId` \| `cechaId` \| `towarId` | XOR zakresu jak w estimate (opcjonalnie cały katalog stronami) |
| `page`, `pageSize` | Paginacja |
| `dokTyp`? / źródło | **Jawnie w docs:** domyślnie FS (`dok_Typ=2`); czy WZ wchodzi / dedup FS↔WZ |
| `anulowane` | domyślnie `false` |

**Wiersz odpowiedzi:**

```json
{
  "tw_Id": 17449,
  "tw_Symbol": "…",
  "weekStart": "2025-08-04",
  "qty": 12.0,
  "revenueNetto": 1234.56,
  "revenueZakup": 980.00
}
```

**Wymagania jakościowe dla XYZ:**

- Albo zwracać **tygodnie z qty=0** (pełna siatka w zakresie), albo w docs napisać, że klient musi densyfikować zera — bez zer CV jest zaniżone.
- `weekStart` = poniedziałek (ISO) albo inna stała reguła — **jedna**, udokumentowana.

**Dlaczego:** OnTime zbuduje `avg`, `stddev`, `CV`, ABC (po revenue) i klasy XYZ **u siebie** (matryca w OT, refresh okresowy).

**Alternatywa P0b** (jeśli logika klasyfikacji ma być w API):

`GET /orders/abc-xyz?okres=12m&grupaId=…` →

```json
{
  "tw_Id": 17449,
  "abc_class": "A",
  "xyz_class": "X",
  "total_revenue": 120000.0,
  "avg_weekly": 40.0,
  "stddev_weekly": 8.0,
  "cv": 0.2
}
```

Wewnętrznie i tak potrzebna ta sama agregacja tygodniowa — **lepiej najpierw dać raw weekly**.

---

#### Rozszerzenie `GET /orders/zd/estimate` *(opcjonalne, ale bardzo przydatne)*

Dla każdego SKU w odpowiedzi dorzucić (bez zmiany starego wzoru `doZamowienia`):

| Nowe pole | Znaczenie |
|---|---|
| `sprzedazStdDziennie` | \(\sigma_d\) w oknie `dataOd–dataDo` |
| `sprzedazCvTygodniowe` | CV z bucketów tygodniowych w oknie / 12m |
| `cenaZakupu` | cena zakupu jednostki (do \(H\) w EOQ; opcjonalnie ABC) |
| `cenaSprzedazy` | opcjonalnie do ABC „obrót sprzedaży” |
| `moq` | min. ilość zamówienia (jednostki ZD lub sztuki — **udokumentować**) |
| `packSize` | jeśli jest w Subiekcie; inaczej `null` → OT |
| `otwarteZd` | już jest; dopisać w OpenAPI: **tylko ZD z terminem w przyszłości** (+ status otwarty) + jednostki dokumentu |

To **nie zastąpi** `/orders/sales/weekly` (estimate ma jedno okno sumaryczne, nie 52 tygodnie), ale przyspieszy ROP na liście „Policz”.

---

### P1 — EOQ (Wilson) i koszt utrzymania

#### Cena zakupu na towarze

**Opcja A:** rozszerzyć `GET /products/:id` i listę `/products` (dziś typy OT nie mają ceny):

```json
{
  "tw_Id": 1,
  "tw_Symbol": "…",
  "cenaZakupuNetto": 12.34,
  "cenaSprzedazyNetto": 19.99
}
```

**Opcja B:** pole w estimate / w weekly (`revenueZakup`).

- **EOQ:** bez ceny zakupu \(C\) nie ma sensownego \(H = C \times i\).
- **ABC:** wystarczy **jedna** oś wartościowa (cena sprzedaży **lub** zakupu) — decyzja biznesowa; obie w weekly ułatwiają porównanie.
- \(S\) (koszt złożenia zamówienia) i \(i\) (np. 15–20%) → **konfiguracja OnTime**, nie API.

---

### P1 — Lead time + \(\sigma_L\) (Safety Stock)

#### `GET /orders/lead-time/stats` *(nowy)*

Per `kh_Id` (dostawca) i opcjonalnie per `tw_Id`:

**Query:** `khId`, `towarId?`, `dataOd`, `dataDo`, `page`, `pageSize`

**Odpowiedź:**

```json
{
  "kh_Id": 123,
  "tw_Id": null,
  "sampleCount": 40,
  "leadTimeAvgDays": 12.5,
  "leadTimeStdDays": 3.2,
  "leadTimeP50": 11,
  "leadTimeP90": 18
}
```

**Definicja lead time (do uzgodnienia w docs API):**

- start: `dok_DataWyst` ZD **albo** data wysłania,
- koniec: realne przyjęcie (PZ) **albo** `dok_TerminRealizacji` (gorzej).

OnTime ma średnie w `delivery_stats` (ETA handlowe), ale **bez σ** i **bez użycia w szacunku ZD**. Ten endpoint domyka wzór Safety Stock ze speca:

\[
SS = Z \times \sqrt{L \cdot \sigma_d^2 + \bar{d}^2 \cdot \sigma_L^2}
\]

---

### P1 — Pack size z Subiekta (już w backlogu OT)

#### `GET /products/komplety` *(brakuje)*

Źródło SQL: `tw_Komplet` (`kpl_Id`, `kpl_IdKomplet`, `kpl_IdSkladnik`, `kpl_Liczba`).

**Query:** `kompletId?`, `skladnikId?`, `page`, `pageSize`

**Wiersz:**

```json
{
  "kpl_Id": 1,
  "kompletTwId": 10,
  "skladnikTwId": 20,
  "liczba": 100,
  "kompletSymbol": "…",
  "skladnikSymbol": "…"
}
```

Potrzebne do sync par pack↔piece (`zd_product_pairs`) i pack size.  
OnTime sync (`filterKompletyForZdProductPairSync`) akceptuje tylko komplety z **dokładnie 1 składnikiem** i całkowitą `liczba` **≥ 2**.

---

### P1 — MOQ

#### Pole MOQ na towarze / u dostawcy

**Preferencja:**

- `moq` na `GET /products/:id`, **lub**
- `GET /kontrahenci/dostawcy/:khId/towary` z `{ tw_Id, moq, packSize, cenaZakupu }`

Jeśli w MSSQL nie ma MOQ — napisać wprost w docs: „brak w Subiekcie → OnTime table”. Wtedy etap 3 działa częściowo (tylko pack).

---

### P2 — jakość popytu (FS vs WZ)

Estimate dziś (kontrakt / zachowanie API): **suma FS (`dok_Typ=2`)** w polu `sprzedazOkres`. OnTime **nie** wybiera typu dokumentu — bierze gotową sumę.

Do ABC/EOQ warto w docs/API:

1. Parametr `zrodloPopytu=fs|wz|fs_plus_wz_dedup`, **albo**
2. Osobne pola: `sprzedazFs`, `sprzedazWz`, `sprzedazNetto` (po deduplikacji).

Bez tego matryca ABC może systematycznie zaniżać / zawyżać obrót względem rzeczywistości magazynowej.

Ten sam wybór źródła powinien obowiązywać `GET /orders/sales/weekly`.

---

### P2 — effective stock „jak w specu”

Albo dokumentacja estimate, albo nowe pola:

| Pole | Mapowanie dziś (przybliżenie OT) |
|---|---|
| `stockOnHand` | `tw_Stan` |
| `stockReserved` | `tw_StanRez` (+ ewentualnie ZK z rez.) |
| `stockAvailable` | `dostepne` (zwykle stan − rez.) |
| `stockInTransit` | `otwarteZd` (jednostki dok.; po fixie terminu) |
| `effectiveStock` | jedna definicja, np. `dostepne + otwarteZd` **albo** `onHand + inTransit − reserved` — **wybrać jedną i opisać** |

---

## 4. Czego **nie** trzeba w API Subiekta

| Element | Gdzie |
|---|---|
| Progi ABC 80/95, XYZ 0.3/0.7 | OnTime config |
| Z-score service level (A/B/C) | OnTime |
| \(S\), \(i\) (holding %) | OnTime (per dostawca) |
| Holt-Winters / Prophet / XGBoost | OnTime (po serii z API) |
| Min-Max `max_stock_level` | OnTime |
| Persist matrycy ABC/XYZ + cron miesięczny | OnTime (Supabase) |
| Create ZD | już: `POST /documents/zd/create` |
| Korekty „sales track” / historia snapshotów ZD | już w OnTime (nie API) |

---

## 5. Minimalny zestaw „żeby w ogóle ruszyć matrycę w OT”

1. **`GET /orders/sales/weekly`** (12m, qty + wartość + `tw_Id`, zera tygodniowe) — **must**
2. **Wartość jednostkowa** — cena sprzedaży **lub** zakupu w weekly / products — **must dla ABC**; **cena zakupu must dla EOQ \(H\)**
3. Docs OpenAPI: semantyka **`otwarteZd`** (termin w przyszłości + jednostki dok.) — fix qty po stronie API zrobiony; warto utrwalić w docs
4. **`GET /products/komplety`** — pack size / pary (P1 — nie blokuje samej matrycy ABC/XYZ)
5. **`moq`** — jeśli jest w bazie (P1)
6. **`GET /orders/lead-time/stats`** (avg + std) — pełny SS / ROP ze speca (P1; matrycę ABC/XYZ da się zrobić bez tego)

Bez (1)+(2) matryca ABC/XYZ w OT będzie zgadywaniem na jednym oknie estimate.

---

## 6. Przykłady curl

```bash
# P0: serie tygodniowe (cecha / grupa / towar) — kontrakt proponowany
curl -s 'http://192.168.0.140:5080/api/v1/orders/sales/weekly?cechaId=123&dataOd=2025-08-01&dataDo=2026-08-01&page=1&pageSize=200'

# P1: lead time
curl -s 'http://192.168.0.140:5080/api/v1/orders/lead-time/stats?khId=456&dataOd=2024-01-01&dataDo=2026-08-01'

# P1: komplety
curl -s 'http://192.168.0.140:5080/api/v1/products/komplety?page=1&pageSize=200'

# Estimate — jak woła OnTime (dataOd/dataDo/dniZapasu); API bywa też z okres=rok
curl -s 'http://192.168.0.140:5080/api/v1/orders/zd/estimate?towarId=17449&dataOd=2025-08-01&dataDo=2026-08-01&dniZapasu=30&page=1&pageSize=50'
curl -s 'http://192.168.0.140:5080/api/v1/orders/zd/estimate?towarId=17449&okres=rok'
```

---

## 7. Podział odpowiedzialności

```text
Subiekt API                          OnTime
─────────────────────                ─────────────────────────────
weekly sales + revenue        →      ABC/XYZ table (cron /mies.)
cena zakupu/sprzedaży, moq,   →      EOQ H, pack, MOQ
  komplety
otwarteZd, stany, FS okna     →      cover / qty (dziś); later ROP
lead-time avg/std             →      SS, ROP (gdy podłączymy L ≠ dniZapasu)
                                     S, i, Z, max_stock, modele Y/Z
                                     sales-track, snapshoty historii
                                     UI szacunku / create ZD
```

---

## 8. Checklist dla API (do odhaczenia)

- [ ] `GET /orders/sales/weekly` — qty + revenue per `tw_Id` × tydzień (12m), reguła zer / `weekStart`
- [ ] Docs: źródło popytu FS / WZ / dedup (estimate + weekly spójnie)
- [ ] Cena zakupu i/lub sprzedaży (`/products` i/lub estimate / weekly)
- [ ] OpenAPI: semantyka `otwarteZd` (termin w przyszłości + jednostki dokumentu)
- [ ] `GET /products/komplety`
- [ ] Pole / endpoint MOQ (albo jasny komunikat „brak w Subiekcie”)
- [ ] `GET /orders/lead-time/stats` (avg + std, per kh / opcjonalnie tw)
- [ ] (Opcjonalnie) rozszerzenie pól estimate: `sprzedazStdDziennie`, `cenaZakupu`, `moq`, `packSize`
- [ ] (Opcjonalnie) `effectiveStock` albo jedna udokumentowana formuła z istniejących pól

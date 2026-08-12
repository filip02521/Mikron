# Podział odpowiedzialności: OnTime ↔ API Subiekta (ABC/XYZ + ROP/EOQ)

**Dla:** Filip / Tomasz  
**Powiązane:** [`subiekt-abc-xyz-api-gaps.md`](./subiekt-abc-xyz-api-gaps.md) (czego brakuje w endpointach)  
**Cel:** jak **najlepiej** rozdzielić pracę między OnTime a API (`http://192.168.0.140:5080/api/v1`), żeby system działał wydajnie, dał się utrzymać i nie dublował logiki.

---

## 1. Werdykt (jedna zasada)

> **API Subiekta = fakty i ciężkie agregacje z MSSQL.**  
> **OnTime = decyzja zakupowa, parametry biznesowe, lista „Do ZD”, UI, create.**

Nie odwrotnie.

| | Subiekt API | OnTime |
|---|---|---|
| **Jest blisko** | bazy dokumentów / stanów (miliony wierszy) | procesu zakupów, dostawców, opakowań, próśb |
| **Robi dobrze** | `GROUP BY`, sumy, otwarte ZD, lead-time z historii ZD | ABC/XYZ, ROP/EOQ, progi, wyjątki, create ZD |
| **Nie powinien** | liczyć EOQ / Prophet / „czy zamawiać” | skanować wszystkie FS linia-po-linii przez HTTP |

**Lista towarów do pracy zawsze powstaje w OnTime** (zakres grupa/cecha + wykluczenia + UI).  
API **dokłada dane** do tego zakresu — nie generuje „gotowego zamówienia” bez kontekstu OT.

---

## 2. Dlaczego taki podział

### 2.1. Wydajność

- Agregacja 12 miesięcy FS po `tw_Id × tydzień` w SQL na hoście Subiekta: **sekundy**.
- To samo przez OnTime (`GET /documents/fs` + strony + sklejanie): **minuty / timeouty**, kruche przy pełnym katalogu.
- Estimate (`GET /orders/zd/estimate`) już pokazuje właściwy wzorzec: API zwraca **gotowe sumy na SKU**, OT robi qty i UI.

### 2.2. Kontekst biznesowy jest w OnTime

OnTime już ma (i będzie miał więcej):

- dostawca → `dniZapasu` ze **stock** (horyzont zapasu),
- interwał zamówień (kalendarz — osobno od lead time \(L\)),
- wykluczenia, opakowania, pary pack↔piece, BOM,
- prośby handlowców (rezerwa w Do ZD),
- snapshoty historii ZD + sales-track,
- parametry, których nie ma w Subiekcie: \(S\), \(i\), Z-score, Min-Max, progi ABC/XYZ.

Gdyby API liczyło finalne qty EOQ, przy każdej zmianie progu / \(S\) trzeba by redeploy API albo trzymać konfigurację w dwóch miejscach.

### 2.3. Audyt i iteracja

Matryca ABC/XYZ w Supabase (OT):

- widać historię klas („dlaczego ten SKU jest A-X”),
- można ręcznie nadpisać klasę / wyłączyć algorytm,
- cron miesięczny bez ruszania serwisu Subiekta.

### 2.4. Zgodność z ustaleniami

Tomasz: matryca towaru **po stronie OT**, aktualizowana okresowo.  
Filip: potrzebne **dodatkowe dane z API** — nie „przenieść cały algo do API”.

---

## 3. Mapa odpowiedzialności (szczegółowo)

### 3.1. Warstwa danych (Subiekt API)

| Odpowiedzialność | Endpoint / mechanizm | Uwagi |
|---|---|---|
| Sprzedaż w oknie (suma) | `GET /orders/zd/estimate` → `sprzedazOkres`, `sprzedazDziennie` | już jest (FS) |
| Stany / dostępne / rez. | estimate + `/products` | już jest |
| Otwarte ZD (cover / in transit) | `otwarteZd` | już jest (termin w przyszłości) |
| Serie tygodniowe 12m | **`GET /orders/sales/weekly`** (do wdrożenia) | **must** pod ABC/XYZ |
| Wartość (cena × qty) | weekly / products | must pod ABC; cena zakupu must pod EOQ \(H\) |
| Pack z kompletów | **`GET /products/komplety`** | sync par w OT |
| MOQ | pole produktu / dostawcy | jeśli jest w MSSQL |
| Lead time avg + σ | **`GET /orders/lead-time/stats`** | pod SS / ROP |
| Create dokumentu | `POST /documents/zd/create` | już jest |

API **nie** przechowuje klas A-X / B-Y i **nie** zna wykluczeń OnTime.

### 3.2. Warstwa decyzji (OnTime)

| Odpowiedzialność | Gdzie w OT (kierunek) | Uwagi |
|---|---|---|
| Wybór zakresu (grupa/cecha) + Policz | `/zakupy/szacunek` | jak dziś |
| Wykluczenia, opakowania, pary, BOM, zęby | tabele + workbench | jak dziś |
| Persist matrycy ABC/XYZ | nowa tabela Supabase + cron | raz / miesiąc |
| Progi ABC/XYZ, Z-score, \(S\), \(i\) | config / admin | nie w API |
| Wybór algorytmu wg segmentu | silnik qty | X / Y / Z |
| ROP, SS, EOQ, Min-Max, (później) Croston/HW | silnik qty | na danych z API |
| Korekty sales-track / historia snapshotów | już istnieją | zostają jako warstwa „nad” bazowym celem |
| Lista Do ZD + create + confirm LIVE | workbench | jak dziś |
| Kalendarz „kiedy klikać Policz” | `interval_*` dostawcy | **nie** mylić z ROP |

### 3.3. Czego świadomie **nie** wrzucać do API

- EOQ / ROP / Safety Stock jako jedyny wynik `doZamowienia`
- Prophet / XGBoost / Holt-Winters
- Progi ABC 80/95 i XYZ 0.3/0.7 (chyba że osobny endpoint diagnostyczny — i tak OT powinien móc policzyć sam z weekly)
- Wykluczenia zakupów, prośby, opakowania OT
- Decyzja create ZD

---

## 4. Docelowa architektura procesu

```text
┌─────────────────────────────────────────────────────────────────┐
│                         OnTime (Supabase)                        │
│  dostawcy, stock→dniZapasu, wykluczenia, pack, pary, prośby,    │
│  parametry S/i/Z, matryca ABC/XYZ, snapshoty ZD                   │
└───────────────┬─────────────────────────────▲───────────────────┘
                │                             │
     (A) cron miesięczny              (B) Policz / create
                │                             │
                ▼                             │
┌─────────────────────────────────────────────┴───────────────────┐
│                    API Subiekta :5080 / ORDERS                   │
│  sales/weekly · estimate · komplety · lead-time · zd/create     │
│  (SELECT / agregacje MSSQL + Sfera create)                       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.1. Ścieżka A — matryca ABC/XYZ (offline / cron)

**Cel:** mieć świeżą klasę `A|B|C` × `X|Y|Z` per `tw_Id` bez obciążania kliknięcia „Policz”.

```text
1. Cron OnTime (np. 1× miesiąc, noc)
2. Dla zakresów / stron:
     GET /orders/sales/weekly?dataOd=…&dataDo=…&page=…
3. OnTime:
     - densyfikacja zer (jeśli API nie zwraca pustych tygodni)
     - total_revenue, avg_weekly, stddev, CV
     - ABC (Pareto 80/95), XYZ (progi CV)
4. UPSERT do tabeli np. zd_sku_abc_xyz
     (tw_id, abc, xyz, segment, metrics, computed_at)
5. Opcjonalnie: ręczny override w adminie
```

**API w tej ścieżce tylko dostarcza weekly (+ wartość).**  
Klasyfikacja = OT.

### 4.2. Ścieżka B — lista zamówienia (online, jak dziś „Policz”)

```text
1. Zakupy wybiera dostawcę / grupę / cechę w OnTime
2. OT ustala dniZapasu (stock), okno FS, wykluczenia
3. GET /orders/zd/estimate (jak dziś) → stany, tempo, otwarteZd, …
4. OT join z matrycą ABC/XYZ (po tw_Id)
5. OT: effective cover = dostepne + otwarteZd (szt.)
6. OT: wybór algorytmu:
     - segment *-X  → ROP + EOQ (gdy są σ_d, L, C, S, i)
     - segment *-Y  → na start: cover×dni (jak dziś) / później prognoza
     - segment *-Z  → Min-Max / Croston (parametry OT)
   Fallback gdy brak danych API: obecny wzór cover×dniZapasu
7. Pack ceil + MOQ + prośby + BOM/pary
8. Lista „Do ZD” → POST /documents/zd/create (confirm LIVE)
```

**Ważne:** zakres listy (które SKU w ogóle rozważamy) = **OnTime + estimate**.  
API nie dostaje „policz zamówienie na cały Subiekt bez filtra” jako default pracy zakupów.

### 4.3. Ścieżka C — parametry lead time (rzadko)

```text
Cron / on-demand:
  GET /orders/lead-time/stats?khId=…
  → cache w OT per dostawca (i opcjonalnie per tw)
  → używane w SS/ROP przy Policz
```

Do czasu wdrożenia: fallback `delivery_stats` (średnia, bez σ) albo \(L\) ręczny — z jasnym oznaczeniem w UI, że to **nie** prawdziwy lead time ze statystyk ZD.

---

## 5. Kontrakt danych (co płynie między systemami)

### 5.1. API → OnTime (wejścia do decyzji)

| Dane | Źródło | Użycie w OT |
|---|---|---|
| `tw_Id`, symbol, nazwa | estimate / weekly | klucz |
| `qty` tygodniowe + revenue | sales/weekly | ABC/XYZ |
| `sprzedazOkres`, `sprzedazDziennie` | estimate | tempo bieżące / fallback |
| `dostepne`, `tw_Stan`, `tw_StanRez` | estimate | cover |
| `otwarteZd` (j.dok.) | estimate | in transit |
| `cenaZakupu` | products / estimate / weekly | \(H\) EOQ |
| `moq`, `packSize` / komplety | products / komplety | etap 3 |
| `leadTimeAvg`, `leadTimeStd` | lead-time/stats | \(L\), \(\sigma_L\) |

### 5.2. OnTime → API (wyjścia operacyjne)

| Dane | Endpoint | Uwagi |
|---|---|---|
| `kontrahentId`, pozycje `{towarId, ilosc}` | `POST /documents/zd/create` | `ilosc` = jednostki dokumentu |
| filtry `grupaId` / `cechaId` / `towarId` | estimate, weekly | XOR jak dziś |

OnTime **nie** wysyła do API: klasy ABC/XYZ, \(S\), \(i\), Z — to lokalna decyzja.

### 5.3. Pojęcia, których nie wolno mylić

| Pojęcie | Znaczenie | Gdzie |
|---|---|---|
| `dniZapasu` | horyzont zapasu („trzymaj na N dni”) | OT ze stock dostawcy → query estimate |
| Lead time \(L\) | czas realizacji zamówienia u dostawcy | API stats / delivery_stats |
| `interval_*` | co ile kalendarzowo zamawiamy | OT (plan dostaw) |
| ROP | próg „zamów, gdy cover ≤ ROP” | OT (algo X) |
| `celZapasu` | dziś: tempo × dniZapasu (+ min) | API estimate; OT może zastąpić celem z ROP/EOQ |

---

## 6. Silnik qty w OnTime (docelowy, warstwowy)

Żeby wdrożenie było bezpieczne, **nie** wymieniać od razu całego wzoru. Warstwy:

```text
Warstwa 0 (dziś, zawsze fallback)
  qty = ceil(celTracked − dostepne − otwarteZdPieces)
  celTracked = celZapasu API ± sales-track ± history cuts

Warstwa 1 (gdy matryca + weekly)
  UI: badge A-X / B-Y / …
  qty nadal Warstwa 0

Warstwa 2 (gdy L, σ_d, C, S, i — segment X)
  effective = dostepne + otwarteZdPieces
  SS, ROP z wzorów
  if effective > ROP → qty = 0
  else qty_raw = EOQ (lub max(EOQ, ROP − effective) — decyzja produktowa)
  qty = pack/MOQ(qty_raw)

Warstwa 3 (Y/Z)
  Y: prognoza na L − effective (+ SS)
  Z: max_stock − effective / Croston
```

**Zasada produktowa:** brak danych wejściowych do warstwy N → spadamy do N−1, nigdy „pusta lista przez brak σ”.

---

## 7. Antywzorce (czego nie robić)

| Antywzorzec | Skutek | Zamiast |
|---|---|---|
| API zwraca finalne `doZamowieniaEOQ` | podwójna konfiguracja, trudne wyjątki OT | API: fakty; OT: qty |
| OT buduje weekly z `/documents/fs` | timeout, obciążenie LAN | `sales/weekly` |
| Jedna „inteligentna” funkcja bez fallbacku | awaria przy braku danych | warstwy 0→2 |
| Używać `dniZapasu` jako \(L\) w ROP bez UI | fałszywy „kiedy zamówić” | osobne pola + oznaczenie |
| Liczyć ABC tylko na oknie estimate (30 dni) | niestabilne klasy | 12m weekly |
| Trzymać matrycę tylko w pamięci requestu | brak audytu | tabela + `computed_at` |
| Mieszać FS i WZ bez docs | podwójne liczenie / dziury | jeden parametr źródła w API |

---

## 8. Fazy wdrożenia (kolejność, która działa najlepiej)

### Faza 0 — bez zmian algo (już)

- Estimate + cover×dni + pack OT + create LIVE.
- Dokument braków API: `subiekt-abc-xyz-api-gaps.md`.

### Faza 1 — matryca (wartość biznesowa od razu)

**API:** `GET /orders/sales/weekly` (+ wartość).  
**OT:** cron → tabela ABC/XYZ → badge / filtr / sort na szacunku.  
**Qty:** bez zmian (Warstwa 0).

Efekt: zakupy widzą „co jest A-X”, zanim ruszysz EOQ.

### Faza 2 — lepsze wejścia logistyczne

**API:** komplety, MOQ, lead-time stats, (opcjonalnie) pola σ/cena w estimate.  
**OT:** sync pack; cache \(L\), \(\sigma_L\).

### Faza 3 — algo X (ROP/EOQ) za feature flag

**OT:** dla `*-X` z kompletnymi danymi → Warstwa 2; reszta Warstwa 0.  
Porównanie side-by-side (stary vs nowy qty) w UI admin / dry-run.

### Faza 4 — Y/Z

Prognozy / Min-Max / Croston dopiero gdy matryca i X są stabilne.

---

## 9. SLA / obciążenie (praktyczne ramy)

| Operacja | Kto | Częstotliwość | Oczekiwanie |
|---|---|---|---|
| Przeliczenie matrycy | OT cron → API weekly | 1× / miesiąc (lub po żądaniu admina) | może trwać dłużej; paginacja |
| Policz listę | OT → estimate | on-demand | jak dziś (strony, timeout ORDERS) |
| Lead-time refresh | OT → stats | 1× / tydzień lub przy Policz (cache) | lekki |
| Create ZD | OT → Sfera | on-demand | 180s timeout; confirm LIVE |

Paginacja weekly: ten sam styl co estimate (`page`, `pageSize` ≤ 200).  
Cron nie powinien trzymać jednego requesta na cały katalog bez stron.

---

## 10. Podział „lista towarów” vs „obliczenia” — odpowiedź wprost

| Pytanie | Odpowiedź |
|---|---|
| Gdzie generować listę towarów? | **OnTime** (zakres + estimate jako źródło SKU w zakresie + wykluczenia) |
| Gdzie ciężkie sumowanie sprzedaży? | **API** (`sales/weekly`, estimate) |
| Gdzie ABC/XYZ? | **OnTime** (z weekly) |
| Gdzie EOQ/ROP? | **OnTime** (z estimate + matryca + lead-time + ceny) |
| Gdzie pack/MOQ final? | **OnTime** (pack OT + MOQ z API jeśli jest) |
| Gdzie create? | **API** (Sfera), trigger z OnTime |

Czyli: **lista i decyzja w OnTime; obliczenia masowe (agregaty) w API; obliczenia decyzyjne (wzory) w OnTime.**

„Obliczenia przez API” ma sens tylko jako **agregacja SQL** (weekly, stats), nie jako „API liczy Wilsona za nas”.

---

## 11. Checklist uzgodnień Filip ↔ Tomasz

- [ ] Zasada: API = fakty/agregaty, OT = matryca + qty + create  
- [ ] `GET /orders/sales/weekly` (zera tygodniowe, źródło FS/WZ w docs)  
- [ ] Wartość: cena sprzedaży i/lub zakupu  
- [ ] Matryca w Supabase + cron OT  
- [ ] Faza 1: badge klas bez zmiany qty  
- [ ] Potem: komplety, MOQ, lead-time stats  
- [ ] ROP/EOQ za flagą, z fallbackiem do obecnego cover×dni  
- [ ] Jasne nazewnictwo w UI: horyzont zapasu ≠ lead time ≠ interwał  

---

## 12. Jedno zdanie do wrzucenia na chat

> Najlepiej: API daje nam tygodnie sprzedaży, ceny, stany/otwarte ZD i lead-time; OnTime trzyma matrycę ABC/XYZ, liczy ile/kiedy zamawiać (z fallbackiem do obecnego kreatora) i tworzy ZD — lista towarów zawsze startuje z zakresu w OnTime, nie z „gotowego EOQ” po stronie API.

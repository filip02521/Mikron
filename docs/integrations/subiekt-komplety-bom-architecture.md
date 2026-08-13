# Komplety / BOM — konfigurowalne scenariusze (plan dopracowany)

**Cel:** jeden model BOM w OnTime obsługuje:

1. Sprzedaż **solo** A/B **i** sprzedaż **kompletu K** — bilans magazynowy na oba kanały.  
2. U dostawcy da się kupić **A/B** i/lub **K** (często K taniej).  
3. Albo K to tylko promocja / skład wewnętrzny — **nie kupujemy K**, tylko A+B.

**Stan kodu dziś (twarde):** `expandZdEstimateBoms` zawsze robi *explode* sprzedaży K→składniki, zeruje `doZd` parenta, opcjonalnie `stock_as_cover`. Odpowiednik presetu **„Składamy / tylko składniki”** poniżej.

**Poza zakresem tego modelu:** pary pack↔piece (`zd_product_pairs`) — ten sam towar, inna JM (karton/sztuki).

---

## 1. Werdykt

> Rozdziel **alokację popytu** (czy sprzedaż K obciąża A/B) od **celu zakupu** (czy na ZD idzie K, A/B, albo decyzja kosztowa).  
> W UI daj **presety**; w DB trzymaj wąską, walidowaną parę pól.  
> **v1:** trzy presety bez `cheapest`. **v2:** porównanie cen.  
> Default = dzisiejsze zachowanie (Castorit bez zmian).

---

## 2. Uproszczenie względem wcześniejszej wersji (co było nie tak)

| Problem w poprzednim planie | Poprawka |
|---|---|
| `independent` ≈ `kit_on_parent` (ten sam efekt na sales) | Jedna wartość: **`separate`** (brak explode) |
| `all_purchasable` ≈ `kit_preferred` przy braku explode | Jedna polityka **`as_sold`**: każdy SKU zamawiany wg własnego popytu po alokacji |
| `kit_purchasable` / `components_purchasable` dublują `order_policy` | **Bez osobnych kolumn w v1** — wynikają z presetu / policy |
| S1 i S6 to to samo + checkbox cover | S6 usunięte; cover zostaje osią przy S1 |
| S5 z `explode` + `kit_only` | **Zakazane** (sprzeczne) |
| `cheapest` dodaje `need_K×q` bez ponownego cover | Algorytm v2 z re-cover |
| Brak: prośby, wykluczenia, multi-BOM, zakres Policz, jednostki ZD parenta | Sekcje 8–9 |
| Za dużo enumów naraz | Presety UI → walidowana para pól |

---

## 3. Model konfiguracji (v1)

### 3.1. Dwa pola w DB (per BOM)

| Pole | Wartości | Pytanie |
|---|---|---|
| `demand_allocation` | `explode` \| `separate` | Czy sprzedaż K dolicza się do popytu składników? |
| `purchase_target` | `components` \| `as_sold` \| `kit_only` | Co wolno / ma iść na ZD? |

`stock_as_cover` (już jest) — trzecia oś, sensowna głównie przy `explode`.

### 3.2. Macierz dozwolonych kombinacji

| `demand_allocation` | `purchase_target` | Preset UI | OK? |
|---|---|---|---|
| `explode` | `components` | **Składamy (tylko składniki)** | ✅ default dziś |
| `separate` | `as_sold` | **Kupujemy K i części osobno** | ✅ |
| `separate` | `kit_only` | **Tylko komplet** | ✅ (alert przy solo A/B) |
| `explode` | `as_sold` | — | ❌ podwójne pokrycie popytu K |
| `explode` | `kit_only` | — | ❌ |
| `separate` | `components` | — | ❌ popyt K bez ścieżki zakupu |

`stock_as_cover`:

- przy `explode` + `components`: **do wyboru** (domyślnie `true`, z ostrzeżeniem o dublowaniu gdy K i A/B leżą osobno),  
- przy `separate`: wymuszaj / sugeruj **`false`** (stan K nie ma zmniejszać niedoboru A/B).

### 3.3. Presety (to klika zakupowiec)

| Preset | allocation | target | cover | Kiedy |
|---|---|---|---|---|
| **Składamy (tylko składniki)** | `explode` | `components` | true/false | K nie kupujemy / promocja wewnętrzna |
| **Kupujemy K i części** | `separate` | `as_sold` | false | K i A/B realne pozycje u dostawcy |
| **Tylko komplet** | `separate` | `kit_only` | false | A/B nie zamawiamy (lub brak w ofercie) |
| **Taniej: K vs A+B** *(v2)* | `separate` | `cheapest` | false | jak „Kupujemy…”, ale kit-shortfall → min koszt |

„Często taniej wziąć komplet” w v1 = preset **Kupujemy K i części** (popyt K → ZD na K).  
Automatyczne porównanie cen = v2 (`cheapest`).

---

## 4. Semantyka silnika

### 4.1. Alokacja popytu

**`explode` (dziś):**

```text
sprzedaz_A' = sprzedaz_A + sprzedaz_K × q_A
sprzedaz_B' = sprzedaz_B + sprzedaz_K × q_B
K: nie buduje własnego celu zakupowego (doZd_K = 0)
```

**`separate`:**

```text
bez rollupu — każdy SKU liczy tempo/cel ze swojej sprzedaży FS
```

### 4.2. Cel zakupu (`purchase_target`)

Po wyliczeniu `cel` / `cover` / `need = max(0, ceil(cel − cover))` jak w szacunku (sales-track, historia, opakowania — bez zmian ramowe):

| target | `doZd_K` | `doZd_A/B` |
|---|---|---|
| `components` | 0 | `need` po explode |
| `as_sold` | `need_K` | `need` ze sprzedaży solo (bez wkładu K) |
| `kit_only` | `need_K` | 0 (+ alert jeśli `sprzedaz_A/B > 0` lub prośba na A/B) |

### 4.3. Cover (`stock_as_cover`)

Tylko przy `explode`:

```text
cover_A += (dostepne_K + otwarteZd_K_w_szt_karty) × q_A
```

**Uwaga jednostek:** `otwarteZd` parenta przed mnożeniem przez `q` jest konwertowane przez `zdDocumentUnitsToPieces`, gdy w opcjach silnika jest packaging parenta.

### 4.4. Kolejność pipeline (bez zmian ram)

```text
estimate → BOM (alokacja + purchase_target) → pary → pack/MOQ → prośby → Do ZD / create
```

---

## 5. Algorytm v1 (presety)

### P1 — Składamy (`explode` + `components`) — obecny kod

```text
1. sales_K × q → A/B
2. opcjonalnie cover_K × q → A/B
3. rematerialize A/B (i pary)
4. doZd_K = 0
```

### P2 — Kupujemy K i części (`separate` + `as_sold`)

```text
1. brak rollupu
2. rematerialize K, A, B jak zwykłe linie (K NIE jest już „martwym” parentem)
3. doZd = need każdego SKU
```

**Wymagana zmiana kodu:** przy tym presece **nie** ustawiać `bom.role=parent` → `doZd=0`; zamiast meta „komplet · kupowany osobno”.  
`resolveOrderQtyForLine` / create muszą **dopuszczać** K.

### P3 — Tylko komplet (`separate` + `kit_only`)

```text
jak P2 dla K; A/B: doZd = 0
UI: ostrzeżenie gdy sales lub prośba na A/B > 0
```

### P4 — v2 `cheapest` (dopiero z cenami)

Kit-shortfall liczony **po** cover K:

```text
need_K = shortfall K w szt. kompletu

Opcja KIT:
  order_K = pack/MOQ(need_K)
  cost = order_K × price_K

Opcja SKŁADNIKI:
  symuluj dodatkowy popyt A += need_K×q_A, B += need_K×q_B
  przelicz need_A', need_B' względem ISTNIEJĄCEGO cover A/B
  # nie: naiwnie need_K×q (pomija cover składników!)
  delta_A = need_A' − need_A_solo
  delta_B = need_B' − need_B_solo
  cost = pack(delta_A)×price_A + pack(delta_B)×price_B

wybierz tańszą; solo need_A/B zawsze dokładane do składników
brak ceny → fallback P2 + banner
```

---

## 6. Przykłady liczbowe (okno = zapas)

| SKU | Sprzedaż | Dostępne | Cena |
|---|---|---|---|
| A | 100 | 40 | 10 |
| B | 80 | 50 | 8 |
| K (1+1) | 30 | 10 | 15 |

### P1 explode + cover

```text
popyt_A=130, cover_A=40+10=50 → ZD_A=80
popyt_B=110, cover_B=50+10=60 → ZD_B=50
ZD_K=0
```

### P2 separate + as_sold

```text
ZD_K=20, ZD_A=60, ZD_B=30
```

Inny bilans niż P1: sprzedaż K **nie** obciąża A/B (K schodzi z półki jako gotowy towar).

### P3 kit_only

```text
ZD_K=20, ZD_A=0, ZD_B=0
+ alert: jest sprzedaż solo A/B bez ścieżki zakupu
```

### P4 cheapest (v2), need_K=20

```text
cost_K = 20×15 = 300
cost_AB (symulacja): +20 A,+20 B przy cover 40/50
  need_A: 60→80 (delta 20), need_B: 30→50 (delta 20)
  cost = 20×10 + 20×8 = 360 → wybór K
→ wynik jak P2
```

---

## 7. Schemat DB (propozycja migracji)

```sql
ALTER TABLE public.zd_product_boms
  ADD COLUMN demand_allocation text NOT NULL DEFAULT 'explode',
  ADD COLUMN purchase_target text NOT NULL DEFAULT 'components';

ALTER TABLE public.zd_product_boms
  ADD CONSTRAINT zd_product_boms_demand_allocation_check
    CHECK (demand_allocation IN ('explode', 'separate')),
  ADD CONSTRAINT zd_product_boms_purchase_target_check
    CHECK (purchase_target IN ('components', 'as_sold', 'kit_only')),
  ADD CONSTRAINT zd_product_boms_policy_pair_check
    CHECK (
      (demand_allocation = 'explode' AND purchase_target = 'components')
      OR (demand_allocation = 'separate' AND purchase_target IN ('as_sold', 'kit_only'))
    );

-- później v2: purchase_target dopisać 'cheapest' + luz CHECK
-- source: rozszerzyć o 'subiekt_komplet'
```

Komentarz tabeli zaktualizować: *„parent nie zawsze poza ZD — zależy od purchase_target”*.

TypeScript:

```ts
type BomDemandAllocation = "explode" | "separate";
type BomPurchaseTarget = "components" | "as_sold" | "kit_only"; // + "cheapest" v2

type ZdProductBomRef = {
  parentTwId: number;
  stockAsCover: boolean;
  demandAllocation: BomDemandAllocation;
  purchaseTarget: BomPurchaseTarget;
  components: { componentTwId: number; qtyPerParent: number }[];
  label?: string;
};
```

---

## 8. Luki horyzontalne (musi domknąć implementacja)

### 8.1. Prośby handlowców

Dziś prośba na parent → linia usługi `bom_parent` (nie rozbijana).

| Preset | Zachowanie docelowe |
|---|---|
| Składamy | rozbić prośbę K → A×q, B×q **albo** zostawić usługę + hint (decyzja produktowa; default: rozbij) |
| Kupujemy K i części | rezerwa na **K** (jak zwykły tw_Id) |
| Tylko komplet | rezerwa na K; prośba na A/B → alert |

### 8.2. Wykluczenia

| Wykluczony | Składamy | Kupujemy osobno |
|---|---|---|
| K | **v1:** UI nie pozwala wykluczyć assembled parent — sprzedaż K nadal w składnikach (świadomie; bez „exclude stops explode”). Follow-up: opcjonalnie zatrzymać wkład. | brak ZD_K |
| A | brak ZD_A; wkład z K do B **zostaje** (jak dziś karton) | brak ZD_A |

### 8.3. Ten sam składnik w wielu BOM

Kod już sumuje `contribSales` po `cid`. Przy `separate` brak interakcji. Przy `explode` — OK addytywnie. UI: pokazać listę parentów na badge.

### 8.4. Zakres Policz (grupa/cecha)

BOM sensowny tylko gdy K **i** brakujące A/B są dociągnięte (`collectMissingZdBomTwIds` już jest). Przy `as_sold` nadal dociągaj składniki do kontekstu / badge, nawet jeśli nie wchodzą na ZD? **Nie wymagane** dla qty K — ale dla edycji BOM i alertów tak.

### 8.5. Pary na składniku

Bez zmian: najpierw BOM, potem pary. Przy `as_sold` parent K nie jest w parze (constraint zostaje).

### 8.6. Create ZD / TSV / list tools

Dziś parent odfiltrowany (`bom.role === "parent"`). Przy `as_sold` / `kit_only` K musi być **orderable**. Meta roli:

- `assembled_parent` (poza ZD) vs `purchased_kit` (na ZD).

### 8.7. Sales-track / historia na K

Przy `separate` K musi przejść normalny rematerialize (dziś parent skip). Historia snapshotów per `tw_Id` — bez zmian.

### 8.8. Różni dostawcy

Estimate jest per zakres/dostawca. Jeśli K u dostawcy X, a A u Y — BOM w jednym Policz **nie** zastąpi dwóch zamówień. Ograniczenie: dokumentować; opcjonalnie ostrzeżenie gdy `subiekt_kh` składnika ≠ parenta (wymaga danych dostawcy na SKU — dziś słabe).

---

## 9. UI

Modal **Komplety** (ew. zakładka w Składach):

1. Preset (radio): Składamy / Kupujemy K i części / Tylko komplet.  
2. Przy „Składamy”: checkbox `stock_as_cover` + istniejące hinty.  
3. Badge na liście wyniku zgodny z presetem.  
4. Sync Subiekt: 1 składnik → para; N → BOM z defaultem **Składamy** (po syncu można przełączyć preset).

Nie wystawiać surowych enumów jako pierwszego UI.

---

## 10. Fazy wdrożenia (skorygowane)

| Faza | Zakres |
|---|---|
| **0** | Ten dokument; copy w modalu opisujące 3 presety; silnik bez zmian |
| **1** | Migracja 2 kolumn + CHECK; silnik P1/P2/P3; UI presetów; testy Castorit + nowy case P2 |
| **2** | Prośby: rozbicie vs rezerwa na K wg presetu; create/TSV dla purchased kit |
| **3** | `cheapest` + `cenaZakupu` z API |
| **4** | `GET /products/komplety` multi → sync BOM |

---

## 11. Antywzorce

| Nie robić | Dlaczego |
|---|---|
| `explode` + zamawianie K na tę samą sprzedaż | 2× towar |
| `stock_as_cover` przy `separate` | fałszywy cover A/B |
| Osobne flagi `kit_purchasable` obok targetu | rozjechane stany |
| `cheapest` = `need_K×q` bez re-cover | zły koszt / qty |
| Multi-kit jako para | gubi składniki |
| Jeden globalny switch na całe OT | mieszanka S1/S2 u Mikran |

---

## 12. Checklist uzgodnień

- [ ] Dominujący case Mikran: **Składamy** czy **Kupujemy K i części**? (mieszanka → presety per BOM)  
- [ ] Prośba na K przy „Składamy”: rozbij na A/B od razu w v1?  
- [ ] Czy v1 bez `cheapest` wystarczy (ręczne preferowanie K = preset 2)?  
- [ ] Tomasz: multi `komplety` w API  
- [ ] Czy K bywa z opakowaniem (JM) istotnym dla `otwarteZd`?  

---

## 13. Zdanie na chat

> BOM dostanie dwa pola: czy sprzedaż kompletu idzie w składniki, oraz czy na ZD kupujemy składniki / komplet osobno / tylko komplet. W UI trzy presety; „taniej komplet” najpierw jako „kupujemy K osobno”, potem opcjonalnie auto po cenie. Nie mieszamy tego z parami karton↔sztuki.

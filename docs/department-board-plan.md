# Tablica działu — plan produktu i UX

> **Status:** szkic na branchu `feature/department-board`  
> **Cel:** jeden kanał komunikacji zakupy ↔ handlowcy — ogłoszenia (jednokierunkowe) + pytania widoczne dla wszystkich.

---

## Problem

1. **Zakupy** muszą przekazać informację **wszystkim handlowcom** — ma być **wyraźnie widoczna**, nie ginąć w mailu.
2. **Handlowcy** chcą **zapytać zakupy** o coś — i żeby **cały dział** widział pytanie i odpowiedź (unikamy 10× tego samego pytania na Slacku).
3. **Zakupy** widzą aktywność w jednym miejscu — nie rozproszone prośby.

Istniejące `/notatki` (prywatne + wspólne **wewnątrz działu**) **nie obejmują** handlowców — to osobny produkt, nie rozszerzenie notatek magazynowych.

---

## Koncepcja: jedna tablica, dwa typy wpisów

| Typ | Kto tworzy | Kto czyta | Interakcja |
|-----|------------|-----------|------------|
| **Ogłoszenie** | zakupy, admin | wszyscy handlowcy (+ kierownik) | tylko odczyt; opcjonalnie „przeczytane” |
| **Pytanie** | handlowiec | wszyscy handlowcy + zakupy | wątek odpowiedzi (zakupy / admin) |

Wspólna zasada: **transparentność** — każdy handlowiec widzi pytania kolegów i odpowiedzi zakupów (jak tablica w open office).

---

## Informacja architektury

```
┌─────────────────────────────────────────────────────────────┐
│  ZAKUPY — /zakupy/tablica  (compose + moderacja)            │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │ Nowe ogłoszenie │  │ Pytania handlowców (odpowiedz)   │  │
│  └─────────────────┘  └──────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────┘
                                │ Supabase RLS
                                ▼
┌─────────────────────────────────────────────────────────────┐
│  HANDLOWCY — /tablica                                       │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │ Ogłoszenia      │  │ Pytania (wszystkich) + odpowiedzi│  │
│  │ (pin, wyróżnienie)│  │ + „Zadaj pytanie”                │  │
│  └─────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Powiadomienia (faza 2):** badge w nawigacji + opcjonalny banner na `/moje` (tylko nieprzeczytane ogłoszenia).

---

## UX / UI — zasady

### Ogłoszenia (priorytet wizualny)

- **Pin** + opcjonalny **kolor** (jak w notatniku działu) — spójność z `/notatki`.
- **Karta na górze** tablicy handlowca — zawsze nad pytaniami.
- **Tytuł + treść** — bez skracania; data publikacji i autor (np. „Zakupy · Jan K.”).
- **Ważne:** ogłoszenie aktywne do `expires_at` lub ręcznego archiwum — stare nie zaśmiecają.
- **Mobile:** pełna szerokość, min. 44px touch targets; ogłoszenia max 1–2 pinned widoczne, reszta „Wszystkie ogłoszenia”.

### Pytania (wątki)

- Formularz: **krótki temat + treść** (bez załączników w MVP).
- Lista: status **Otwarte** / **Odpowiedziane** (filtr chips).
- W wątku: chronologia postów; odpowiedź zakupów wizualnie wyróżniona (np. lewa krawędź indigo + badge „Zakupy”).
- **Brak prywatnych DM** — wszystko publiczne w obrębie firmy (handlowcy + zakupy).

### Panel zakupów

- **Dwie zakładki:** Ogłoszenia | Pytania handlowców.
- CTA **„Nowe ogłoszenie”** — primary, zawsze dostępne.
- Pytania: sortowanie **najpierw bez odpowiedzi**, potem data.
- Link z **Panelu dziennego** (toolbar) — „Tablica z handlowcami”.

### Dostępność i spójność

- Tokeny z `ontime-theme.ts` (indigo/sky, karty `surfaceCardClass`).
- `aria-live` przy nowych odpowiedziach (opcjonalnie polling jak `SalesUpdatesContext`).
- Puste stany z jednym jasnym CTA.

---

## Nawigacja (propozycja)

| Rola | Ścieżka | Etykieta | Badge |
|------|---------|----------|-------|
| handlowiec | `/tablica` | Tablica | nieprzeczytane ogłoszenia + otwarte pytania (opcj.) |
| kierownik | `/tablica` | Tablica | jak handlowiec |
| zakupy | `/zakupy/tablica` | Tablica | liczba pytań bez odpowiedzi |
| admin | obie | pełny dostęp | — |

**Mobile handlowiec:** 5. pozycja w dolnym pasku **lub** zamiana z rzadszą zakładką — do decyzji po prototypie (preferencja: dodać „Tablica”, skrócić etykiety).

**Nie mieszamy** z `/notatnik` (osobiste ZK) ani `/notatki` (wewnętrzne zakupy/magazyn).

---

## Model danych (MVP)

### `department_board_threads`

| Kolumna | Opis |
|---------|------|
| `id` | UUID |
| `kind` | `announcement` \| `question` |
| `created_by` | `profiles.id` |
| `sales_person_id` | nullable — autor handlowiec |
| `title` | wymagany |
| `body` | treść pierwszego posta / ogłoszenia |
| `status` | `open` \| `answered` \| `archived` (pytania) |
| `pinned` | bool (ogłoszenia) |
| `color` | enum jak notatnik |
| `published_at` | ogłoszenie widoczne od |
| `expires_at` | nullable |
| `archived_at` | nullable |
| `created_at`, `updated_at` | |

### `department_board_posts`

| Kolumna | Opis |
|---------|------|
| `id` | UUID |
| `thread_id` | FK |
| `created_by` | profile |
| `body` | treść odpowiedzi |
| `created_at` | |

### `department_board_reads` (ogłoszenia)

| Kolumna | Opis |
|---------|------|
| `thread_id`, `profile_id` | PK composite |
| `read_at` | |

### RLS (skrót)

- **SELECT ogłoszeń / pytań / postów:** `is_sales_account()` OR `is_operations()` OR `is_admin()`
- **INSERT ogłoszenie:** `is_operations()` OR `is_admin()`
- **INSERT pytanie:** `is_sales_account()` (własne `sales_person_id`)
- **INSERT post (odpowiedź):** `is_operations()` OR `is_admin()` na wątku `question`
- **UPDATE/ARCHIVE ogłoszenie:** autor zakupów lub admin

---

## Fazy wdrożenia

### Faza 1 — MVP (ten branch)

- [ ] Migracja `057_department_board.sql`
- [ ] Typy + warstwa `lib/data` + server actions
- [ ] `/tablica` (handlowiec, read + zadaj pytanie)
- [ ] `/zakupy/tablica` (ogłoszenia + odpowiedzi)
- [ ] `proxy.ts` + `nav.ts` + badge (prosty count)
- [ ] Testy RLS / walidacji

### Faza 2

- [ ] Banner nieprzeczytanych na `/moje`
- [ ] Polling / wersja w `SalesUpdatesContext`
- [ ] E-mail digest (Resend) — opcjonalnie
- [ ] Targetowanie grup handlowców (`sales_group_id`)

### Faza 3

- [ ] Magazyn — osobna tablica (`magazyn` ↔ zakupy) — ten sam mechanizm, inny `board_scope`

---

## Co **nie** robimy w MVP

- Załączniki, reakcje emoji, @mentions
- Edycja wiadomości po 15 min (tylko archiwum)
- Integracja ze Slack / Teams
- Powiadomienia push

---

## Metryki sukcesu

- Handlowiec widzi ogłoszenie bez logowania poza aplikację
- Czas odpowiedzi zakupów na pytanie (średni `answered_at - created_at`)
- Spadek powtarzających pytań (subiektywnie — ta sama treść w wątku)

---

## Otwarte decyzje (do Twojej akceptacji)

1. **Nazwa w UI:** „Tablica”, „Ogłoszenia zakupów”, „Komunikacja”?
2. **5. ikona w mobile nav** handlowca — tak czy link z `/moje`?
3. **Kierownik** może odpowiadać na pytania jak zakupy — tak/nie?
4. **Retencja** — archiwum po 90 dni vs. ręczne?

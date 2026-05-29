# Dostawcy aktywni / nieaktywni

## Znaczenie

| Stan | Panel dzienny / plan tygodnia | Karty · terminy | Prośby o produkt |
|------|------------------------------|-----------------|------------------|
| **Aktywny** | Tak (harmonogram cykliczny) | Tak | Tak |
| **Nieaktywny** | Nie | Tak (z oznaczeniem) | Tak — nadal można zamawiać konkretne produkty |

Typowy przypadek nieaktywnego: zmiana dostawcy na tańszego, ale stary nadal ma unikalne SKU.

## Gdzie zarządzać

- **Karty dostawców** — checkbox „Aktywny dostawca” lub przycisk **Dezaktywuj** (z potwierdzeniem).
- **Nieaktywni** (zakładka w hubie dostawców) — lista, **Przywróć aktywność**, edycja karty.
- **Panel dzienny** — edycja dostawcy w modalu (checkbox aktywności).
- **Terminy zamówień** — nieaktywni widać z badge „Nieaktywny” (szare tło).

## Import harmonogramów z Google Sheets

Kolumny jak w arkuszu: **F** = data zamówienia, **G** = data kolejnego, **H** = przesunięcie.

```bash
npm run import-location-schedules-csv -- --dir "/ścieżka/do/eksportu"
npm run verify-location-schedules -- --dir "/ścieżka/do/eksportu"
```

Po imporcie historii z katalogu Downloads (domyślnie) synchronizacja zakładek POLSKA/ZAGRANICA/IMPORT nadpisuje stan z arkusza:

```bash
npm run import-historia -- "/ścieżka/Downloads" --fresh
```

`sync` (przycisk „Przelicz wszystkie terminy”) **nie zmienia** harmonogramów nieaktywnych dostawców.

`rebuild-schedules-from-historia` **pomija** nieaktywnych.

## Migracja bazy

`supabase/migrations/039_supplier_is_active.sql` — kolumna `suppliers.is_active`.

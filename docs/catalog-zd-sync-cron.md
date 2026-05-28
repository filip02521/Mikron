# Nocna synchronizacja katalogu (ZD → produkty)

Endpoint: `GET /api/cron/catalog-zd-sync`  
Nagłówek: `Authorization: Bearer <CRON_SECRET>`

## Co robi

1. **Indeks** — przeszukuje ZD z ostatnich **21 dni** i zapisuje `subiekt_zd_index` (ZD → dostawca).
2. **Import** — dla ZD bez `catalog_imported_at` pobiera linie i uzupełnia `subiekt_products` + `product_supplier_links`.
3. **Auto-przypisanie** — uzupełnia `supplier_id` w prośbach „Weryfikacja”, gdy jest mapowanie w katalogu.

Domyślnie działa tylko w oknie **1:00–4:59** (Europe/Warsaw). Poza oknem lub do testu w biurze: `?force=1`.

Jedno wywołanie trwa do ok. **4 minut**; jeśli nie skończy, kolejne wywołanie tej samej nocy **kontynuuje** (stan w `app_settings` → `catalog_zd_sync_state`).

## Serwer w firmie (zalecane)

Subiekt API musi być dostępne z hosta aplikacji (LAN).

Przykład `/etc/cron.d/system-dostaw` (strefa serwera: `Europe/Warsaw`):

```bash
CRON_SECRET=twoj-sekret-z-env
BASE=http://127.0.0.1:3000

# 02:00 — główny przebieg
0 2 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1

# 02:20 — kontynuacja, gdy pierwszy przebieg nie domknął kolejki
20 2 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1
```

Test w biurze (pomija okno nocne):

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:3000/api/cron/catalog-zd-sync?force=1"
```

## Migracja bazy

Zastosuj `supabase/migrations/035_zd_catalog_imported_at.sql` (kolumna `catalog_imported_at` na `subiekt_zd_index`).

## Panel admina

`/admin/produkty` → sekcja **Synchronizacja nocna (cron)** — status, **Kontynuuj** (bez resetu stanu), **Uruchom teraz (test)** oraz **Od nowa (restart)** po zakończonym przebiegu.

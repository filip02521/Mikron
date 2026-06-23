# Nocna synchronizacja katalogu (ZD → produkty)

Endpoint: `GET /api/cron/catalog-zd-sync`  
Nagłówek: `Authorization: Bearer <CRON_SECRET>`

## Co robi

1. **Indeks** — przeszukuje ZD z ostatnich **365 dni** i zapisuje `subiekt_zd_index` (ZD → dostawca).
2. **Import** — dla ZD bez `catalog_imported_at` pobiera linie i uzupełnia `subiekt_products` + `product_supplier_links`.
3. **Auto-przypisanie** — uzupełnia `supplier_id` w prośbach „Weryfikacja”, gdy jest mapowanie w katalogu.

Domyślnie działa tylko w oknie **1:00–4:59** (Europe/Warsaw). Poza oknem lub do testu w biurze: `?force=1`.

Jedno wywołanie trwa do ok. **14 minut**; jeśli nie skończy, kolejne wywołanie tej samej nocy **kontynuuje** (stan w `app_settings` → `catalog_zd_sync_state`).

Harmonogram instalatora: **co 20 minut od 2:00 do 4:40** (9 slotów na noc).

## Serwer w firmie (zalecane)

Subiekt API musi być dostępne z hosta aplikacji (LAN).

### Automatyczna instalacja (zalecane)

W katalogu projektu na serwerze Linux:

```bash
# wygeneruj podgląd
npm run install-cron

# zainstaluj crona (root)
sudo npm run install-cron -- --install

# test — pomija okno czasowe
npm run install-cron -- --test catalog-zd-sync --force
```

Plik: `/etc/cron.d/system-dostaw` · logi: `/var/log/system-dostaw-cron.log`, `/var/log/system-dostaw-catalog.log`

### Windows (Harmonogram zadań)

PowerShell **jako Administrator**:

```powershell
npm run install-cron:win -- -Install
npm run install-cron:win -- -Test -Job catalog-zd-sync -Force
npm run install-cron:win -- -List
npm run install-cron:win -- -Uninstall
```

Logi: `logs\cron-*.log` w katalogu projektu · podgląd: `taskschd.msc`

Upewnij się, że strefa czasowa serwera Windows to **(UTC+01:00) Warszawa** (Panel sterowania → Data i godzina → Strefa czasowa).

### Ręcznie (Linux)

Przykład `/etc/cron.d/system-dostaw` (strefa serwera: `Europe/Warsaw`):

```bash
CRON_SECRET=twoj-sekret-z-env
BASE=http://127.0.0.1:3000

# 02:00–04:40 co 20 min — główny przebieg + kontynuacje
0,20,40 2-4 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1
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

Import per dostawca i autopilot przetwarzają tylko ZD z pustym `catalog_imported_at` (idempotentny). **Wyczyść błędny import** usuwa linki `zd_import` i resetuje flagi dokumentów dla dostawcy.

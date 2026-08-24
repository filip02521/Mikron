# Cron OnTime na Windows Server (self-hosted)

Harmonogram zadań Windows wywołuje lokalne endpointy aplikacji (`http://127.0.0.1:PORT/api/cron/...`) z nagłówkiem `Authorization: Bearer <CRON_SECRET>`.

## Wymagania wstępne

1. **Aplikacja działa na serwerze** — zwykle jako usługa Windows (`installer/install-windows-service.ps1`) albo `npm run start` na porcie **3000** (lub `APP_PORT` z `.env.local`).
2. **`.env.local`** w katalogu projektu z silnym `CRON_SECRET` (nie `change-me-in-production` ani `dev-local-cron-secret`).
3. **Strefa czasowa serwera:** `(UTC+01:00) Sarajewo, Warszawa, Skopje` (Panel sterowania → Data i godzina → Strefa czasowa). Harmonogram w skryptach zakłada **Europe/Warsaw** (czas lokalny Windows, nie `CRON_TZ`).
4. **curl.exe** w PATH (domyślnie w Windows 10 / Server 2016+).
5. **Subiekt API** w LAN — wymagane dla `catalog-zd-sync` i `informacja-stock-sync` (oraz częściowo `zd-eta-sync`).
6. **Konto SYSTEM** musi czytać `.env.local` (zadania cron biegną jako SYSTEM). Przy restrykcyjnych ACL: `icacls .env.local /grant "NT AUTHORITY\SYSTEM:(R)"`.

Opcjonalnie: `INFORMACJA_STOCK_AUTO_ENABLED=1` w `.env.local`, aby włączyć automatyczne powiadomienia ze stanu magazynu (domyślnie włączone, gdy zmienna nie jest ustawiona — patrz `src/lib/env/informacja-stock-auto.ts`).

## Zadania cron (pełna lista)

| Job (`-Job`) | Endpoint | Harmonogram (pn–pt, chyba że inaczej) | Opis |
|--------------|----------|----------------------------------------|------|
| `morning` | `/api/cron/morning` | **06:00** | Panel dzienny, kolejka realizacji, retencja |
| `process-deliveries` | `/api/cron/process-deliveries` | **08:00–18:00 co godz.** | Zapasowe domknięcie dostaw z kolejki |
| `informacja-stock-sync` | `/api/cron/informacja-stock-sync` | **08:00–18:00 co godz.** | Auto-powiadomienia „Powiadom, gdy będzie na magazynie” |
| `zd-eta-sync` | `/api/cron/zd-eta-sync` | **08:00–18:00 co 2 h** | Backup sync terminów ZD na prośbach |
| `catalog-zd-sync` | `/api/cron/catalog-zd-sync` | **codziennie 02:00–04:40 co 20 min** | Indeks ZD + import katalogu (noc) |
| `morning-sync` | `/api/cron/morning-sync` | **ręcznie** | Tylko przeliczenie harmonogramów (serwis / test) |

Ivoclar weekly: **OnTime Raporty** (nie instalować `scheduled-mails` na OT). Endpoint `/api/cron/scheduled-mails` w OT to legacy no-op; stare SchTasks `OnTime Cron Scheduled Mails *` są usuwane przy `-Install` (lista legacy). Logi: `/admin/mail`. Zob. `docs/CUTOVER-IVOCLAR.md`.

Źródło prawdy dla nazw jobów: `installer/cron-jobs.ps1`.

Na **Vercel** harmonogram może różnić się (UTC) — patrz `vercel.json` (bez `scheduled-mails`).

## Instalacja krok po kroku

### 1. PowerShell jako Administrator

Otwórz **Windows PowerShell** lub **Terminal** z uprawnieniami administratora i przejdź do katalogu projektu:

```powershell
cd C:\ścieżka\do\system-dostaw-web
```

### 2. Sprawdź konfigurację

Upewnij się, że w `.env.local` jest m.in.:

```env
CRON_SECRET=twoj-długi-losowy-sekret
APP_PORT=3000
```

### 3. Zainstaluj harmonogram

**Opcja A — tylko cron:**

```powershell
npm run install-cron:win -- -Install
```

**Opcja B — aplikacja + cron + opcjonalny nocny deploy:**

```powershell
.\installer\install-windows-service.ps1 -WithCron
```

Skrypt tworzy zadania w **Harmonogramie zadań** (konto **SYSTEM**, najwyższe uprawnienia). Nazwy zadań zaczynają się od `OnTime Cron …`.

Przed utworzeniem zadań `-Install` robi **preflight**: `curl.exe`, `CRON_SECRET`, czytelność `.env.local` dla SYSTEM, strefa czasowa, probe HTTP na `127.0.0.1:PORT`. Brak żywej aplikacji to ostrzeżenie (nie blokuje instalacji).

Nocny deploy (`-WithNightlyDeploy` / `nightly-deploy.ps1`) domyślnie o **05:00** — po oknie `catalog-zd-sync` (02:00–04:40), przed poranną rutiną 06:00. Przy błędzie buildu usługa OnTime jest **zawsze przywracana**, żeby crony nie milczały.

### 4. Weryfikacja

```powershell
npm run install-cron:win -- -List
```

Otwórz graficznie: `taskschd.msc` → folder główny → szukaj `OnTime Cron`.

### 5. Test ręczny (pomija okna czasowe)

```powershell
npm run install-cron:win -- -Test -Job morning -Force
npm run install-cron:win -- -Test -Job informacja-stock-sync -Force
npm run install-cron:win -- -Test -Job catalog-zd-sync -Force
```

Bez `-Force` endpointy mogą zwrócić **200 OK** z komunikatem „poza oknem” — to normalne poza godzinami pracy / nocą.

### 6. Logi

Po każdym wywołaniu wpis trafia do:

```
logs\cron-morning.log
logs\cron-process-deliveries.log
logs\cron-informacja-stock-sync.log
logs\cron-zd-eta-sync.log
logs\cron-catalog-zd-sync.log
```

Przykład:

```powershell
Get-Content .\logs\cron-informacja-stock-sync.log -Tail 20
```

## Odinstalowanie / aktualizacja

```powershell
npm run install-cron:win -- -Uninstall
npm run install-cron:win -- -Install   # ponowna instalacja po zmianach w skryptach
```

`-Install` usuwa stare zadania o tych samych nazwach i tworzy je od nowa.

## Rozwiązywanie problemów

| Objaw | Co sprawdzić |
|-------|----------------|
| Zadanie „Ostatnie uruchomienie: Błąd” | Log w `logs\cron-*.log`; czy aplikacja nasłuchuje na `127.0.0.1:PORT` |
| `401 Unauthorized` | `CRON_SECRET` w `.env.local` vs nagłówek w `cron-invoke.ps1` |
| `curl.exe` nie znaleziony | Zainstaluj curl lub dodaj do PATH |
| `503` / Subiekt offline | Mostek Subiekt na serwerze LAN; test w **Administracja → Integracja Subiekt** |
| Brak auto-informacji | `INFORMACJA_STOCK_AUTO_ENABLED`, stan magazynu > 0, prośba z `subiekt_tw_id` |
| Zła godzina uruchomienia | Strefa czasowa Windows = Warszawa |
| Wszystkie crony „Zaległe” | Czy usługa `OnTime` działa; `logs\nightly-deploy.log` (fail po stop); `logs\cron-*.log` |
| `CRON_SECRET` OK lokalnie, 401 z Harmonogramu | ACL `.env.local` — SYSTEM bez odczytu |

Test HTTP bez harmonogramu:

```powershell
$secret = (Get-Content .env.local | Where-Object { $_ -match '^CRON_SECRET=' }) -replace '^CRON_SECRET=',''
curl.exe -fsS -H "Authorization: Bearer $secret" "http://127.0.0.1:3000/api/cron/informacja-stock-sync?force=1"
```

## Linux (skrót)

Na serwerze Linux użyj `npm run install-cron -- --install` — ten sam zestaw endpointów, plik `/etc/cron.d/system-dostaw`. Szczegóły nocnego katalogu: [catalog-zd-sync-cron.md](catalog-zd-sync-cron.md).

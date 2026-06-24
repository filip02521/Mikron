# Nginx jako reverse proxy dla OnTime (Next.js)

Next.js nasłuchuje wewnętrznie na **porcie 3000** (`npm run start`). Nginx przyjmuje ruch na **80** (lub **443**) i przekazuje go do aplikacji — użytkownicy wchodzą na `http://ontime.mikran/login` zamiast `:3000`.

```
Przeglądarka  →  nginx :80  →  Next.js 127.0.0.1:3000
```

## 1. Zbuduj i uruchom aplikację

W katalogu projektu:

```powershell
cd C:\Users\Administrator\projects\Mikron
# Nie ustawiaj NODE_ENV=production przed npm ci — inaczej npm pominie czesc zaleznosci.
npm ci
npm run build
```

Aplikacja musi **cały czas działać** obok nginx (osobny proces):

```powershell
$env:NODE_ENV="production"
$env:PORT="3000"
npm run start
```

Na produkcji użyj usługi Windows (NSSM), **pm2** albo **systemd** na Linuxie — patrz `scripts/server-setup.sh --systemd`.

Test bez nginx: `http://127.0.0.1:3000/login` musi działać.

## 2. Plik konfiguracji nginx

Gotowy plik: [deploy/nginx/ontime.conf](../deploy/nginx/ontime.conf) (szablon z HTTPS: `ontime.conf.example`)

### Windows

1. Pobierz [nginx for Windows](https://nginx.org/en/download.html) i rozpakuj (np. `C:\nginx`).
2. W `C:\nginx\conf\nginx.conf` w bloku `http { ... }` dodaj na końcu:

   ```nginx
   include C:/Users/Administrator/projects/Mikron/deploy/nginx/ontime.conf;
   ```

   (albo skopiuj plik jako `ontime.conf` i popraw `server_name`.)

3. Sprawdź i uruchom:

   ```powershell
   cd C:\nginx
   .\nginx.exe -t
   .\nginx.exe
   ```

4. Zapora: zezwól na **80** (nginx), port **3000** może zostać tylko lokalny (`127.0.0.1`).

### Linux

```bash
sudo cp deploy/nginx/ontime.conf.example /etc/nginx/sites-available/ontime.conf
sudo ln -sf /etc/nginx/sites-available/ontime.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 3. Zmienne `.env` (ważne)

Adres w `.env` musi być **taki sam**, jak wpisują użytkownicy w przeglądarce (przez nginx, **bez** `:3000`):

**LAN, HTTP (np. Linode DNS):**

```env
NEXT_PUBLIC_APP_URL=http://ontime.mikran.pl
LAN_DEV_HOST=ontime.mikran.pl
```

**Produkcja, HTTPS:**

```env
NEXT_PUBLIC_APP_URL=https://ontime.firma.pl
```

Po zmianie: `npm run build` (jeśli zmieniasz `NEXT_PUBLIC_*`) i restart `npm run start`.

## 4. Supabase

Authentication → URL Configuration:

| Tryb | Site URL | Redirect URLs |
|------|----------|-----------------|
| LAN HTTP | `http://ontime.mikran` | `http://ontime.mikran/**` |
| HTTPS | `https://ontime.firma.pl` | `https://ontime.firma.pl/**` |

## 5. DNS / hosts

- **DNS firmowy:** `ontime.mikran` → IP serwera (bez hosts na każdym PC) — [lan-dns-bez-hosts.md](./lan-dns-bez-hosts.md)
- **Tylko IP:** w nginx ustaw `server_name 192.168.0.140;` i `NEXT_PUBLIC_APP_URL=http://192.168.0.140`

## 6. Usługa Windows (NSSM)

Skrypt instalacyjny (PowerShell **jako Administrator**):

```powershell
cd C:\Users\Administrator\projects\ontime
copy .env.production.example .env   # uzupełnij klucze
# NSSM: https://nssm.cc/download → np. C:\tools\nssm\win64\nssm.exe

.\installer\install-windows-service.ps1
# pelna instalacja (cron + nightly deploy):
.\installer\install-windows-service.ps1 -WithCron -WithNightlyDeploy

# samodzielny nocny deploy (pull + build + restart):
.\installer\nightly-deploy.ps1
.\installer\nightly-deploy.ps1 -InstallScheduledTask -TaskRunAs "DOMAIN\user" -TaskRunAsPassword "..."

# odinstalowanie:
.\installer\install-windows-service.ps1 -Uninstall -NssmPath C:\tools\nssm\win64\nssm.exe

# start / stop / restart:
.\installer\service.ps1 status
.\installer\service.ps1 restart -Probe
```

Ręcznie (bez skryptu):

```powershell
nssm install OnTime "C:\Program Files\nodejs\npm.cmd" "run start"
nssm set OnTime AppDirectory C:\Users\Administrator\projects\ontime
nssm set OnTime AppEnvironmentExtra NODE_ENV=production PORT=3000
nssm start OnTime
```

## 7. HTTPS (produkcja)

- Certyfikat firmowy lub Let’s Encrypt (na Linuxie: certbot).
- Odkomentuj blok `listen 443` w szablonie nginx.
- `NEXT_PUBLIC_APP_URL=https://...` — ciasteczka sesji będą `Secure` (patrz `src/lib/supabase/cookie-options.ts`).

## 8. Diagnostyka

| Problem | Sprawdź |
|---------|---------|
| 502 Bad Gateway | Czy działa `npm run start` na 3000? |
| Logowanie się resetuje | Zły `NEXT_PUBLIC_APP_URL` (np. nadal `:3000` albo IP zamiast nazwy) |
| Strona tylko na serwerze | Zapora 80, DNS, brak hosts na innych PC |
| Cron nie działa | Cron woła `http://127.0.0.1:3000` — OK, omija nginx |

```powershell
curl -I http://127.0.0.1:3000/login
curl -I http://ontime.mikran/login
```

## 9. Dev vs produkcja

| | Dev | Produkcja za nginx |
|---|-----|---------------------|
| Komenda | `npm run dev` | `npm run build` + `npm run start` |
| Port publiczny | 3000 | 80 / 443 (nginx) |
| Nginx | nie trzeba | reverse proxy |

W dev nginx zwykle **nie jest potrzebny** — wystarczy `npm run dev` i `:3000`.

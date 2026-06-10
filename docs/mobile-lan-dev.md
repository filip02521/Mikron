# Test na telefonie (Wi‑Fi / LAN)

## Bez hosts na każdym PC?

Tak, ale nie przez samą aplikację — potrzebny **firmowy DNS**, DNS w routerze albo dostęp **po IP**.  
Szczegóły: [lan-dns-bez-hosts.md](./lan-dns-bez-hosts.md).

Najszybciej bez konfiguracji klientów: `http://192.168.0.140:3000` (wpisz swoje IP).

## Lokalna nazwa zamiast IP (`ontime.mikran` + plik hosts)

Na **każdym** komputerze i telefonie, z którego wchodzisz do aplikacji, dodaj wpis w pliku hosts
(mapowanie na IP serwera z `npm run dev`, np. `192.168.0.140`).

**Windows** (PowerShell **jako Administrator**):

```powershell
Add-Content -Path $env:Windir\System32\drivers\etc\hosts -Value "`n192.168.0.140`tontime.mikran"
```

**macOS / Linux:** `sudo sh -c 'echo "192.168.0.140 ontime.mikran" >> /etc/hosts'`

Potem w `.env` / `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://ontime.mikran:3000
LAN_DEV_HOST=ontime.mikran
```

W Supabase → **Redirect URLs:** `http://ontime.mikran:3000/**`

Otwierasz: **http://ontime.mikran:3000/login** (bez nginx trzeba podać port `:3000`).

Aby wejść **bez portu** (`http://ontime.mikran/login`), użyj nginx — [nginx.md](./nginx.md).

Jeśli zmieni się IP serwera, popraw wpis w hosts na wszystkich urządzeniach (albo użyj firmowego DNS zamiast hosts).

## Adres aplikacji

Otwieraj **ten sam host**, który masz w `.env` / `.env.local` (IP albo `ontime.mikran`):

```
http://ontime.mikran:3000/login
```

Nie używaj `localhost` na telefonie — to inny komputer.

## Uruchomienie na Macu

```bash
npm run dev
```

(`package.json` nasłuchuje na `0.0.0.0`, port 3000.)

## Zmienne środowiskowe

W `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://192.168.10.173:3000
LAN_DEV_HOST=192.168.10.173
```

Po zmianie IP w sieci zaktualizuj obie wartości i zrestartuj `npm run dev`.

## Supabase (wymagane raz)

W [Supabase Dashboard](https://supabase.com/dashboard) → projekt → **Authentication** → **URL Configuration**:

| Pole | Wartość |
|------|---------|
| **Site URL** | `http://192.168.10.173:3000` |
| **Redirect URLs** | `http://192.168.10.173:3000/**` |

Zachowaj też `http://localhost:3000/**` jeśli logujesz się z komputera.

Zapisz i odczekaj ~1 minutę.

**Authentication → Settings** (jeśli jest): wyłącz wymuszanie HTTPS / „secure cookies” na dev, jeśli blokują logowanie po HTTP.

Po nieudanym wejściu na chronioną stronę zobaczysz `/login?reason=session` z komunikatem o braku sesji.

W `next.config.ts` musi być `allowedDevOrigins` z Twoim IP — bez tego Next w dev **blokuje skrypty** z telefonu i formularz logowania tylko „odświeża” stronę (bez JavaScript).

Na **HTTP po IP** przeglądarka nie ma `crypto.randomUUID` (tylko HTTPS / localhost). Aplikacja ładuje polyfill automatycznie; jeśli widzisz ten błąd — odśwież stronę twardo (zamknij kartę).

## Działa na serwerze, nie na innym PC

1. **Najpierw po IP** (bez hosts): `http://192.168.0.140:3000/login`  
   - Działa → na drugim PC brakuje wpisu hosts dla `ontime.mikran` (patrz niżej).  
   - Nie działa → ping `192.168.0.140`, firewall na serwerze, izolacja Wi‑Fi.

2. **Hosts tylko na serwerze nie wystarczy** — na **każdym** drugim komputerze (Administrator):

   ```powershell
   cd C:\Users\Administrator\projects\Mikron
   .\scripts\setup-lan-client.ps1
   ```

   Lub ręcznie w `C:\Windows\System32\drivers\etc\hosts`:  
   `192.168.0.140    ontime.mikran`

3. **Zapora na serwerze Windows** (jednorazowo, Administrator na serwerze):

   ```powershell
   New-NetFirewallRule -DisplayName "Mikron Next.js dev (TCP 3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   ```

## Typowe problemy

- **„Tylko odświeża”** — zły `NEXT_PUBLIC_APP_URL` (localhost zamiast IP), brak redirect URL w Supabase, albo stary build (po poprawce ciasteczek zrestartuj `npm run dev`).
- **Strona się nie ładuje** — telefon i Mac w tej samej sieci Wi‑Fi; firewall Maca zezwala na Node.
- **Gość Wi‑Fi** — często blokuje dostęp do innych urządzeń w LAN.
- **`ontime.mikran` tylko na serwerze** — inne PC nie znają tej nazwy bez hosts lub firmowego DNS.

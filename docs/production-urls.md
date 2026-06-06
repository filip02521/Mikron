# URL produkcji — Mikran LAN

Aplikacja OnTime na serwerze **192.168.0.140:3000**, wewnętrzny DNS **http://ontime.mikran.pl**.

## `.env.local` (serwer produkcyjny)

```env
NEXT_PUBLIC_APP_URL=http://ontime.mikran.pl:3000
APP_SERVER_HOST=192.168.0.140
APP_PORT=3000
LAN_DEV_HOST=ontime.mikran.pl
SERVER_ACTION_ALLOWED_ORIGINS=ontime.mikran.pl,ontime.mikran.pl:3000,192.168.0.140,192.168.0.140:3000
```

Szablon: `.env.production.example`

**Ważne:** `NEXT_PUBLIC_APP_URL` musi być **identyczny** z adresem w pasku przeglądarki użytkowników.  
Jeśli wchodzą przez `http://ontime.mikran.pl` (port 80, reverse proxy), ustaw URL **bez** `:3000`.  
Jeśli wchodzą przez `:3000`, URL musi zawierać `:3000`.

Po każdej zmianie:

```bash
npm run build
npm run start
# lub restart usługi systemd
```

## Supabase — Authentication → URL Configuration

| Pole | Wartość |
|------|---------|
| **Site URL** | `http://ontime.mikran.pl:3000` |
| **Redirect URLs** | `http://ontime.mikran.pl:3000/**` |
| | `http://ontime.mikran.pl/**` (gdy proxy na 80) |
| | `http://192.168.0.140:3000/**` (fallback IP) |

Lista wygenerowana z env: `npm run setup-check`

## Skąd biorą się linki

| Funkcja | Źródło URL |
|---------|------------|
| Reset hasła / zaproszenie (admin kopiuje link) | `getAppUrl()` → `/ustaw-haslo` |
| Przycisk „Moje zamówienia” w mailu Resend | `getAppUrl()` → `/moje` |
| Ciasteczka sesji | ten sam host co w przeglądarce |

Wcześniejszy błąd produkcji: `NEXT_PUBLIC_APP_URL=http://192.168.10.173:3000` (stary Mac dev) — Supabase przekierowywał na nieistniejący host.

## Weryfikacja

1. `npm run setup-check` — sprawdza env i wypisuje Redirect URLs  
2. Admin → Użytkownicy → **Wygeneruj link resetu hasła** → otwórz w przeglądarce  
3. Powinno trafić na `/ustaw-haslo` z aktywnym formularzem (nie komunikat „Otwórz link zaproszenia…”)

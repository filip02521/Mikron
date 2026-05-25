# Test na telefonie (Wi‑Fi / LAN)

## Adres aplikacji

Na telefonie otwieraj **ten sam host**, który masz w `.env.local`:

```
http://192.168.68.51:3000/login
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
NEXT_PUBLIC_APP_URL=http://192.168.68.51:3000
LAN_DEV_HOST=192.168.68.51
```

Po zmianie IP w sieci zaktualizuj obie wartości i zrestartuj `npm run dev`.

## Supabase (wymagane raz)

W [Supabase Dashboard](https://supabase.com/dashboard) → projekt → **Authentication** → **URL Configuration**:

| Pole | Wartość |
|------|---------|
| **Site URL** | `http://192.168.68.51:3000` |
| **Redirect URLs** | `http://192.168.68.51:3000/**` |

Zachowaj też `http://localhost:3000/**` jeśli logujesz się z komputera.

Zapisz i odczekaj ~1 minutę.

**Authentication → Settings** (jeśli jest): wyłącz wymuszanie HTTPS / „secure cookies” na dev, jeśli blokują logowanie po HTTP.

Po nieudanym wejściu na chronioną stronę zobaczysz `/login?reason=session` z komunikatem o braku sesji.

W `next.config.ts` musi być `allowedDevOrigins` z Twoim IP — bez tego Next w dev **blokuje skrypty** z telefonu i formularz logowania tylko „odświeża” stronę (bez JavaScript).

Na **HTTP po IP** przeglądarka nie ma `crypto.randomUUID` (tylko HTTPS / localhost). Aplikacja ładuje polyfill automatycznie; jeśli widzisz ten błąd — odśwież stronę twardo (zamknij kartę).

## Typowe problemy

- **„Tylko odświeża”** — zły `NEXT_PUBLIC_APP_URL` (localhost zamiast IP), brak redirect URL w Supabase, albo stary build (po poprawce ciasteczek zrestartuj `npm run dev`).
- **Strona się nie ładuje** — telefon i Mac w tej samej sieci Wi‑Fi; firewall Maca zezwala na Node.
- **Gość Wi‑Fi** — często blokuje dostęp do innych urządzeń w LAN.

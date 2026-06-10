# LAN bez pliku hosts na każdym PC

Aplikacja **nie może sama** sprawić, że `ontime.mikran` zadziała na wszystkich komputerach — przeglądarka musi dostać IP z **DNS** (albo używasz samego IP).

## Opcja A — tylko IP (zero konfiguracji na klientach)

Na serwerze: `npm run dev`, zapora na port **3000**, ten sam `.env` co teraz.

Na **dowolnym** PC w LAN:

```
http://192.168.0.140:3000/login
```

W Supabase → Redirect URLs: `http://192.168.0.140:3000/**`

W `.env` na serwerze (zamiast `ontime.mikran`):

```env
NEXT_PUBLIC_APP_URL=http://192.168.0.140:3000
LAN_DEV_HOST=192.168.0.140
```

Minus: trzeba pamiętać IP; po zmianie IP w DHCP — aktualizacja `.env` i Supabase.

---

## Linode DNS + adres prywatny (192.168.x.x)

Rekord **A** `ontime.mikran.pl` → `192.168.0.140` w Linode ma sens **tylko w LAN**, i tylko gdy stacje **naprawdę pytają DNS Linode** o strefę `mikran.pl`:

1. W rejestrze domeny **mikran.pl** muszą być nameservery Linode (np. `ns1.linode.com` …).
2. Adres IP musi mieć **cztery oktety**, np. `192.168.0.140` — nie `192.168.140`.
3. PC w biurze muszą używać resolvera, który zwraca ten rekord (router z DNS Linode, albo ręcznie DNS 8.8.8.8 — wtedy zadziała, jeśli strefa jest publiczna w Linode).

**Ograniczenia:**

- Z **internetu** rekord na `192.168.x.x` i tak nie zadziała (adres prywatny).
- Jeśli PC używa tylko DNS routera/AD bez strefy `mikran.pl`, **Linode nic nie pomoże** — potrzebny rekord w AD albo hosts.

Test z dowolnego PC w biurze:

```powershell
nslookup ontime.mikran.pl
```

Oczekiwane: `192.168.0.140`. Jeśli inny wynik lub błąd — DNS jeszcze nie dociera do stacji.

---

## Opcja B — firmowy DNS (zalecane, jednorazowo u admina)

Jeden rekord w **Active Directory DNS** / wewnętrznym DNS — wszystkie PC w domenie dostają go automatycznie (bez hosts).

Przykład: strefa wewnętrzna `mikran`, host `ontime` → `192.168.0.140`.

Na **serwerze DNS** (PowerShell jako admin DNS, dostosuj strefę):

```powershell
# Strefa tylko raz, jeśli nie istnieje:
Add-DnsServerPrimaryZone -Name "mikran" -ReplicationScope "Forest" -ErrorAction SilentlyContinue

Add-DnsServerResourceRecordA -ZoneName "mikran" -Name "ontime" -IPv4Address "192.168.0.140"
```

Test z dowolnego PC w domenie:

```powershell
Resolve-DnsName ontime.mikran
```

Potem: `http://ontime.mikran:3000` — bez edycji `hosts`.

Na serwerze aplikacji w `.env`:

```env
NEXT_PUBLIC_APP_URL=http://ontime.mikran:3000
LAN_DEV_HOST=ontime.mikran
```

Supabase: `http://ontime.mikran:3000/**`

**Uwaga:** strefa `mikran` musi być obsługiwana przez DNS, którego używają stacje (zwykle DC po DHCP). Jeśli firma ma już strefę `mikran.com.pl`, lepiej rekord `ontime` w istniejącej strefie wewnętrznej.

---

## Opcja C — nazwa komputera Windows (czasem bez hosts)

Jeśli serwer jest w **domenie AD** i inne PC też, często działa:

```
http://NAZWA-SERWERA:3000
```

(gdzie `NAZWA-SERWERA` = `hostname` z `hostname` w cmd)

Wtedy w `.env`: `LAN_DEV_HOST` = ta nazwa (krótka lub FQDN), w Supabase ten sam URL.

To nie zawsze działa poza domeną / po VPN — DNS firmowy jest pewniejszy.

---

## Opcja D — router / mały DNS na serwerze aplikacji

- Routery firmowe (UniFi, MikroTik, OPNsense…) często mają **Local DNS / Static host**: `ontime.mikran` → `192.168.0.140`.
- Albo na serwerze z aplikacją: **Technitium DNS**, **dnsmasq** — a w DHCP routera ustawienie „DNS = IP serwera”.

Wtedy wszystkie urządzenia w LAN dostają nazwę bez ręcznego hosts.

---

## Czego nie da się zrobić „z samej aplikacji”

| Pomysł | Dlaczego nie |
|--------|----------------|
| Next.js / `.env` | Nie konfigurują DNS na innych PC |
| Samo `ontime.mikran` bez DNS/hosts | Nikt nie tłumaczy nazwy na IP |
| Port 80 bez proxy | Ukrywa `:3000`, ale nie rozwiązuje nazwy |

---

## Co wybrać

| Sytuacja | Rozwiązanie |
|----------|-------------|
| Szybki test, kilka osób | **IP** (`192.168.0.140:3000`) |
| Firma, domena Windows | **DNS w AD** (opcja B) |
| Bez AD, jedna sieć | **DNS w routerze** (opcja D) |
| Tylko 2–3 PC, brak admina | `hosts` na każdym (najprostsze, ale ręczne) |

# Wdrożenie: wysyłka z Gmaila, Poczta dostawców, odpowiedzi dostawców

Dotyczy: wysyłka ZD i zapytań do dostawców z Gmaila, okno wysyłki ZD (termin realizacji, Główne, plan),
mail do agencji celnej z Gmaila, odpowiedzi dostawców w karcie i na tablicy (z propozycją AI),
Zakupy → Asystent → Poczta dostawców (synchronizacja, odpowiedź, przypomnienie, licznik w menu).

## 1. Baza (PostgreSQL, rola `ontime_migrator`)

`npm run db:migrate` (używa `DATABASE_MIGRATE_URL`) — stosuje tylko brakujące pliki z `supabase/migrations`.
Wymagane migracje tej funkcji:

| Plik | Co dodaje |
| --- | --- |
| `172_google_mail_connections.sql` | połączenia Gmail, podpis w profilu, ślad wysłanych ZD |
| `173_price_list_imports.sql` | (Cenniki — jeśli jeszcze nie ma) |
| `174_supplier_inquiry_emails.sql` | „Zapytaj dostawcę” z tablicy |
| `175_oc_checks.sql` | Asystent — kontrola OC |
| `176_price_list_update_backup.sql` | (Cenniki — jeśli jeszcze nie ma) |
| `177_supplier_order_emails_resolved.sql` | „Załatwione” na wysłanym ZD |
| `178_supplier_mail.sql` | Poczta dostawców: maile, synchronizacja, wątki i przypomnienia na wysyłkach |

Po migracji: `npm run verify:deploy`.

## 2. Zmienne środowiskowe serwera (`.env`)

| Zmienna | Uwagi |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | adres HTTPS OnTime (z niego budowany jest adres zwrotny Google) |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | klient OAuth „Web application” z Google Cloud |
| `GOOGLE_OAUTH_TOKEN_KEY` | 32 bajty base64 (`openssl rand -base64 32`) — szyfruje refresh tokeny; **nie zmieniać** po wdrożeniu (stare połączenia przestaną działać) |
| `GOOGLE_AI_API_KEY` | Gemini — propozycja odpowiedzi dla handlowca (+ odczyt PDF); bez klucza przycisk AI się nie pokazuje |
| `GOOGLE_AI_GEMINI_MODEL` | opcjonalnie; domyślnie `gemini-2.5-flash`, zapasowe `gemini-flash-latest`, `gemini-flash-lite-latest` |
| `SUBIEKT_API_ORDERS_BASE_URL` | host ORDERS (wydruk ZD do PDF, zmiana terminu realizacji, tworzenie ZD) |

## 3. Google Cloud (projekt z klientem OAuth)

1. Ekran zgody: typ **Internal** (Workspace Mikranu) — wtedy zakresy Gmaila nie wymagają weryfikacji Google.
2. Włączone **Gmail API**.
3. W kliencie OAuth → *Authorized redirect URIs*: `https://<adres OnTime>/api/google/callback`.
4. Zakresy (OnTime prosi o nie sam): `openid`, `email`, `gmail.send`, `gmail.readonly`.

## 4. Subiekt API (host ORDERS, wersja 2.1.2+)

Używane: `GET /documents/zd/{id}/pdf`, `PUT /documents/zd/{id}` (`terminRealizacji`), `GET /uzytkownicy`,
`POST /documents/zd/create` z `personelId` (pole „Wystawił”). Operator dokumentu (`dok_PersonelId`) nadal
ustawia API — do zmiany po stronie API.

## 5. Po wdrożeniu (ludzie)

1. Każda osoba z zakupów: **Ustawienia → Gmail → Połącz ponownie** (zgoda na odczyt). Bez tego Poczta
   dostawców jest pusta, a odpowiedzi w karcie dostawcy i na tablicy niewidoczne.
2. Pierwsza synchronizacja skrzynki rusza sama w ciągu kilku minut (Asystent albo dowolny ekran operacji);
   maile starsze niż doba oznacza jako załatwione (bez zaległości na start), a sprawy, na które ktoś już
   odpisał w Gmailu — jako załatwione w Gmailu.
3. Asystent widzą role `admin` i `zakupy`.

## 6. Ograniczenia, o których warto wiedzieć

- Synchronizacja i blokady wysyłki działają w procesie Node (jeden serwer OnTime). Przy kilku instancjach
  potrzebny cron i blokady w bazie.
- OnTime czyta tylko maile od adresów / domen z kart dostawców (domeny ogólne typu gmail.com, wp.pl — tylko po
  pełnym adresie z karty) i zwroty. Reszty skrzynki nie przegląda.
- Kategorie (odpowiedź, potwierdzenie, faktura, wysyłka, reklama) rozpoznawane po temacie i nagłówkach — pomyłkę
  zamyka „Załatwione” (z „Cofnij”).

## 7. Szybki test na produkcji

1. Asystent → Poczta dostawców: „Skrzynka sprawdzona …”, listy wypełnione, licznik przy „Asystent” w menu.
2. Otwórz rozmowę: treść i załączniki (PDF otwiera się w karcie).
3. Kreator ZD → utwórz ZD → okno wysyłki: podgląd maila, załącznik, „Wyślij i ustaw termin” (najpierw na
   własny adres, jeśli to pierwsze uruchomienie).
4. Tablica → pytanie → „Zapytaj dostawcę”: podgląd z prawej, wysyłka; po odpowiedzi dostawcy — „Zaproponuj
   odpowiedź dla handlowca”.
5. Ustawienia → Gmail: „Połączono: …”, bez ostrzeżenia o odczycie.

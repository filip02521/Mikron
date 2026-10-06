# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Wewnętrzni pracownicy Mikranu, wszyscy na równi ważni dla tego, czy OnTime „działa”:

- **Zakupy / import** — kreator ZD, braki i zamówienia, odprawy celne, cenniki dostawców. Praca przy biurku, długie sesje na dużych listach (setki–tysiące towarów).
- **Handlowcy** — prośby o towar dla klientów i terminy dostaw; często w biegu albo w trakcie rozmowy z klientem.
- **Magazyn** — przyjęcia dostaw i kolejka realizacji, z telefonu w sieci LAN.
- **Kierownik sprzedaży / admin** — pilnowanie terminów i braków zespołu, konfiguracja (dostawcy, lokalizacje, grafiki, mapowania z Subiektem, konta).

Role w kodzie: `src/lib/nav.ts`. Zdarzają się zastępstwa (osoba spoza działu przejmuje cudze obowiązki).

## Product Purpose

OnTime zastąpił arkusz Google Sheets do cyklicznych zamówień u dostawców (POLSKA / ZAGRANICA / IMPORT) i zamówień „dla kogoś”. Łączy prośby handlowców, harmonogram zakupów i realizację dostaw w jednym miejscu, na danych z Subiekta GT (ERP Mikranu).

Sukces: każdy wie, co ma zrobić dziś, a to, co trafia do Subiekta (ZD, ceny), zgadza się z intencją i źródłem — bez cichych błędów.

## Positioning

Narzędzie szyte pod procesy Mikranu, osadzone na Subiekcie: czyta i zapisuje dokumenty oraz ceny przez własne API Subiekta (host live `:5080`, testowy `:5082`), a nie przez ręczne przepisywanie. Każdy zapis do Subiekta przechodzi przez podgląd, kontrolę i weryfikację po zapisie.

## Operating Context

- Aplikacja w sieci LAN firmy (serwer Windows, nginx, PostgreSQL), produkcja pod `ontime.mikran.pl`; desktop w biurze i telefony w magazynie.
- Subiekt GT jest źródłem prawdy dla towarów, kontrahentów, dokumentów i cen; OnTime nie zastępuje go, tylko prowadzi pracę wokół niego.
- Zewnętrzne materiały w obiegu: cenniki dostawców (Excel), faktury i dokumenty od agencji celnych, maile do dostawców.
- Interfejs w całości po polsku.

## Capabilities and Constraints

- Moduły m.in.: panel dzienny, harmonogramy dostawców, prośby i kolejka realizacji, dziennik dostaw, kreator ZD, braki, odprawy celne, cenniki, tablica pytań, urlopy.
- Baza: czysty PostgreSQL (nie Supabase); autoryzacja w warstwie aplikacji.
- Limit wgrywanych plików na produkcji ~1 MB (proxy), mimo że aplikacja deklaruje więcej.
- API Subiekta nie wszędzie ma ten sam zestaw endpointów na `:5080` i `:5082` — przed zmianą, która zapisuje do Subiekta, sprawdź dostępność na docelowym hoście.
- Brak dodatkowych stałych wymagań (język, urządzenia, dostępność) ponad powyższe — potwierdzone 2026-10-05.

## Brand Commitments

- Nazwa: **OnTime** · Mikran. Hasło w aplikacji: „Prośby handlowców, harmonogram zakupów i realizacja dostaw”.
- Logo i znak: `docs/brand/` (`ontime-logo.svg`, `ontime-logo-ciemne.svg`, `ontime-znak.svg`).

## Evidence on Hand

- Opis stosu i wzorców UI: `docs/stack-and-ui-blueprint.md`, system wizualny: `DESIGN.md`.
- Brak opinii użytkowników, metryk czy case studies — nie wymyślać ich.

## Product Principles

1. **Pewność danych przed szybkością.** Gdy szybkość i kontrola się kłócą, wygrywa kontrola: nic nie trafia do Subiekta bez podglądu, a po zapisie wynik jest sprawdzany i widoczny.
2. **Ekran mówi, co zrobić teraz.** Każdy widok zaczyna od bieżącego zadania i jego stanu, nie od statystyk.
3. **Subiekt jest źródłem prawdy.** OnTime nie tworzy równoległych danych tam, gdzie Subiekt je ma; pokazuje rozbieżności zamiast je ukrywać.
4. **Do ogarnięcia bez szkolenia.** Zastępstwa są normalne — terminologia działu, jasne stany, komunikaty z przyczyną i następnym krokiem.

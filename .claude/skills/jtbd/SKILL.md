---
name: "jtbd"
description: Analiza Jobs-to-be-Done dla funkcji OnTime — zanim zaczniesz projektować lub kodować nowy ekran, przepływ albo zmianę. Ustala, jaką "robotę" użytkownik (magazyn, handlowiec, kierownik sprzedaży, zakupy, admin) próbuje wykonać, po czym pozna sukces i co mu dziś przeszkadza. Użyj, gdy prośba brzmi jak pomysł na funkcję ("dodajmy…", "przydałby się…", "jak to uprościć"), przy planowaniu modułu, albo na /jtbd.
argument-hint: <pomysł / funkcja / problem>
---

# Jobs-to-be-Done w OnTime

Cel: zamienić pomysł na funkcję w opis **pracy, którą ktoś próbuje wykonać**, zanim powstanie jakikolwiek UI lub kod. Funkcja jest dobra tylko wtedy, gdy przyspiesza albo pewniej domyka tę pracę.

Temat: $ARGUMENTS

## Kto tu "zatrudnia" aplikację

Role z `UserRole` (`src/types/database.ts`, menu w `src/lib/nav.ts`) — zawsze wskaż, której dotyczy praca (może być kilka):

- **Magazyn (`magazyn`)** — przyjmuje dostawy, sprawdza, co przyszło i czego brakuje, pracuje często z telefonu w LAN, w biegu.
- **Handlowiec (`sales`)** — składa prośby/zamówienia dla klientów, chce wiedzieć *kiedy* towar będzie i móc to obiecać klientowi.
- **Kierownik sprzedaży (`sales_manager`)** — pilnuje terminów i braków zespołu, priorytetyzuje.
- **Zakupy / import (`zakupy`, `zakupy_zeby`)** — odpowiada na pytania z tablicy działu, aktualizuje ceny i kartoteki w Subiekcie, prowadzi ZD, pisze do dostawców, ogarnia odprawy celne.
- **Admin** — utrzymuje dane: dostawców, lokalizacje, grafiki, mapowania z Subiektem, ZD.

Praca często ma **dwie strony**: ten, kto pyta (np. handlowiec), i ten, kto odpowiada (np. zakupy). Napisz job statement dla każdej — rozwiązanie, które pomaga tylko jednej, przerzuca pracę na drugą.

Kontekst domeny: kurierzy i grafiki dostaw lokalizacji, zamówienia do dostawców (ZD) synchronizowane z Subiektem, braki, przewidywane terminy dostaw.

## Proces (przejdź po kolei, krótko)

1. **Job statement** — jedno zdanie:
   *Kiedy [sytuacja], chcę [motywacja/postęp], żeby [oczekiwany rezultat].*
   Bez nazw ekranów i przycisków. Jeśli zdanie zawiera "kliknąć", "zakładka", "lista" — to rozwiązanie, nie praca; przepisz.

2. **Kontekst wykonania** — kiedy i gdzie to się dzieje (biurko vs. magazyn z telefonem, rano przed kurierem, w trakcie rozmowy z klientem), jak często, pod jaką presją czasu.

   **Dane o tym, jak to wygląda dziś** (pytania, prośby, logi) bierz z **produkcji**, nie z lokalnej bazy z `.env.local` (to kopia dev, kończy się na dacie zrzutu). Produkcja: przeglądarka zalogowana do ontime.mikran.pl (tylko odczyt). W briefie podaj źródło i zakres dat. Dostępny jest tylko dev → powiedz to i zapytaj, zanim zaczniesz analizę.

3. **Kroki pracy dziś** — 4–8 kroków, jak użytkownik realnie to robi teraz (także poza OnTime: Subiekt, telefon do dostawcy, Excel, pamięć). Zaznacz, gdzie traci czas lub pewność.
   Gdy praca to pytanie do innej osoby, odpowiedz: **czy pytający ma już dostęp do danych, które by odpowiedziały?** Jeśli tak — dlaczego i tak pyta (dane nieaktualne, brakujące, niewiarygodne)? To zwykle jest właściwy problem.

4. **Kryteria sukcesu (desired outcomes)** — 3–6 mierzalnych, w formie:
   *Zminimalizować [czas / ryzyko / liczbę kroków] potrzebne do [czegoś].*
   Przy każdym: jak dziś (szacunek) i jak poznamy poprawę.

5. **Siły** — krótko w 4 polach: *push* (co boli w obecnym sposobie), *pull* (co przyciąga do nowego), *nawyk* (co trzyma przy starym), *obawa* (czego boi się w nowym — np. że dane z Subiekta będą nieaktualne).

6. **Co już istnieje** — zanim zaproponujesz coś nowego, sprawdź w repo (`src/app/`, `src/lib/`), czy któryś moduł częściowo wykonuje tę pracę. Nazwij pliki. Często lepiej rozszerzyć istniejący przepływ niż dodać ekran.

7. **Najmniejsza zmiana** — 1–3 opcje rozwiązania, od najmniejszej. Dla każdej: który krok z pkt 3 skraca lub usuwa i które kryterium z pkt 4 poprawia. Odrzuć opcje, które nie ruszają żadnego kryterium. Odrzuć też opcję „pokaż istniejące dane wyraźniej”, dopóki pytanie z pkt 3 nie jest wyjaśnione — jeśli ludzie pytają mimo tych danych, to dane są przyczyną pytania, a nie odpowiedzią.

## Wynik

Zwięzły brief (maks. ~1 ekran):

```
Rola: … (pyta) / … (odpowiada)
Job: Kiedy …, chcę …, żeby …
Kontekst: …
Dane: źródło (produkcja/dev) + zakres dat
Dziś: 1. … 2. … (⚠ tu traci czas)
Sukces: – Zminimalizować … (dziś ~X → cel Y)
Siły: push … / pull … / nawyk … / obawa …
Istnieje: src/app/… — robi …
Rekomendacja: [opcja] — skraca krok N, poprawia kryterium M
Otwarte pytania: …
```

## Zasady

- Nie zgaduj faktów o użytkownikach. Czego nie wiesz — zapisz w "Otwarte pytania" i zapytaj użytkownika, zamiast wymyślać.
- Nie przechodź do implementacji w tym samym kroku. Brief kończy się rekomendacją; kod dopiero po akceptacji.
- Jeśli prośba okaże się poprawką błędu albo kosmetyką bez nowej pracy użytkownika — powiedz to w jednym zdaniu i pomiń proces.

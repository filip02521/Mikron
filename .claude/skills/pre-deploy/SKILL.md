---
name: pre-deploy
description: Odpala sprawdzenia przed wdrożeniem (lint, testy, verify:deploy) i zbiera wynik w jeden raport. Użycie: /pre-deploy [quick]
disable-model-invocation: true
argument-hint: "[quick]"
---

Uruchom kontrolę przed wdrożeniem. Argument: $ARGUMENTS

## Kroki (w tej kolejności, każdy krok uruchom nawet jeśli poprzedni padł)

1. `npx tsc --noEmit` — typy.
2. `npm run lint` — ESLint.
3. `npm test` — Vitest.
4. `npm run verify:deploy` — env auth/DB + audyty (admin-mutations, db-access, server-action-redirect).
   Pomiń, jeśli argument to `quick`. Wymaga `.env.local` z `DATABASE_URL`; jeśli brak env, oznacz krok jako POMINIĘTY z powodem, nie jako błąd.

Nie uruchamiaj `test:e2e`, `db:migrate` ani `verify:deploy:postgres` — zmieniają stan lub są wolne; wspomnij o nich tylko, jeśli zmiany dotyczą migracji (`git diff --name-only main...HEAD -- supabase/migrations`).

## Raport

Tabela: krok | wynik (OK / BŁĄD / POMINIĘTY) | czas | liczba problemów.
Pod tabelą, dla każdego BŁĘDU: maks. 10 najważniejszych linii wyjścia ze ścieżką:linią.
Ostatnia linia: **GOTOWE DO WDROŻENIA** albo **NIE WDRAŻAĆ** + jednozdaniowy powód.
Niczego nie naprawiaj automatycznie — zapytaj, czy naprawić.

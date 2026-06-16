# Dziennik dostaw (magazyn)

Rola **Dział dostaw** (`magazyn`) ma dostęp wyłącznie do **Magazyn i regał** (`/kolejka`).

## Zakładki

1. **Przyjęcie towaru** — kolejka prośb handlowców (status Zamówione).
2. **Dziennik dostaw** — fizyczne dostawy na rampę (kurier, paczki, palety) zamiast Excela.
3. **Inwentaryzacja regału** — co leży na magazynie.

Data wpisu = **dziś (Europe/Warsaw)** — bez ręcznego wpisywania. Edycja i usuwanie tylko wpisów z bieżącego dnia.

## Widoki (rola magazyn)

Rola **Dział dostaw** w zakładce **Dziennik dostaw** ma podzakładki:

1. **Wpisy na dziś** — szybkie dodawanie (Ctrl+Enter), edycja i usuwanie tylko dzisiejszych wpisów.
2. **Archiwum i raporty** — wyszukiwanie po zakresie dat (presety: dziś / tydzień / 7 dni / miesiąc), filtr dostawcy i kuriera, podsumowanie (dostawy, paczki, palety, dostawcy, tabela kurierów).

**Administrator** i **zakupy** na `/kolejka`: jeden widok z **wyborem daty** (podgląd archiwum, bez edycji). Bez podzakładki „Archiwum i raporty” — pełne wyszukiwanie i raporty ma rola **magazyn**.

## Kurierzy (lista w formularzu)

Katalog: tabela `warehouse_carriers` (edycja z UI w dzienniku — link „Zarządzaj listą” przy polu kuriera). Ukryty kurier znika z wyboru, ale zostaje w historii wpisów. Seed startowy w migracji `064_warehouse_carriers_catalog.sql`.

## Podpowiedź kuriera

Po wybraniu **dostawcy z listy** system ustawia kurier / formę / typowe liczby:

1. **Domyślny kurier** w katalogu dostawców (Administracja → Dostawcy), jeśli ustawiony.
2. W przeciwnym razie **historia wpisów** (`warehouse_carrier_hints`).

Dostawca spoza listy („inny”) — kurier ręcznie.

Migracja: `038_supplier_default_delivery.sql` (kolumny `default_delivery_carrier`, `default_delivery_shipment_form` na `suppliers`).

## Migracja

`supabase/migrations/036_magazyn_role_enum.sql` oraz `037_magazyn_delivery_journal.sql`

## Konta

Administracja → Konta → rola **Dział dostaw**.

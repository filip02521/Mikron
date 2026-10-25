# Dziennik dostaw (magazyn)

Rola **Dział dostaw** (`magazyn`) ma w menu: **Przyjęcie towaru** (`/kolejka`), **Plan dostaw** (`/dostawy`), notatki magazynu i urlopy działu (`magazynNavGroups` w `src/lib/nav.ts`). Dziennik dostaw jest częścią `/kolejka`.

## Zakładki

1. **Przyjęcie towaru** — kolejka prośb handlowców (status Zamówione).
2. **Dziennik dostaw** — fizyczne dostawy na rampę (kurier, paczki, palety) zamiast Excela.
3. **Inwentaryzacja regału** — co leży na magazynie.

Data wpisu = **dziś (Europe/Warsaw)** — bez ręcznego wpisywania. Edycja i usuwanie tylko wpisów z bieżącego dnia.

## Widoki

Dziennik ma dwa widoki (`src/components/queue/DeliveryJournalSection.tsx`):

1. **Dzień** — wpisy z wybranej daty i podsumowanie dnia (dostawy, paczki, palety, dostawcy); dodawanie, edycja i usuwanie tylko dla dzisiejszej daty.
2. **Archiwum** — wyszukiwanie paczek i podsumowania za zakres dat.

Edytować mogą osoby z dostępem do magazynu (`canAccessWarehouse` w `src/lib/auth-roles.ts`): przy przypisanych obszarach roboczych — obszar `dostawy` lub `magazyn`, bez nich — role `admin`, `zakupy`, `magazyn`. Pozostali widzą dziennik bez edycji.

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

## Retencja

Wpisy dziennika starsze niż **3 miesiące** są usuwane automatycznie (wraz z historią zamówień) — ok. raz na dobę przy aktywności lub przez poranny cron.

## Konta

Administracja → Konta → rola **Dział dostaw**.

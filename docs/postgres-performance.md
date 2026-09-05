# Checklist wydajności po F3 P1 (hot paths)

Na staging:

```sql
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();
```

EXPLAIN (ANALYZE, BUFFERS) na:

- `/moje` — `src/lib/data/queries.ts`
- panel dzienny — `src/lib/services/orders.ts`
- `/zeby`
- `/zakupy/szacunek`
- cron `zd-eta-sync`

Kryteria:

- brak seq scan na tabelach >100k wierszy
- indeksy z `108_fk_indexes.sql` obecne

Po tygodniu na produkcji wyłączyć verbose logging.

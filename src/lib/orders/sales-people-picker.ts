export type SalesPersonPickRow = {
  id: string;
  name: string;
  email?: string | null;
};

/** Jedna osoba na id — na wypadek zduplikowanych wierszy w źródle. */
export function normalizeSalesPeopleForPicker(
  rows: SalesPersonPickRow[]
): SalesPersonPickRow[] {
  const byId = new Map<string, SalesPersonPickRow>();
  for (const row of rows) {
    const id = row.id?.trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      name: row.name?.trim() || "—",
      email: row.email?.trim() || null,
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export function filterSalesPeopleByQuery(
  people: SalesPersonPickRow[],
  query: string,
  limit = 15
): SalesPersonPickRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return people.slice(0, limit);
  const out: SalesPersonPickRow[] = [];
  for (const p of people) {
    const hay = `${p.name} ${p.email ?? ""}`.toLowerCase();
    if (!hay.includes(q)) continue;
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

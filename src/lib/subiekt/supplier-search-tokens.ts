/** Warianty frazy do wyszukiwania dostawcy (Subiekt + lista w aplikacji). */

function pushUnique(out: string[], value: string) {
  const v = value.trim();
  if (v.length < 2) return;
  if (!out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
}

/** Np. „W&H” → także „W H”, „WH” — API Subiekt często nie znajduje po ampersandzie. */
export function expandSupplierSearchQueries(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const out: string[] = [];
  pushUnique(out, trimmed);

  if (trimmed.includes("&")) {
    pushUnique(out, trimmed.replace(/\s*&\s*/g, " "));
    pushUnique(out, trimmed.replace(/&/g, ""));
    pushUnique(out, trimmed.replace(/\s*&\s*/g, " & "));
  }

  return out;
}

/** Czy nazwa dostawcy pasuje do zapytania (z uwzględnieniem wariantów). */
export function supplierNameMatchesQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes(q)) return true;
  return expandSupplierSearchQueries(query).some((variant) =>
    normalizedName.includes(variant.toLowerCase())
  );
}

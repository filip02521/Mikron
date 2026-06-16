/** Slug kuriera z etykiety (stabilny identyfikator w bazie). */
export function slugifyWarehouseCarrierLabel(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

  return base || "kurier";
}

export function uniqueWarehouseCarrierSlug(
  label: string,
  taken: Set<string>,
  excludeSlug?: string
): string {
  const base = slugifyWarehouseCarrierLabel(label);
  if (!taken.has(base) || base === excludeSlug) return base;

  let n = 2;
  while (taken.has(`${base}_${n}`) && `${base}_${n}` !== excludeSlug) {
    n += 1;
  }
  return `${base}_${n}`;
}

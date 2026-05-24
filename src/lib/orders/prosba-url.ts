/** Link do formularza prośby z opcjonalnym handlowcem (kierownik) i dostawcą. */
export function prosbaHref(options?: {
  salesPersonId?: string;
  supplierId?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.salesPersonId) params.set("dla", options.salesPersonId);
  if (options?.supplierId) params.set("dostawca", options.supplierId);
  const query = params.toString();
  return query ? `/prosba?${query}` : "/prosba";
}

export function resolveProsbaSupplierId(
  dostawca: string | undefined,
  supplierIds: Set<string> | string[]
): string | undefined {
  if (!dostawca?.trim()) return undefined;
  const id = dostawca.trim();
  const allowed =
    supplierIds instanceof Set ? supplierIds : new Set(supplierIds);
  return allowed.has(id) ? id : undefined;
}

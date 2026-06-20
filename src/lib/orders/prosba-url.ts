import type { IndividualRequestKind } from "@/types/database";

/** Link do formularza prośby z opcjonalnym handlowcem (kierownik) i dostawcą. */
export function prosbaHref(options?: {
  salesPersonId?: string;
  supplierId?: string;
  /** Prefill z karty ZK w notatniku — linie produktów w sessionStorage. */
  fromZk?: boolean;
  zkWatchId?: string | null;
  zk?: string;
  klient?: string;
  clientKhId?: number | null;
  /** Klucze linii ZK (uzupełniająca prośba) — przetrwa otwarcie w nowej karcie. */
  zkLineKeys?: string[];
  requestKind?: IndividualRequestKind;
}): string {
  const params = new URLSearchParams();
  if (options?.salesPersonId) params.set("dla", options.salesPersonId);
  if (options?.supplierId) params.set("dostawca", options.supplierId);
  if (options?.fromZk) params.set("fromZk", "1");
  if (options?.zkWatchId?.trim()) params.set("zkWatch", options.zkWatchId.trim());
  if (options?.zk?.trim()) params.set("zk", options.zk.trim());
  if (options?.klient?.trim()) params.set("klient", options.klient.trim().slice(0, 80));
  if (options?.zkLineKeys?.length) {
    params.set("zkLines", options.zkLineKeys.join(","));
  }
  if (options?.requestKind === "informacja") {
    params.set("rodzaj", "informacja");
  }
  const kh = options?.clientKhId;
  if (kh != null && Number.isFinite(kh) && kh > 0) {
    params.set("kh", String(Math.trunc(kh)));
  }
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

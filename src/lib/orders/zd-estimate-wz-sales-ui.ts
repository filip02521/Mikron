/**
 * Minimalny dopisek WZ niepowiązanych pod kolumną Sprzed. (Kreator ZD).
 * Ilości w sztukach wyświetlanych w komórce (po merge pary = sztuki złączone).
 */

const WZ_EPS = 1e-9;

export function asWzNiepowiazaneQty(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

export function formatWzSalesSubline(
  wzNiepowiazane: unknown,
  formatQty: (n: number) => string
): string | null {
  const wz = asWzNiepowiazaneQty(wzNiepowiazane);
  if (!(wz > WZ_EPS)) return null;
  return `w tym WZ ${formatQty(wz)}`;
}

export function formatWzSalesTitle(input: {
  sprzedazOkres: unknown;
  wzNiepowiazaneOkres: unknown;
  formatQty: (n: number) => string;
  /** Dodatkowe linie (np. kanały pary). */
  extraParts?: readonly (string | null | undefined)[];
}): string {
  const sales = Math.max(0, asWzNiepowiazaneQty(input.sprzedazOkres));
  const wz = Math.min(asWzNiepowiazaneQty(input.wzNiepowiazaneOkres), sales);
  const fs = Math.max(0, sales - wz);
  const parts = [
    `Sprzedaż: ${input.formatQty(sales)} szt · FS+PA ${input.formatQty(fs)} + WZ niepowiązane ${input.formatQty(wz)}`,
    ...(input.extraParts ?? []).filter(
      (p): p is string => typeof p === "string" && p.trim() !== ""
    ),
  ];
  return parts.join(" · ");
}

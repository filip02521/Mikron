type VacationColor = { bg: string; text: string; dot: string };

/**
 * Kolejność maksymalizuje różnicę odcieni między sąsiednimi osobami (pierwsze dwie, trzy
 * osoby w grupie muszą się wyraźnie różnić). Kropki w nasyceniu 500 — jasne 300 zlewały się
 * (indygo / niebieski / fiolet).
 */
const PALETTE: VacationColor[] = [
  { bg: "bg-sky-100", text: "text-sky-800", dot: "bg-sky-500" },
  { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" },
  { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-600" },
  { bg: "bg-rose-100", text: "text-rose-800", dot: "bg-rose-500" },
  { bg: "bg-violet-100", text: "text-violet-800", dot: "bg-violet-500" },
  { bg: "bg-lime-100", text: "text-lime-800", dot: "bg-lime-500" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-800", dot: "bg-fuchsia-500" },
  { bg: "bg-slate-200", text: "text-slate-800", dot: "bg-slate-500" },
];

export function vacationColorForIndex(index: number): VacationColor {
  return PALETTE[index % PALETTE.length];
}

export function vacationColorMap<T extends { id: string }>(
  salesPeople: T[]
): Map<string, VacationColor> {
  const map = new Map<string, VacationColor>();
  salesPeople.forEach((sp, i) => {
    map.set(sp.id, vacationColorForIndex(i));
  });
  return map;
}

/** Siatka miesiąca: od sm sobota i niedziela węższe (na telefonie równe — „Niedz” by się nie mieściło) — nie są dniami pracy, więc oddają miejsce dniom roboczym. */
export const vacationMonthGridClass =
  "grid grid-cols-7 sm:grid-cols-[repeat(5,minmax(0,1fr))_repeat(2,minmax(0,0.6fr))]";

/** Weekend bez urlopów: delikatne ukośne kreskowanie zamiast pustej komórki. */
export const vacationWeekendCellClass =
  "bg-slate-50 [background-image:repeating-linear-gradient(135deg,var(--color-slate-200)_0_1px,transparent_1px_7px)]";

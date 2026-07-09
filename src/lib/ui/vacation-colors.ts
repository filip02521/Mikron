type VacationColor = { bg: string; text: string; dot: string };

const PALETTE: VacationColor[] = [
  { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-300" },
  { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-300" },
  { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-300" },
  { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-300" },
  { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-300" },
  { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-300" },
  { bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-300" },
  { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-300" },
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

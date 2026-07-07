type VacationColor = { bg: string; text: string; dot: string };

const PALETTE: VacationColor[] = [
  { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-400" },
  { bg: "bg-indigo-100", text: "text-indigo-800", dot: "bg-indigo-400" },
  { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-400" },
  { bg: "bg-violet-100", text: "text-violet-800", dot: "bg-violet-400" },
  { bg: "bg-sky-100", text: "text-sky-800", dot: "bg-sky-400" },
  { bg: "bg-rose-100", text: "text-rose-800", dot: "bg-rose-400" },
  { bg: "bg-teal-100", text: "text-teal-800", dot: "bg-teal-400" },
  { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-400" },
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

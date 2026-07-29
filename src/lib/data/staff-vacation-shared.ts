/** Etykiety urlopów kadry — bezpieczne dla klienta (bez I/O Supabase). */

import type { UserRole } from "@/types/database";

export type StaffVacationCategory =
  | "urlop"
  | "nadgodziny"
  | "na_zadanie"
  | "chorobowe"
  | "osobiste"
  | "inne";

export const STAFF_VACATION_CATEGORIES: {
  value: StaffVacationCategory;
  label: string;
  shortLabel: string;
}[] = [
  { value: "urlop", label: "Urlop wypoczynkowy", shortLabel: "Urlop" },
  { value: "nadgodziny", label: "Odbiór nadgodzin", shortLabel: "Nadgodziny" },
  { value: "na_zadanie", label: "Urlop na żądanie", shortLabel: "Na żądanie" },
  { value: "chorobowe", label: "L4 / Chorobowe", shortLabel: "L4" },
  { value: "osobiste", label: "Sprawa osobista", shortLabel: "Osobiste" },
  { value: "inne", label: "Inne (z notatką)", shortLabel: "Inne" },
];

export function staffVacationCategoryLabel(cat: string): string {
  return STAFF_VACATION_CATEGORIES.find((c) => c.value === cat)?.label ?? "Urlop";
}

export function staffVacationCategoryShort(cat: string): string {
  return STAFF_VACATION_CATEGORIES.find((c) => c.value === cat)?.shortLabel ?? "Urlop";
}

export type StaffVacationRow = {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  category: StaffVacationCategory;
  startDate: string;
  endDate: string;
  note: string | null;
  createdAt: string;
};

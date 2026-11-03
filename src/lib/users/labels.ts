import type { UserRole } from "@/types/database";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  zakupy: "Dział zakupów",
  zakupy_zeby: "Dział zakupów - Zęby",
  magazyn: "Dział dostaw",
  sales: "Handlowiec",
  sales_manager: "Kierownictwo",
  serwis: "Serwis",
};

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: ROLE_LABELS.admin },
  { value: "zakupy", label: ROLE_LABELS.zakupy },
  { value: "zakupy_zeby", label: ROLE_LABELS.zakupy_zeby },
  { value: "magazyn", label: ROLE_LABELS.magazyn },
  { value: "sales", label: ROLE_LABELS.sales },
  { value: "sales_manager", label: ROLE_LABELS.sales_manager },
  { value: "serwis", label: ROLE_LABELS.serwis },
];

export function roleRequiresSalesPerson(role: UserRole): boolean {
  // Serwisant składa prośby o części jak handlowiec — na własną kartę w grupie Serwis.
  return role === "sales" || role === "sales_manager" || role === "serwis";
}

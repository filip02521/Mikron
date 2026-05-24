import type { UserRole } from "@/types/database";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  zakupy: "Dział zakupów",
  sales: "Handlowiec",
  sales_manager: "Kierownik handlowców",
};

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: ROLE_LABELS.admin },
  { value: "zakupy", label: ROLE_LABELS.zakupy },
  { value: "sales", label: ROLE_LABELS.sales },
  { value: "sales_manager", label: ROLE_LABELS.sales_manager },
];

export function roleRequiresSalesPerson(role: UserRole): boolean {
  return role === "sales" || role === "sales_manager";
}

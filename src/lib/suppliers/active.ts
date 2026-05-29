import { cn } from "@/lib/cn";

/** Domyślnie aktywny (brak kolumny w starych mockach). */
export function isSupplierActive(s: { is_active?: boolean | null }): boolean {
  return s.is_active !== false;
}

export function inactiveSupplierRowClass(isActive: boolean): string {
  return cn(!isActive && "bg-slate-50/90 opacity-75");
}

export function inactiveSupplierNameClass(isActive: boolean): string {
  return cn(!isActive && "text-slate-500");
}

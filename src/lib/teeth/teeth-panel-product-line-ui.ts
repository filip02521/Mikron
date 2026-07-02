import type { TeethProductLine } from "@/lib/teeth/teeth-catalog-types";

/** Klasy badge linii produktowej — spójne z tonami nawigacji panelu zębów. */
export function teethProductLineBadgeClass(productLine: TeethProductLine | null): string {
  if (!productLine) {
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
  }
  if (productLine === "wiedent_estetic_vita") {
    return "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80";
  }
  if (productLine === "dentex_amberlux_v") {
    return "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80";
  }
  if (productLine === "wiedent_estetic_om") {
    return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80";
  }
  if (productLine === "wiedent_estetic" || productLine === "wiedent_classic") {
    return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80";
  }
  if (productLine === "wiedent_almamiss") {
    return "bg-rose-100 text-rose-900 ring-1 ring-rose-200/80";
  }
  if (productLine.startsWith("ivoclar")) {
    return "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/80";
  }
  if (productLine.startsWith("major") || productLine.startsWith("dentex")) {
    return "bg-violet-100 text-violet-900 ring-1 ring-violet-200/80";
  }
  return "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80";
}

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

export type TeethProductLineAccent = {
  /** Kropka / pasek przy nagłówku sekcji linii. */
  dot: string;
  /** Tło nagłówka sekcji. */
  header: string;
  /** Tekst nazwy linii. */
  text: string;
};

const LINE_ACCENTS: Record<TeethProductLine, TeethProductLineAccent> = {
  wiedent_classic: { dot: "bg-emerald-500", header: "bg-emerald-50/70", text: "text-emerald-900" },
  wiedent_almamiss: { dot: "bg-rose-500", header: "bg-rose-50/70", text: "text-rose-900" },
  wiedent_estetic: { dot: "bg-teal-500", header: "bg-teal-50/70", text: "text-teal-900" },
  wiedent_estetic_vita: { dot: "bg-sky-500", header: "bg-sky-50/70", text: "text-sky-900" },
  wiedent_estetic_om: { dot: "bg-amber-500", header: "bg-amber-50/70", text: "text-amber-950" },
  ivoclar_ivostar: { dot: "bg-indigo-500", header: "bg-indigo-50/70", text: "text-indigo-900" },
  ivoclar_gnathostar: { dot: "bg-cyan-600", header: "bg-cyan-50/70", text: "text-cyan-900" },
  ivoclar_phonares_ii: { dot: "bg-violet-500", header: "bg-violet-50/70", text: "text-violet-900" },
  ivoclar_vivodent_dcl: { dot: "bg-fuchsia-500", header: "bg-fuchsia-50/70", text: "text-fuchsia-900" },
  ivoclar_orthotyp_dcl: { dot: "bg-blue-600", header: "bg-blue-50/70", text: "text-blue-900" },
  major_super_lux: { dot: "bg-orange-500", header: "bg-orange-50/70", text: "text-orange-950" },
  major_composite: { dot: "bg-lime-600", header: "bg-lime-50/70", text: "text-lime-900" },
  major_dent: { dot: "bg-yellow-500", header: "bg-yellow-50/70", text: "text-yellow-950" },
  dentex_amberlux: { dot: "bg-purple-500", header: "bg-purple-50/70", text: "text-purple-900" },
  dentex_amberlux_v: { dot: "bg-pink-500", header: "bg-pink-50/70", text: "text-pink-900" },
  schottlander_enigmalife: { dot: "bg-green-600", header: "bg-green-50/70", text: "text-green-900" },
  hansen_generic: { dot: "bg-stone-500", header: "bg-stone-50", text: "text-stone-900" },
  mgm_generic: { dot: "bg-zinc-500", header: "bg-zinc-50", text: "text-zinc-900" },
  formed_generic: { dot: "bg-neutral-500", header: "bg-neutral-50", text: "text-neutral-900" },
};

const UNKNOWN_LINE_ACCENT: TeethProductLineAccent = {
  dot: "bg-slate-300",
  header: "bg-slate-50",
  text: "text-slate-600",
};

/** Stały kolor linii — Phonares zawsze ten sam, niezależnie od dostawcy i widoku. */
export function teethProductLineAccent(productLine: TeethProductLine | null): TeethProductLineAccent {
  return productLine ? LINE_ACCENTS[productLine] : UNKNOWN_LINE_ACCENT;
}

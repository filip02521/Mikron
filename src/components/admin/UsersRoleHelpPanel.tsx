"use client";

import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS } from "@/lib/users/labels";
import { roleBadgeClass } from "@/lib/ui/ontime-theme";
import type { UserRole } from "@/types/database";

const ROLE_HELP: { role: UserRole; description: string }[] = [
  {
    role: "admin",
    description: "Pełny dostęp, historia zamówień i ten panel administracyjny.",
  },
  {
    role: "zakupy",
    description: "Panel dzienny, kolejka, harmonogramy - bez administracji.",
  },
  {
    role: "magazyn",
    description: "Kolejka magazynu i regał - bez panelu zakupów.",
  },
  {
    role: "sales",
    description: "Moje zamówienia, prośby i podgląd planu - bez zamawiania towaru.",
  },
  {
    role: "sales_manager",
    description:
      "Jak handlowiec plus zespół - przypisz grupy (Sklep/Biuro), żeby widział tylko swoich ludzi.",
  },
];

/** Zwijany opis ról — spójny z panelem narzędzi administracyjnych. */
export function UsersRoleHelpPanel() {
  return (
    <details className="group overflow-hidden rounded-[var(--radius-panel)] border border-slate-200 bg-[var(--card)] shadow-[var(--shadow-card)]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 py-3 text-base font-semibold text-slate-900 marker:content-none hover:bg-slate-50 sm:px-5 lg:px-6 [&::-webkit-details-marker]:hidden">
        <span className="flex w-full items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            Opis ról
            <Badge variant="default" className="font-normal">
              {ROLE_HELP.length}
            </Badge>
          </span>
          <IconChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </span>
      </summary>
      <ul className="divide-y divide-slate-100 border-t border-slate-100 px-4 pb-3 sm:px-5 sm:pb-4 lg:px-6">
        {ROLE_HELP.map(({ role, description }) => (
          <li key={role} className="flex flex-col gap-1.5 py-3 first:pt-3 sm:flex-row sm:items-start sm:gap-3">
            <span className={roleBadgeClass(role)}>{ROLE_LABELS[role]}</span>
            <p className="text-sm leading-relaxed text-slate-600">{description}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

"use client";

import Link from "next/link";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { canAccessPath } from "@/lib/auth-roles";
import {
  CHANGELOG_ENTRIES,
  CHANGELOG_CATEGORY_META,
  type ChangelogEntry,
} from "@/lib/changelog/changelog-entries";
import { IconSparkles } from "@/components/icons/StrokeIcons";
import type { UserRole } from "@/types/database";

const MONTHS_PL = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

function formatDatePl(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_PL[m - 1]} ${y}`;
}

function filterEntriesByRole(
  entries: ChangelogEntry[],
  role: UserRole | null,
): ChangelogEntry[] {
  if (!role) return entries.filter((e) => e.audience === "all");
  return entries.filter((e) => {
    if (e.audience === "all") return true;
    if (e.audience === "admin") return role === "admin";
    if (e.audience === "sales")
      return role === "sales" || role === "sales_manager";
    if (e.audience === "operations")
      return role === "zakupy" || role === "magazyn" || role === "admin";
    if (e.audience === "teeth") return role === "zakupy_zeby" || role === "admin";
    return false;
  });
}

function canAccessLink(role: UserRole | null, href: string): boolean {
  if (!role) return false;
  return canAccessPath(role, href);
}

function polishCountLabel(n: number): string {
  if (n === 1) return "1 zmiana";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} zmiany`;
  }
  return `${n} zmian`;
}

type EntryTier = "highlight" | "normal" | "minor";

function getTier(entry: ChangelogEntry): EntryTier {
  if (entry.highlight) return "highlight";
  if (entry.minor) return "minor";
  return "normal";
}

const SECTION_LABELS: Record<EntryTier, string> = {
  highlight: "Najważniejsze zmiany",
  normal: "Nowości i ulepszenia",
  minor: "Drobne poprawki",
};

const tierCardClass: Record<EntryTier, string> = {
  highlight:
    "rounded-md border border-indigo-200/70 bg-gradient-to-b from-indigo-50/40 to-white px-5 py-4 shadow-sm shadow-indigo-100/30",
  normal:
    "rounded-md border border-slate-200/80 bg-white px-4 py-3 shadow-[var(--shadow-card)]",
  minor:
    "rounded-md border border-slate-200/50 bg-slate-50/40 px-3.5 py-2.5",
};

const tierTitleClass: Record<EntryTier, string> = {
  highlight: "text-base font-semibold tracking-tight text-slate-900",
  normal: "text-sm font-semibold text-slate-900",
  minor: "text-xs font-semibold text-slate-700",
};

const tierDescClass: Record<EntryTier, string> = {
  highlight: "text-sm leading-relaxed text-slate-600",
  normal: "text-xs leading-relaxed text-slate-600",
  minor: "text-[11px] leading-relaxed text-slate-500",
};

const tierBadgeClass: Record<EntryTier, string> = {
  highlight: "rounded-full px-2.5 py-0.5 text-xs font-semibold",
  normal: "rounded-full px-2 py-0.5 text-[11px] font-semibold",
  minor: "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
};

const tierLinkClass: Record<EntryTier, string> = {
  highlight:
    "inline-flex items-center gap-1 text-sm font-medium text-indigo-700 transition-colors hover:text-indigo-900 hover:underline underline-offset-2",
  normal:
    "inline-flex items-center gap-1 text-xs font-medium text-indigo-700 transition-colors hover:text-indigo-900 hover:underline underline-offset-2",
  minor:
    "inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 transition-colors hover:text-indigo-800",
};

const tierGapClass: Record<EntryTier, string> = {
  highlight: "space-y-2.5",
  normal: "space-y-2",
  minor: "space-y-1.5",
};

function EntryCard({
  entry,
  tier,
  role,
  onClose,
  index,
}: {
  entry: ChangelogEntry;
  tier: EntryTier;
  role: UserRole | null;
  onClose: () => void;
  index: number;
}) {
  const meta = CHANGELOG_CATEGORY_META[entry.category];
  const showLink = entry.link && canAccessLink(role, entry.link.href);

  return (
    <div
      className={cn("changelog-entry-enter", tierGapClass[tier], tierCardClass[tier])}
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <div className="flex items-center gap-2">
        <span className={cn(tierBadgeClass[tier], meta.badgeClass)}>
          {meta.label}
        </span>
        {tier === "highlight" && (
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden />
        )}
      </div>
      <h3 className={tierTitleClass[tier]}>{entry.title}</h3>
      <p className={tierDescClass[tier]}>{entry.description}</p>
      {showLink ? (
        <Link
          href={entry.link!.href}
          onClick={onClose}
          className={tierLinkClass[tier]}
        >
          {entry.link!.label}
          <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}

export function ChangelogModal({
  open,
  onClose,
  role,
}: {
  open: boolean;
  onClose: () => void;
  role: UserRole | null;
}) {
  const filtered = filterEntriesByRole(CHANGELOG_ENTRIES, role);
  const latestEntry = filtered[0] ?? null;

  const highlights = filtered.filter((e) => getTier(e) === "highlight");
  const normals = filtered.filter((e) => getTier(e) === "normal");
  const minors = filtered.filter((e) => getTier(e) === "minor");

  let runningIndex = 0;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="lg"
      tier="standard"
      footer={
        <Button variant="primary" size="md" onClick={onClose}>
          Przeczytałem, dziękuję
        </Button>
      }
    >
      {/* Branded header */}
      <header className="shrink-0 border-b border-indigo-100/80 bg-gradient-to-b from-indigo-50/50 to-white px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-[var(--shadow-brand)] ring-1 ring-sky-500/30">
            <IconSparkles className="h-5.5 w-5.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Co nowego w systemie
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {latestEntry
                ? `Aktualizacja z ${formatDatePl(latestEntry.date)} · ${polishCountLabel(filtered.length)}`
                : "Historia zmian w systemie"}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Brak zmian do wyświetlenia.
          </p>
        ) : (
          <>
            {highlights.length > 0 && (
              <section className="space-y-2.5">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                  {SECTION_LABELS.highlight}
                </h4>
                {highlights.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    tier="highlight"
                    role={role}
                    onClose={onClose}
                    index={runningIndex++}
                  />
                ))}
              </section>
            )}

            {normals.length > 0 && (
              <section className="space-y-2.5">
                {highlights.length > 0 && (
                  <div className="border-t border-slate-100" />
                )}
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {SECTION_LABELS.normal}
                </h4>
                <div className="space-y-2">
                  {normals.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      tier="normal"
                      role={role}
                      onClose={onClose}
                      index={runningIndex++}
                    />
                  ))}
                </div>
              </section>
            )}

            {minors.length > 0 && (
              <section className="space-y-2">
                {(highlights.length > 0 || normals.length > 0) && (
                  <div className="border-t border-slate-100" />
                )}
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {SECTION_LABELS.minor}
                </h4>
                <div className="space-y-1.5">
                  {minors.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      tier="minor"
                      role={role}
                      onClose={onClose}
                      index={runningIndex++}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}

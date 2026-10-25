"use client";

import Link from "next/link";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { canAccessPath } from "@/lib/auth-roles";
import {
  CHANGELOG_ENTRIES,
  CHANGELOG_CATEGORY_META,
  type ChangelogCategory,
  type ChangelogEntry,
} from "@/lib/changelog/changelog-entries";
import { Badge } from "@/components/ui/Badge";
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

// Wpisy to treść jednej karty okna: grupuje je linia, a najważniejsze leżą na bloku `well` (bez ramek i cieni).
const tierCardClass: Record<EntryTier, string> = {
  highlight: "rounded-lg bg-slate-50 px-4 py-3.5",
  normal: "py-3",
  minor: "py-2",
};

const tierTitleClass: Record<EntryTier, string> = {
  highlight: "text-base font-semibold tracking-[-0.01em] text-slate-900",
  normal: "text-sm font-semibold text-slate-900",
  minor: "text-[0.8125rem] font-medium text-slate-800",
};

const tierDescClass: Record<EntryTier, string> = {
  highlight: "text-sm leading-relaxed text-slate-600",
  normal: "text-[0.8125rem] leading-relaxed text-slate-600",
  minor: "text-xs leading-relaxed text-slate-500",
};

const tierLinkClass: Record<EntryTier, string> = {
  highlight:
    "inline-flex items-center gap-1 text-sm font-medium text-indigo-700 underline-offset-2 transition-colors hover:text-indigo-900 hover:underline",
  normal:
    "inline-flex items-center gap-1 text-xs font-medium text-indigo-700 underline-offset-2 transition-colors hover:text-indigo-900 hover:underline",
  minor:
    "inline-flex items-center gap-1 text-xs font-medium text-indigo-700 underline-offset-2 transition-colors hover:text-indigo-900 hover:underline",
};

const tierGapClass: Record<EntryTier, string> = {
  highlight: "space-y-1.5",
  normal: "space-y-1.5",
  minor: "space-y-1",
};

/** Rodzaj zmiany to etykieta, nie stan: tylko „Nowość” dostaje Petrol. */
const categoryBadgeVariant: Record<ChangelogCategory, "info" | "default"> = {
  new: "info",
  improvement: "default",
  fix: "default",
};

const sectionTitleClass = "text-xs font-semibold text-slate-600";

function EntryCard({
  entry,
  tier,
  role,
  onClose,
}: {
  entry: ChangelogEntry;
  tier: EntryTier;
  role: UserRole | null;
  onClose: () => void;
}) {
  const meta = CHANGELOG_CATEGORY_META[entry.category];
  const showLink = entry.link && canAccessLink(role, entry.link.href);

  return (
    <div className={cn(tierGapClass[tier], tierCardClass[tier])}>
      <Badge variant={categoryBadgeVariant[entry.category]}>{meta.label}</Badge>
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

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="lg"
      tier="standard"
      footer={
        <Button variant="primary" size="md" className="min-h-11 sm:min-h-0" onClick={onClose}>
          Przeczytałem, dziękuję
        </Button>
      }
    >
      <header className="shrink-0 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-[-0.015em] text-slate-900">
              Co nowego w systemie
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {latestEntry
                ? `Aktualizacja z ${formatDatePl(latestEntry.date)} · ${polishCountLabel(filtered.length)}`
                : "Historia zmian w systemie"}
            </p>
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
                <h3 className={sectionTitleClass}>
                  {SECTION_LABELS.highlight}
                </h3>
                {highlights.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    tier="highlight"
                    role={role}
                    onClose={onClose}
                  />
                ))}
              </section>
            )}

            {normals.length > 0 && (
              <section className="space-y-2.5">
                {highlights.length > 0 && (
                  <div className="border-t border-slate-100" />
                )}
                <h3 className={sectionTitleClass}>
                  {SECTION_LABELS.normal}
                </h3>
                <div className="divide-y divide-slate-100">
                  {normals.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      tier="normal"
                      role={role}
                      onClose={onClose}
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
                <h3 className={sectionTitleClass}>
                  {SECTION_LABELS.minor}
                </h3>
                <div className="divide-y divide-slate-100">
                  {minors.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      tier="minor"
                      role={role}
                      onClose={onClose}
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

"use client";

import type { ReactNode } from "react";
import {
  groupTeethDetails,
  TEETH_KIND_LABELS,
  type TeethLineDetail,
  type TeethGroupedDetail,
} from "@/lib/teeth/teeth-catalog";
import { jawRequiredForKind } from "@/lib/teeth/teeth-mould-shape-groups";
import {
  teethProsbaChipClass,
  teethProsbaChipCountClass,
} from "@/lib/teeth/teeth-prosba-ui";
import {
  teethPanelChipClass,
  teethPanelChipCountClass,
} from "@/lib/teeth/teeth-panel-ui";
import { cn } from "@/lib/cn";

export function TeethGroupChips({
  details,
  groups,
  className,
  compact,
  variant = "prosba",
}: {
  details?: TeethLineDetail[] | undefined;
  groups?: TeethGroupedDetail[];
  className?: string;
  /** Mniejszy odstęp w zwiniętej pozycji. */
  compact?: boolean;
  /** prosba = formularz handlowca (fiolet); panel = /zeby (neutralny). */
  variant?: "prosba" | "panel";
}) {
  const items = groups ?? groupTeethDetails(details);
  if (items.length === 0) return null;

  const chipClass = variant === "panel" ? teethPanelChipClass : teethProsbaChipClass;
  const countClass = variant === "panel" ? teethPanelChipCountClass : teethProsbaChipCountClass;

  return (
    <div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-1.5", className)}>
      {items.map((g, i) => {
        const id = "id" in g && typeof g.id === "string" ? g.id : `chip-${i}`;
        const label = formatChipLabel(g, countClass);
        return (
          <span key={id} className={chipClass}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function formatChipLabel(
  g: TeethGroupedDetail,
  countClass: string,
): ReactNode {
  const jawLabel =
    g.kind && jawRequiredForKind(g.kind) && g.jaw === "upper"
      ? "góra"
      : g.kind && jawRequiredForKind(g.kind) && g.jaw === "lower"
        ? "dół"
        : null;
  const kindLabel = g.kind ? TEETH_KIND_LABELS[g.kind].toLowerCase() : null;
  const segments: string[] = [];
  if (g.color) segments.push(g.color);
  if (g.mould) segments.push(g.mould);
  if (jawLabel) segments.push(jawLabel);
  if (kindLabel) segments.push(kindLabel);
  const spec = segments.join(" · ") || "—";
  const count = Math.max(1, g.count);
  if (count <= 1) return spec;
  return (
    <>
      {spec}{" "}
      <span className={countClass}>× {count}</span>
    </>
  );
}

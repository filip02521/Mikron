"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ZdEstimateStatusBadgeTone =
  | "indigo"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "slate";

/**
 * Kompaktowy badge kolumny Status — jedna linia, stała wysokość.
 * Separator kind|meta przez CSS, gdy jest meta.
 */
export function ZdEstimateStatusBadge({
  kind,
  meta,
  tone,
  title,
  className,
}: {
  kind: string;
  meta?: ReactNode;
  tone: ZdEstimateStatusBadgeTone;
  title?: string;
  className?: string;
}) {
  const hasMeta = meta != null && meta !== "";
  return (
    <span
      className={cn(
        "zd-est-status-badge",
        hasMeta && "zd-est-status-badge--has-meta",
        `zd-est-status-badge--${tone}`,
        className
      )}
      title={title}
    >
      <span className="zd-est-status-badge__kind">{kind}</span>
      {hasMeta ? (
        <span className="zd-est-status-badge__meta">{meta}</span>
      ) : null}
    </span>
  );
}

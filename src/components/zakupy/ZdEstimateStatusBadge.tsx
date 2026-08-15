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
  return (
    <span
      className={cn(
        "zd-est-status-badge",
        `zd-est-status-badge--${tone}`,
        className
      )}
      title={title}
    >
      <span className="zd-est-status-badge__kind">{kind}</span>
      {meta != null && meta !== "" ? (
        <span className="zd-est-status-badge__meta">{meta}</span>
      ) : null}
    </span>
  );
}

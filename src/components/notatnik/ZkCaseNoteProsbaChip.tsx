"use client";

import { cn } from "@/lib/cn";
import type {
  ZkCaseNotePendingAttachKind,
  ZkCaseNoteProsbaStatus,
} from "@/lib/sales/zk-watch-case-note-prosba";
import { zkCaseNoteProsbaStatusCopy } from "@/lib/sales/zk-watch-case-note-prosba";
import { zkCaseNoteProsbaChipClassForTone } from "@/lib/ui/zk-case-note-prosba-styles";

export function ZkCaseNoteProsbaChip({
  status,
  pendingKind = "missing",
  variant = "row",
  className,
  title,
}: {
  status: ZkCaseNoteProsbaStatus;
  pendingKind?: ZkCaseNotePendingAttachKind;
  variant?: "row" | "modal";
  className?: string;
  /** Nadpisuje domyślny opis z copy. */
  title?: string;
}) {
  if (status === "none") return null;

  const copy = zkCaseNoteProsbaStatusCopy(status, pendingKind);
  const label = variant === "row" ? copy.shortLabel : copy.label;

  return (
    <span
      className={cn(zkCaseNoteProsbaChipClassForTone(copy.tone, variant), className)}
      title={title ?? copy.description}
    >
      {label}
    </span>
  );
}

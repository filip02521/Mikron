"use client";

import { formatPlDate } from "@/lib/display-labels";
import type { TeethSupplierDeliveryEta } from "@/lib/data/teeth-queue-shared";
import { teethPanelHeaderMetaClass } from "@/lib/teeth/teeth-panel-ui";

export function TeethPanelSupplierEta({
  eta,
}: {
  eta: TeethSupplierDeliveryEta | null | undefined;
}) {
  if (!eta) {
    return (
      <span
        className={teethPanelHeaderMetaClass}
        title="Ustaw stałe ETA w harmonogramie dostawcy (Karty dostawców → tor zębów)"
      >
        · brak ETA
      </span>
    );
  }

  const daysPart = `~${eta.avgBusinessDays} dni rob.`;
  const datePart = `dostawa ~${formatPlDate(eta.expectedDate)}`;
  const sampleHint =
    eta.source === "history" && eta.lowConfidence ? " (mała próbka)" : null;

  return (
    <span
      className={teethPanelHeaderMetaClass}
      title={
        eta.source === "fixed"
          ? "Stałe ETA dostawcy"
          : "ETA z historii dostaw zębów"
      }
    >
      · {daysPart} · {datePart}
      {sampleHint}
    </span>
  );
}

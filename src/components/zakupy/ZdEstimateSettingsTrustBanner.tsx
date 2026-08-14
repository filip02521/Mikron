"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";

export type ZdEstimateSettingsPartKey =
  | "exclusions"
  | "onRequest"
  | "packaging"
  | "pairs"
  | "boms"
  | "teeth";

const PART_LABEL: Record<ZdEstimateSettingsPartKey, string> = {
  exclusions: "Wykluczenia",
  onRequest: "Tylko na prośbę",
  packaging: "Opakowania",
  pairs: "Pary",
  boms: ZD_BOM_UI.panelTitle,
  teeth: "Zęby",
};

/**
 * Jeden baner zamiast 5 osobnych alertów — „Wczytaj wszystko” + per-część retry.
 */
export function ZdEstimateSettingsTrustBanner({
  parts,
  mutating,
  onRetryAll,
  onRetryPart,
}: {
  parts: Partial<Record<ZdEstimateSettingsPartKey, string | null | undefined>>;
  mutating?: boolean;
  onRetryAll: () => void;
  onRetryPart: (key: ZdEstimateSettingsPartKey) => void;
}) {
  const failed = (
    Object.entries(parts) as [ZdEstimateSettingsPartKey, string | null | undefined][]
  ).filter(([, msg]) => Boolean(msg?.trim()));

  if (failed.length === 0) return null;

  return (
    <Alert tone="error" title="Ustawienia działu niedostępne">
      <p className="text-sm leading-snug">
        Bez pełnych ustawień nie pokażemy bezpiecznej listy „Do ZD” ani nie
        pozwolimy utworzyć ZD / skopiować TSV. Wczytaj brakujące części:
      </p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {failed.map(([key, msg]) => (
          <li key={key} className="flex flex-wrap items-start gap-2">
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-slate-900">
                {PART_LABEL[key]}:
              </span>{" "}
              <span className="text-slate-700">{msg}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={mutating}
              onClick={() => onRetryPart(key)}
            >
              Wczytaj
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="primary"
        className="mt-3"
        disabled={mutating}
        onClick={onRetryAll}
      >
        {mutating ? "Wczytuję…" : "Wczytaj wszystko"}
      </Button>
    </Alert>
  );
}

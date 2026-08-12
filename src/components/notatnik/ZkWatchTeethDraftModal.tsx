"use client";

import { useMemo, useState } from "react";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { actionSaveZkWatchTeethDrafts } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import {
  TeethOrderBuilderModal,
  type TeethOrderBuilderSaveResult,
} from "@/components/teeth/TeethOrderBuilderModal";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { TeethGroupChips } from "@/components/teeth/TeethGroupChips";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import {
  buildZkTeethDraftFromInput,
  collectZkTeethLineCandidates,
  isZkTeethDraftComplete,
  parseZkTeethDrafts,
  type ZkTeethLineCandidate,
  type ZkTeethLineDraft,
} from "@/lib/sales/zk-watch-teeth-draft";
import { manufacturerForProductLine } from "@/lib/teeth/teeth-catalog";
import { TEETH_KIND_LABELS, type TeethKind, type TeethLineDetail } from "@/lib/teeth/teeth-catalog";
import { resolveTeethCatalogProduct } from "@/lib/teeth/teeth-dual-kind";
import type { SalesZkWatch } from "@/types/database";
import { IconAlertCircle } from "@/components/icons/StrokeIcons";

function registryFromProductInfo(
  info: ReturnType<typeof useTeethProductInfo>
) {
  return {
    twIds: info.twIds,
    manufacturerByTwId: info.manufacturerByTwId,
    productLineByTwId: info.productLineByTwId,
    kindByTwId: info.kindByTwId,
    catalogAvailable: info.catalogAvailable,
  };
}

export function ZkWatchTeethDraftModal({
  open,
  watch,
  onClose,
  onSaved,
  onSkipLater,
}: {
  open: boolean;
  watch: SalesZkWatch;
  onClose: () => void;
  onSaved: (watch: SalesZkWatch) => void;
  onSkipLater: () => void;
}) {
  const teethInfo = useTeethProductInfo();
  const registry = useMemo(() => registryFromProductInfo(teethInfo), [teethInfo]);

  const candidates = useMemo(
    () => (open ? collectZkTeethLineCandidates(watch, registry) : []),
    [open, watch, registry]
  );

  const existingDrafts = useMemo(
    () => parseZkTeethDrafts(watch.teeth_drafts),
    [watch.teeth_drafts]
  );

  const [localDrafts, setLocalDrafts] = useState<Record<string, ZkTeethLineDraft>>(
    {}
  );
  const [activeLineKey, setActiveLineKey] = useState<string | null>(null);
  const [kindOverrides, setKindOverrides] = useState<Record<string, TeethKind>>(
    {}
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftsByKey = useMemo(() => {
    return { ...existingDrafts, ...localDrafts };
  }, [existingDrafts, localDrafts]);

  const incomplete = useMemo(() => {
    return candidates.filter((c) => {
      const draft = draftsByKey[c.lineKey];
      return !draft || !isZkTeethDraftComplete(draft, c.view.quantity);
    });
  }, [candidates, draftsByKey]);

  const allReady =
    candidates.length > 0 &&
    candidates.every((c) => {
      const draft = draftsByKey[c.lineKey];
      return draft && isZkTeethDraftComplete(draft, c.view.quantity);
    });
  const catalogUnavailable = teethInfo.catalogAvailable === false;

  const activeCandidate = candidates.find((c) => c.lineKey === activeLineKey) ?? null;
  const activeKind =
    (activeCandidate &&
      (kindOverrides[activeCandidate.lineKey] ?? activeCandidate.teethKind)) ||
    null;
  const activeProductLine = activeCandidate?.teethProductLine ?? null;
  const activeManufacturer =
    activeCandidate?.teethManufacturer ??
    (activeProductLine ? manufacturerForProductLine(activeProductLine) : null);

  function openBuilder(candidate: ZkTeethLineCandidate) {
    setError(null);
    if (!candidate.teethProductLine) {
      setError("Brak linii produktowej w katalogu zębów — uzupełnij w adminie.");
      return;
    }
    if (!candidate.teethKind && !kindOverrides[candidate.lineKey]) {
      setError("Wybierz typ zębów (przednie / boczne) dla tej pozycji.");
      return;
    }
    setActiveLineKey(candidate.lineKey);
  }

  function handleBuilderSave(result: TeethOrderBuilderSaveResult) {
    if (!activeCandidate || result.mode !== "single") return;
    const kind =
      kindOverrides[activeCandidate.lineKey] ??
      activeCandidate.teethKind ??
      null;
    const productLine = activeCandidate.teethProductLine;
    if (!kind || !productLine) return;

    const expectedQuantity =
      activeCandidate.view.quantity != null && activeCandidate.view.quantity > 0
        ? activeCandidate.view.quantity
        : result.totalQuantity;

    const details: TeethLineDetail[] = result.details.map((d, i) => ({
      ...d,
      position: i + 1,
      kind,
    }));

    if (details.length !== expectedQuantity) {
      setError(
        `Lista musi mieć dokładnie ${expectedQuantity} szt. (ilość z ZK).`
      );
      return;
    }

    const resolvedProduct = resolveTeethCatalogProduct(
      teethInfo.registryIndex,
      productLine,
      kind
    );
    const kindChangedFromCandidate =
      activeCandidate.teethKind != null && activeCandidate.teethKind !== kind;
    if (!resolvedProduct && (kindChangedFromCandidate || !activeCandidate.teethKind)) {
      setError(
        `Brak towaru w katalogu zębów dla „${TEETH_KIND_LABELS[kind]}” tej linii — uzupełnij wpis w adminie.`
      );
      return;
    }
    const draft = buildZkTeethDraftFromInput({
      lineKey: activeCandidate.lineKey,
      subiektTwId: resolvedProduct?.twId ?? activeCandidate.subiektTwId,
      teethManufacturer:
        resolvedProduct?.manufacturer ??
        activeCandidate.teethManufacturer ??
        manufacturerForProductLine(productLine),
      teethProductLine: resolvedProduct?.productLine ?? productLine,
      teethKind: kind,
      expectedQuantity,
      teethDetails: details,
    });
    setLocalDrafts((prev) => ({ ...prev, [draft.lineKey]: draft }));
    setActiveLineKey(null);
    setError(null);
  }

  async function persistCompleteDrafts(): Promise<SalesZkWatch | null> {
    const payload = candidates
      .map((c) => {
        const draft = draftsByKey[c.lineKey];
        if (!draft || !isZkTeethDraftComplete(draft, c.view.quantity)) return null;
        return {
          lineKey: draft.lineKey,
          subiektTwId: draft.subiektTwId,
          teethManufacturer: draft.teethManufacturer,
          teethProductLine: draft.teethProductLine,
          teethKind: draft.teethKind,
          expectedQuantity: draft.expectedQuantity,
          teethDetails: draft.teethDetails,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const hasUnsavedLocal = candidates.some((c) => {
      const local = localDrafts[c.lineKey];
      return local != null && isZkTeethDraftComplete(local, c.view.quantity);
    });
    if (!hasUnsavedLocal || payload.length === 0) return null;

    const { watch: updated } = await actionSaveZkWatchTeethDrafts(watch.id, payload);
    return updated;
  }

  async function handleSaveAll() {
    if (!allReady) {
      setError("Uzupełnij listy zębów dla wszystkich pozycji.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = candidates.map((c) => {
        const draft = draftsByKey[c.lineKey]!;
        return {
          lineKey: draft.lineKey,
          subiektTwId: draft.subiektTwId,
          teethManufacturer: draft.teethManufacturer,
          teethProductLine: draft.teethProductLine,
          teethKind: draft.teethKind,
          expectedQuantity: draft.expectedQuantity,
          teethDetails: draft.teethDetails,
        };
      });
      const { watch: updated } = await actionSaveZkWatchTeethDrafts(
        watch.id,
        payload
      );
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(userFacingErrorText(e, "Nie udało się zapisać list zębów."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSkipLater() {
    setSaving(true);
    setError(null);
    try {
      const updated = await persistCompleteDrafts();
      if (updated) onSaved(updated);
      onSkipLater();
      onClose();
    } catch (e) {
      setError(userFacingErrorText(e, "Nie udało się zapisać uzupełnionych list zębów."));
    } finally {
      setSaving(false);
    }
  }

  const displayNumber = formatZkWatchDisplayNumber(watch.zk_number);

  return (
    <>
      <ModalShell
        open={open && !activeLineKey}
        onClose={onClose}
        size="lg"
        title={`${displayNumber} — listy zębów`}
        description={watch.client_label}
        bodyClassName="space-y-3 px-5 py-4 sm:px-6"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => void handleSkipLater()}
            >
              Uzupełnij później
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || !allReady || catalogUnavailable}
              onClick={() => void handleSaveAll()}
            >
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner size="sm" />
                  Zapisuję…
                </span>
              ) : (
                "Zapisz listy"
              )}
            </Button>
          </div>
        }
      >
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 px-4 py-3 text-sm text-amber-950">
          <p className={cn(salesTypography.rowTitle, "font-semibold")}>
            Uzupełnij listy zębów przed prośbą
          </p>
          <p className={cn("mt-1", salesTypography.rowBody, "text-amber-900/80")}>
            Dla pozycji zębowych z ZK podaj kolor, wzór i typ (przednie / boczne).
            Możesz uzupełnić później — wtedy przycisk prośby pozostanie zablokowany.
          </p>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-800">
            <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {catalogUnavailable ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-800">
            <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>
              Katalog zębów jest chwilowo niedostępny — odśwież stronę i spróbuj ponownie.
            </p>
          </div>
        ) : null}

        {!catalogUnavailable && candidates.length === 0 ? (
          <p className="text-sm text-slate-600">Brak pozycji zębowych w zakresie prośby.</p>
        ) : !catalogUnavailable ? (
          <ul className="space-y-2">
            {candidates.map((c) => {
              const draft = draftsByKey[c.lineKey];
              const ready = draft
                ? isZkTeethDraftComplete(draft, c.view.quantity)
                : false;
              const kind =
                kindOverrides[c.lineKey] ?? c.teethKind ?? draft?.teethKind ?? null;
              return (
                <li
                  key={c.lineKey}
                  className={cn(
                    "rounded-lg border px-3 py-2.5",
                    ready
                      ? "border-emerald-200/80 bg-emerald-50/40"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={cn(salesTypography.rowTitle, "text-slate-900")}>
                        {c.view.product}
                      </p>
                      <p className={cn(salesTypography.rowMeta, "mt-0.5 text-slate-600")}>
                        {c.view.quantity != null ? `${c.view.quantity} szt.` : "—"}
                        {kind ? ` · ${TEETH_KIND_LABELS[kind]}` : " · brak typu"}
                        {ready ? " · lista gotowa" : " · szkic niepełny"}
                      </p>
                      {draft?.teethDetails?.length ? (
                        <TeethGroupChips
                          details={draft.teethDetails}
                          compact
                          className="mt-1.5"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {c.needsKindChoice || !c.teethKind ? (
                        <div className="flex gap-1">
                          {(["anterior", "posterior"] as const).map((k) => (
                            <Button
                              key={k}
                              type="button"
                              size="sm"
                              variant={kind === k ? "primary" : "secondary"}
                              className="h-7 px-2 text-[0.65rem]"
                              onClick={() =>
                                setKindOverrides((prev) => ({
                                  ...prev,
                                  [c.lineKey]: k,
                                }))
                              }
                            >
                              {TEETH_KIND_LABELS[k]}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8"
                        onClick={() => openBuilder(c)}
                      >
                        {ready ? "Edytuj listę" : "Uzupełnij listę"}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {!catalogUnavailable && incomplete.length > 0 ? (
          <p className="text-xs text-slate-500">
            Pozostało do uzupełnienia: {incomplete.length}
          </p>
        ) : null}
      </ModalShell>

      {activeCandidate && activeProductLine && activeManufacturer && activeKind ? (
        <TeethOrderBuilderModal
          open={Boolean(activeLineKey)}
          onClose={() => setActiveLineKey(null)}
          productLine={activeProductLine}
          manufacturer={activeManufacturer}
          defaultKind={activeKind}
          productLabel={activeCandidate.view.product}
          initialDetails={draftsByKey[activeCandidate.lineKey]?.teethDetails}
          dualKindMode={false}
          onSave={handleBuilderSave}
          tier="stack"
        />
      ) : null}
    </>
  );
}

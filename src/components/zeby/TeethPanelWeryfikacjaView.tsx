"use client";

import { useMemo, useState } from "react";
import { plProsba } from "@/lib/ui/polish-plurals";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ModalShell } from "@/components/ui/ModalShell";
import { TeethPanelEmpty } from "@/components/zeby/TeethPanelSection";
import { TeethVerificationInlineList } from "@/components/zeby/TeethVerificationInlineList";
import { TeethOcrImage } from "@/components/zeby/TeethOcrImage";
import { IconScanLine, IconCircleCheck, IconAlertCircle } from "@/components/icons/StrokeIcons";
import Link from "next/link";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { teethPanelReadinessContextFromMaps } from "@/lib/teeth/teeth-panel-order-readiness";
import { groupTeethQueueByProductLine } from "@/lib/teeth/teeth-queue-view-model";
import {
  TeethProductLineChips,
  TeethProductLineSectionHeader,
  teethLineSectionDomId,
} from "@/components/zeby/TeethProductLineSectionHeader";
import {
  isScheduledItem,
  type TeethQueueGroup,
  type TeethQueueItem,
} from "@/lib/data/teeth-queue-shared";
import { actionApproveTeethOcr } from "@/app/actions/teeth-orders";

export function TeethPanelWeryfikacjaView({
  groups,
  pending,
  onApproveDone,
  onEditSaved,
}: {
  groups: TeethQueueGroup[];
  pending: boolean;
  onApproveDone: (message: string, tone: "success" | "error") => void;
  onEditSaved?: (message?: string) => void;
}) {
  const [localPending, setLocalPending] = useState(false);
  const [imageCollapsed, setImageCollapsed] = useState(false);
  const [approveTarget, setApproveTarget] = useState<{ orderIds: string[]; label: string } | null>(null);
  const teethProductInfo = useTeethProductInfo();
  const readinessCtx = useMemo(
    () => teethPanelReadinessContextFromMaps(teethProductInfo),
    [teethProductInfo],
  );

  const handleApprove = async (orderIds: string[]) => {
    if (orderIds.length === 0) return;
    setLocalPending(true);
    try {
      const result = await actionApproveTeethOcr(orderIds);
      onApproveDone(
        `Zatwierdzono ${result.updated} ${plProsba(result.updated)} — są teraz w „Do zamówienia”.`,
        "success",
      );
    } catch (e) {
      console.error("[TeethPanelWeryfikacjaView] approveTeethOcr failed:", e);
      onApproveDone(
        userFacingErrorText(e, "Nie udało się zatwierdzić. Spróbuj ponownie."),
        "error",
      );
    } finally {
      setLocalPending(false);
    }
  };

  const requestApprove = (orderIds: string[], label: string) => {
    if (orderIds.length === 0) return;
    if (orderIds.length === 1) {
      void handleApprove(orderIds);
    } else {
      setApproveTarget({ orderIds, label });
    }
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;
    const target = approveTarget;
    setApproveTarget(null);
    await handleApprove(target.orderIds);
  };

  const allOrderIds = groups.flatMap((g) =>
    g.items.filter((item): item is TeethQueueItem => !isScheduledItem(item)).map((item) => item.id),
  );

  const missingDataCount = groups.flatMap((g) =>
    g.items
      .filter((item): item is TeethQueueItem => !isScheduledItem(item))
      .filter((item) => {
        const details = item.teeth_details ?? [];
        if (details.length === 0) return true;
        return details.some((d) => !d.color || !d.kind);
      }),
  ).length;

  if (groups.length === 0) {
    return (
      <TeethPanelEmpty
        title="Brak pozycji do weryfikacji"
        description="Prośby z listą zębów wczytaną ze zdjęcia pojawią się tutaj do weryfikacji przed zamówieniem."
        icon={<IconScanLine size={24} strokeWidth={1.75} />}
        action={
          <Link
            href="/zeby/kolejka"
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            Przejdź do kolejki
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {allOrderIds.length} {plProsba(allOrderIds.length)} czeka na sprawdzenie
          </p>
          <p className="text-xs text-slate-500">
            Porównaj listę ze zdjęciem, popraw pomyłki odczytu i zatwierdź — prośba trafi do
            zamówienia.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          className="min-h-10 shrink-0"
          disabled={pending || localPending}
          aria-busy={localPending}
          onClick={() => requestApprove(allOrderIds, "wszystkie prośby")}
        >
          {localPending ? <Spinner size="sm" /> : <IconCircleCheck size={16} />}
          Zatwierdź wszystkie
        </Button>
      </div>
      {missingDataCount > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          <IconAlertCircle size={18} className="shrink-0 text-amber-600" />
          <span>
            <strong>{missingDataCount}</strong> {plProsba(missingDataCount)} bez koloru lub typu przy
            którymś zębie — uzupełnij przed zatwierdzeniem.
          </span>
        </div>
      ) : null}

      {groups.map((group) => {
        const realItems = group.items.filter(
          (item): item is TeethQueueItem => !isScheduledItem(item),
        );
        const orderIds = realItems.map((item) => item.id);
        const ocrImagePaths = Array.from(
          new Set(
            realItems
              .map((item) => item.teeth_ocr_image_path)
              .filter((p): p is string => Boolean(p)),
          ),
        );
        const sections = groupTeethQueueByProductLine(realItems, readinessCtx);
        const sectionDomId = (key: string) =>
          teethLineSectionDomId("weryfikacja", group.supplierId, key);

        return (
          <section
            key={group.supplierId ?? "__no_supplier"}
            aria-label={`Dostawca ${group.supplierName}`}
            className="rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">{group.supplierName}</h2>
                <p className="text-xs text-slate-500">
                  {orderIds.length} {plProsba(orderIds.length)}
                </p>
                <TeethProductLineChips
                  sections={sections.map((sec) => ({ ...sec, count: sec.items.length }))}
                  sectionDomId={sectionDomId}
                />
              </div>
              {orderIds.length > 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-9"
                  disabled={pending || localPending}
                  onClick={() => requestApprove(orderIds, group.supplierName ?? "tej grupy")}
                >
                  <IconCircleCheck size={16} />
                  Zatwierdź u tego dostawcy ({orderIds.length})
                </Button>
              ) : null}
            </header>
            <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row">
              <div className="min-w-0 flex-1 space-y-3">
                {sections.map((section) => (
                  <div
                    key={section.key}
                    id={sectionDomId(section.key)}
                    className="scroll-mt-24 overflow-hidden rounded-lg border border-slate-200"
                  >
                    <TeethProductLineSectionHeader
                      productLine={section.productLine}
                      label={section.label}
                      meta={`${section.items.length} ${plProsba(section.items.length)}`}
                    />
                    <div className="p-2 sm:p-3">
                      <TeethVerificationInlineList
                        items={section.items}
                        onSaved={() => onEditSaved?.()}
                        onApproveOrder={(orderId) => void handleApprove([orderId])}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {ocrImagePaths.length > 0 ? (
                <div className="shrink-0 lg:w-[400px] xl:w-[460px]">
                  <div className="lg:sticky lg:top-2">
                    {imageCollapsed ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setImageCollapsed(false)}
                        className="lg:hidden"
                      >
                        <IconScanLine size={14} />
                        Pokaż zdjęcie
                      </Button>
                    ) : (
                      <div className="relative">
                        {ocrImagePaths.map((path) => (
                          <TeethOcrImage
                            key={path}
                            imagePath={path}
                            className="h-[240px] w-full lg:h-[calc(100vh-2rem)] lg:max-h-[750px]"
                          />
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setImageCollapsed(true)}
                          className="absolute right-1 top-1 lg:hidden"
                        >
                          Ukryj
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        );
      })}

      <ModalShell
        open={approveTarget != null}
        onClose={() => setApproveTarget(null)}
        title="Potwierdź zatwierdzenie"
        role="alertdialog"
        size="sm"
        tier="raised"
        disableBackdropClose={localPending}
        loadingMessage={localPending ? "Zatwierdzanie…" : null}
        bodyClassName="px-5 py-4 sm:px-6"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => setApproveTarget(null)}
              disabled={localPending}
            >
              Anuluj
            </Button>
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={() => void confirmApprove()}
              disabled={localPending}
            >
              <IconCircleCheck size={18} />
              Zatwierdź {approveTarget?.orderIds.length ?? 0} {plProsba(approveTarget?.orderIds.length ?? 0)}
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <IconAlertCircle size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">
              Zatwierdzić {approveTarget?.orderIds.length ?? 0} {plProsba(approveTarget?.orderIds.length ?? 0)} — {approveTarget?.label}?
            </p>
            <p className="text-xs text-slate-500">
              Prośby przejdą do „Do zamówienia”. Późniejsze poprawki zrobisz tam przyciskiem „Edytuj”.
            </p>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

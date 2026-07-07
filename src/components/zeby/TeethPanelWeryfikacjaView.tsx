"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { panelSubsectionInsetClass, panelTypography } from "@/lib/ui/ontime-theme";
import { teethPanelSupplierCardClass } from "@/lib/teeth/teeth-panel-ui";
import { plPozycja } from "@/lib/ui/polish-plurals";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { TeethPanelEmpty } from "@/components/zeby/TeethPanelSection";
import { TeethVerificationInlineList } from "@/components/zeby/TeethVerificationInlineList";
import { TeethPanelSupplierGroupHeader } from "@/components/zeby/TeethPanelSupplierGroupHeader";
import { TeethOcrImage } from "@/components/zeby/TeethOcrImage";
import { IconScanLine, IconCircleCheck, IconAlertCircle } from "@/components/icons/StrokeIcons";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import {
  teethPanelReadinessContextFromMaps,
  distinctTeethProductLineLabelsForOrders,
} from "@/lib/teeth/teeth-panel-order-readiness";
import {
  isScheduledItem,
  type TeethQueueGroup,
  type TeethQueueItem,
} from "@/lib/data/teeth-queue";
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
        `Zatwierdzono ${result.updated} ${plPozycja(result.updated)} — trafią do kolejki.`,
        "success",
      );
    } catch {
      onApproveDone("Nie udało się zatwierdzić pozycji. Spróbuj ponownie.", "error");
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

  if (groups.length === 0) {
    return (
      <TeethPanelEmpty
        title="Brak pozycji do weryfikacji"
        description="Prośby z listą zębów wczytaną ze zdjęcia pojawią się tutaj do weryfikacji przed zamówieniem."
        icon={<IconScanLine size={24} strokeWidth={1.75} />}
        tone="amber"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className={panelTypography.chrome}>
          {allOrderIds.length} {plPozycja(allOrderIds.length)} oczekuje na weryfikację
        </p>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending || localPending}
          onClick={() => requestApprove(allOrderIds, "wszystkie pozycje")}
        >
          <IconCircleCheck size={16} />
          Zatwierdź wszystkie
        </Button>
      </div>

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
        const productLineLabels = distinctTeethProductLineLabelsForOrders(realItems, readinessCtx);

        return (
          <div
            key={group.supplierId ?? "__no_supplier"}
            className={cn(teethPanelSupplierCardClass, panelSubsectionInsetClass, "overflow-visible")}
          >
            <TeethPanelSupplierGroupHeader
              group={group}
              orderCount={orderIds.length}
              productLineLabels={productLineLabels}
              actions={
                orderIds.length > 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending || localPending}
                    onClick={() => requestApprove(orderIds, group.supplierName ?? "tej grupy")}
                  >
                    <IconCircleCheck size={16} />
                    Zatwierdź ({orderIds.length})
                  </Button>
                ) : null
              }
            />
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="min-w-0 flex-1">
                <TeethVerificationInlineList
                  items={realItems}
                  onSaved={() => onEditSaved?.()}
                  onApproveOrder={(orderId) => void handleApprove([orderId])}
                />
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
          </div>
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
              Zatwierdź {approveTarget?.orderIds.length ?? 0} {plPozycja(approveTarget?.orderIds.length ?? 0)}
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
              Zatwierdzić {approveTarget?.orderIds.length ?? 0} {plPozycja(approveTarget?.orderIds.length ?? 0)} — {approveTarget?.label}?
            </p>
            <p className="text-xs text-slate-500">
              Pozycje trafią do kolejki zamówień i nie będzie można ich już edytować w weryfikacji.
            </p>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

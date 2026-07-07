"use client";

import { useCallback, useMemo, useState } from "react";
import type { IndividualOrder } from "@/types/database";
import { Toast } from "@/components/ui/Toast";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { Alert } from "@/components/ui/Alert";
import { IconTooth } from "@/components/icons/StrokeIcons";
import { TeethReceiveLinesPanel } from "@/components/zeby/TeethReceiveLinesPanel";
import { TeethPanelTabPanel } from "@/components/zeby/TeethPanelSection";
import { TeethPanelWorkspaceCard } from "@/components/zeby/TeethPanelWorkspaceCard";
import { TeethReceiveSummaryBand } from "@/components/zeby/TeethReceiveSummaryBand";
import {
  TEETH_PRZYJECIE_PAGE_HINT,
  TEETH_PRZYJECIE_PAGE_TITLE,
} from "@/components/zeby/teeth-panel-copy";
import {
  buildTeethReceiveQueue,
  summarizeTeethReceiveInbox,
} from "@/lib/orders/receive-queue-teeth";
import { TEETH_PRZYJECIE_ICON_TILE } from "@/lib/teeth/teeth-panel-shell";

export function TeethReceiveClient({
  orders,
  loadError = null,
}: {
  orders: IndividualOrder[];
  loadError?: string | null;
}) {
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" | "warning"; durationMs?: number } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const teethReceiveQueue = useMemo(() => buildTeethReceiveQueue(orders), [orders]);
  const inboxSummary = useMemo(() => summarizeTeethReceiveInbox(teethReceiveQueue), [teethReceiveQueue]);

  const overlays = (
    <>
      {loadError ? (
        <Alert tone="error" className="mb-4">
          {loadError}
        </Alert>
      ) : null}
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {toast ? (
        <Toast
          message={toast.text}
          tone={toast.tone}
          durationMs={toast.durationMs}
          onDismiss={dismissToast}
        />
      ) : null}
    </>
  );

  return (
    <TeethPanelWorkspaceCard
      title={TEETH_PRZYJECIE_PAGE_TITLE}
      hint={TEETH_PRZYJECIE_PAGE_HINT}
      icon={<IconTooth size={20} />}
      iconTileClassName={TEETH_PRZYJECIE_ICON_TILE}
      beforeCard={overlays}
    >
      <TeethPanelTabPanel id="teeth-panel-view-przyjecie" labelledBy="teeth-nav-przyjecie">
        <TeethReceiveSummaryBand summary={inboxSummary} queueCount={teethReceiveQueue.length} />
        <section id="zeby-przyjecie" className="scroll-mt-20">
          <TeethReceiveLinesPanel
            deliveryOrders={orders}
            onToast={setToast}
            onPendingChange={setPendingMessage}
          />
        </section>
      </TeethPanelTabPanel>
    </TeethPanelWorkspaceCard>
  );
}

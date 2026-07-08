"use client";

import { useState, useCallback } from "react";
import { SyncButton } from "@/components/admin/SyncButton";
import { AdminActionButton } from "@/components/admin/AdminActionButton";
import { NoticeToast } from "@/components/ui/NoticeToast";
import type { ToastNotice } from "@/lib/ui/notice-copy";
import { adminPanelNotice } from "@/lib/ui/notice-copy";
import { Card, CardHeader } from "@/components/ui/Card";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import {
  actionSyncData,
  actionRecalculateStats,
  actionProcessDeliveries,
} from "@/app/actions/admin";

export function AdminToolsPanel() {
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismiss = useCallback(() => setToast(null), []);

  const notify = (text: string, tone: "success" | "error" = "success") =>
    setToast(adminPanelNotice(text, tone, "Narzędzia serwisowe"));

  return (
    <>
      {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Narzędzia serwisowe"
          description="Ręczne operacje na żądanie — większość procesów działa automatycznie w tle."
          action={
            <HelpPopover
              label="Pomoc — narzędzia serwisowe"
              title="Kiedy używać narzędzi"
              shortLabel="Pomoc"
            >
              <HelpBlock title="Harmonogramy">
                <p>
                  Po urlopie system przelicza terminy sam. Przycisk „Przelicz wszystkie terminy”
                  przydaje się po imporcie lub gdy panel dzienny pokazuje złe daty.
                </p>
              </HelpBlock>
              <HelpBlock title="Realizacja i ETA">
                <p>
                  Kolejka dostaw domyka się przy zapisie realizacji i w cronie. Ręczne
                  przetwarzanie — gdy coś „wisi”. Pełne przeliczenie ETA tylko po korekcie
                  historii zamówień.
                </p>
              </HelpBlock>
              <HelpBlock title="Zadania w tle">
                <p className="text-xs text-slate-500">
                  Status automatycznych jobów — w sekcji „Zadania cron” powyżej.
                </p>
              </HelpBlock>
            </HelpPopover>
          }
        />

        <div className="grid gap-4 px-3 pb-4 sm:px-4 lg:grid-cols-2 lg:px-5">
          <div className="space-y-3 rounded-md border border-slate-200/90 bg-slate-50/30 p-3 sm:p-4">
            <div>
              <p className={panelTypography.sectionLabel}>Harmonogramy</p>
              <p className={cn(panelTypography.sectionDesc, "mt-1")}>
                Po urlopach, imporcie lub gdy panel dzienny pokazuje złe daty.
              </p>
            </div>
            <SyncButton
              action={actionSyncData}
              label="Przelicz wszystkie terminy"
              onMessage={notify}
              loadingMessage="Przeliczanie terminów wszystkich dostawców…"
              loadingHint="Urlopy i interwały — panel dzienny i terminy"
            />
            <p className={cn(panelTypography.caption, "text-slate-500")}>
              Po zapisie urlopu przeliczenie uruchamia się samo.
            </p>
          </div>

          <div className="space-y-3 rounded-md border border-slate-200/90 bg-slate-50/30 p-3 sm:p-4">
            <div>
              <p className={panelTypography.sectionLabel}>Realizacja i statystyki</p>
              <p className={cn(panelTypography.sectionDesc, "mt-1")}>
                Gdy kolejka „wisi” lub ETA wymaga pełnego przebiegu historii.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <AdminActionButton
                action={actionProcessDeliveries}
                label="Przetwórz kolejkę dostaw"
                onMessage={notify}
                loadingMessage="Przetwarzanie kolejki realizacji…"
                loadingHint="Domknięcie pozycji i e-maile"
              />
              <AdminActionButton
                action={actionRecalculateStats}
                label="Przelicz statystyki ETA"
                onMessage={notify}
                loadingMessage="Przeliczanie statystyk dostaw…"
                loadingHint="Pełny przebieg historii"
              />
            </div>
            <p className={cn(panelTypography.caption, "text-slate-500")}>
              ETA aktualizuje się przy zapisie realizacji — pełne przeliczenie tylko po korekcie
              historii.
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}

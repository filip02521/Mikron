"use client";

import { useState, useCallback } from "react";
import { SyncButton } from "@/components/admin/SyncButton";
import { AdminActionButton } from "@/components/admin/AdminActionButton";
import { Toast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  actionSyncData,
  actionRecalculateStats,
  actionProcessDeliveries,
  actionSendWeeklyEmail,
  actionSendDailySalesEmail,
} from "@/app/actions/admin";

export function AdminToolsPanel() {
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismiss = useCallback(() => setToast(null), []);

  const notify = (text: string, tone: "success" | "error" = "success") =>
    setToast({ text, tone });

  return (
    <>
      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={dismiss} /> : null}

      <details className="group mb-6 rounded-xl border border-slate-200/90 bg-white shadow-sm open:shadow-md">
        <summary className="cursor-pointer list-none px-6 py-4 text-sm font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Automatyka (Vercel Cron)
            <span className="text-slate-400 transition group-open:rotate-180">▾</span>
          </span>
        </summary>
        <div className="border-t border-slate-100 px-6 py-4 text-sm leading-relaxed text-slate-600">
          <ul className="list-inside list-disc space-y-2">
            <li>
              <strong className="text-slate-800">6:00 (Europe/Warsaw)</strong> w dni robocze —{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">/api/cron/morning</code>:
              przelicza terminy, domyka kolejkę realizacji, wysyła status do handlowców.
            </li>
            <li>
              <strong className="text-slate-800">Co godzinę 8:00–18:59</strong> —{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">
                /api/cron/process-deliveries
              </code>
              : zapasowe domknięcie dostaw z kolejki.
            </li>
            <li>
              <strong className="text-slate-800">„Towar dotarł”</strong> — wysyłany od razu po
              zapisie w realizacji, nie czeka na cron.
            </li>
          </ul>
        </div>
      </details>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Harmonogramy"
            description="Po urlopach, imporcie lub gdy panel dzienny pokazuje złe daty."
          />
          <div className="space-y-3">
            <SyncButton
              action={actionSyncData}
              label="Przelicz wszystkie terminy"
              onMessage={notify}
              loadingMessage="Przeliczanie terminów wszystkich dostawców…"
              loadingHint="Urlopy i interwały — panel dzienny i terminy"
            />
            <p className="text-xs leading-relaxed text-slate-500">
              Po zapisie urlopu przeliczenie uruchamia się samo. Ten przycisk tylko na żądanie.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Realizacja i statystyki"
            description="Gdy kolejka „wisi” lub ETA wymaga pełnego przebiegu historii."
          />
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
            <p className="text-xs leading-relaxed text-slate-500">
              ETA na co dzień aktualizuje się przy zapisie realizacji — pełne przeliczenie tylko
              po korekcie historii.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Komunikacja"
            description="Ręczne wysłanie — np. gdy cron nie zadziałał."
          />
          <div className="flex flex-col gap-2">
            <AdminActionButton
              action={actionSendDailySalesEmail}
              label="Status do handlowców (dziś)"
              onMessage={notify}
            />
            <AdminActionButton
              action={actionSendWeeklyEmail}
              label="Raport tygodniowy (zakupy)"
              onMessage={notify}
            />
            <p className="text-xs leading-relaxed text-slate-500">
              Raport tygodniowy: lista z{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">
                app_settings.email_recipients
              </code>
              .
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

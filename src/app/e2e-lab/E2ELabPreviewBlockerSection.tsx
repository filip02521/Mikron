"use client";

import { useState } from "react";
import { AdminPanelPreviewProvider } from "@/components/layout/AdminPanelPreviewContext";
import { usePreviewMutationBlocker } from "@/components/layout/usePreviewMutationBlocker";
import type { AdminPanelContext } from "@/lib/auth/admin-panel-context";
import { isAdminOperationsPreviewReadOnly } from "@/lib/auth/admin-panel-context";
import { Button } from "@/components/ui/Button";

function PreviewBlockerDemo({
  testIdPrefix,
}: {
  testIdPrefix: string;
}) {
  const { readOnly, blockIfReadOnly } = usePreviewMutationBlocker();
  const [result, setResult] = useState<"idle" | "blocked" | "allowed">("idle");

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3">
      <p data-testid={`${testIdPrefix}-read-only`} className="text-sm text-slate-600">
        readOnly: {readOnly ? "yes" : "no"}
      </p>
      <Button
        type="button"
        data-testid={`${testIdPrefix}-mutate`}
        onClick={() => {
          if (blockIfReadOnly()) {
            setResult("blocked");
            return;
          }
          setResult("allowed");
        }}
      >
        Wykonaj mutację
      </Button>
      <p data-testid={`${testIdPrefix}-result`} className="text-sm text-slate-800">
        {result}
      </p>
    </div>
  );
}

function PreviewBlockerCase({
  panelContext,
  testIdPrefix,
  title,
}: {
  panelContext: AdminPanelContext;
  testIdPrefix: string;
  title: string;
}) {
  return (
    <AdminPanelPreviewProvider
      readOnly={isAdminOperationsPreviewReadOnly("admin", panelContext)}
      panelContext={panelContext}
    >
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <PreviewBlockerDemo testIdPrefix={testIdPrefix} />
      </div>
    </AdminPanelPreviewProvider>
  );
}

/** Harness podglądu panelu admina — bez auth, dla Playwright. */
export function E2ELabPreviewBlockerSection() {
  return (
    <section data-testid="e2e-preview-blocker" className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">Podgląd panelu — mutacje</h2>
      <PreviewBlockerCase
        panelContext="sales"
        testIdPrefix="preview-sales"
        title="Podgląd handlowca (read-only)"
      />
      <PreviewBlockerCase
        panelContext="zakupy"
        testIdPrefix="preview-zakupy"
        title="Podgląd zakupów (edytowalny)"
      />
    </section>
  );
}

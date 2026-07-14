"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { SAFETY_TIMEOUT_MS } from "@/hooks/useActionPending";

type ActionResult = {
  error?: string;
  success?: boolean;
  count?: number;
  processed?: number;
  sent?: number;
  emailSent?: number;
  emailFailures?: string[];
  failures?: string[];
  skipped?: boolean;
  reason?: string;
};

function formatResult(label: string, r: ActionResult): string {
  if (r.error) return r.error;
  if (r.emailFailures?.length) {
    return `${label}: przetworzono ${r.processed ?? 0}, błędy maili: ${r.emailFailures.join("; ")}`;
  }
  if (r.failures?.length) {
    return `${label}: wysłano ${r.sent ?? 0}, błędy: ${r.failures.join("; ")}`;
  }
  if (r.skipped && r.reason === "weekend") return `${label}: pominięto (weekend)`;
  if (r.skipped && r.reason === "email_not_configured") {
    return `${label}: pominięto (brak RESEND_API_KEY)`;
  }
  if (r.processed != null) return `${label}: przetworzono ${r.processed}`;
  if (r.sent != null) return `${label}: wysłano ${r.sent}`;
  if (r.count != null) return `${label}: ${r.count}`;
  if (r.success === false) return `${label}: zakończono z błędami`;
  return `${label}: gotowe`;
}

export function AdminActionButton({
  action,
  label,
  onMessage,
  loadingMessage,
  loadingHint = "Proszę czekać",
  overlayVariant = "viewport",
}: {
  action: () => Promise<ActionResult>;
  label: string;
  onMessage?: (text: string, tone?: "success" | "error") => void;
  loadingMessage?: string;
  loadingHint?: string;
  overlayVariant?: "section" | "viewport" | "modal";
}) {
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const safetyRef = useRef<number | null>(null);
  const busyMessage = loadingMessage ?? label;

  useEffect(() => {
    return () => {
      if (safetyRef.current) window.clearTimeout(safetyRef.current);
    };
  }, []);

  return (
    <>
      {pendingMessage ? (
        <ActionLoadingOverlay
          variant={overlayVariant}
          message={pendingMessage}
          hint={loadingHint}
        />
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          setPendingMessage(busyMessage);
          if (safetyRef.current) window.clearTimeout(safetyRef.current);
          safetyRef.current = window.setTimeout(() => setPendingMessage(null), SAFETY_TIMEOUT_MS);
          start(async () => {
            try {
              const r = await action();
              if (!onMessage) return;
              const hasError =
                Boolean(r.error) ||
                r.success === false ||
                (r.emailFailures?.length ?? 0) > 0 ||
                (r.failures?.length ?? 0) > 0;
              onMessage(formatResult(label, r), hasError ? "error" : "success");
            } finally {
              if (safetyRef.current) {
                window.clearTimeout(safetyRef.current);
                safetyRef.current = null;
              }
              setPendingMessage(null);
            }
          });
        }}
      >
        {pending ? (
          <>
            <Spinner size="sm" />
            Trwa…
          </>
        ) : (
          label
        )}
      </Button>
    </>
  );
}

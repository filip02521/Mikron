"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { SAFETY_TIMEOUT_MS } from "@/hooks/useActionPending";

export function SyncButton({
  action,
  label,
  onMessage,
  loadingMessage = "Przeliczanie terminów dostawców…",
  loadingHint = "Urlopy, interwały i panel dzienny",
  overlayVariant = "viewport",
}: {
  action: () => Promise<{ error?: string; success?: boolean; processed?: number }>;
  label: string;
  onMessage?: (text: string, tone?: "success" | "error") => void;
  loadingMessage?: string;
  loadingHint?: string;
  overlayVariant?: "section" | "viewport" | "modal";
}) {
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const safetyRef = useRef<number | null>(null);

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
        variant="outline"
        disabled={pending}
        onClick={() => {
          setPendingMessage(loadingMessage);
          if (safetyRef.current) window.clearTimeout(safetyRef.current);
          safetyRef.current = window.setTimeout(() => setPendingMessage(null), SAFETY_TIMEOUT_MS);
          start(async () => {
            try {
              const r = await action();
              if (onMessage) {
                if (r.error) onMessage(r.error, "error");
                else
                  onMessage(
                    r.processed != null
                      ? `Przeliczono terminy: ${r.processed} dostawców`
                      : "Operacja zakończona"
                  );
              }
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
            Przeliczanie…
          </>
        ) : (
          label
        )}
      </Button>
    </>
  );
}

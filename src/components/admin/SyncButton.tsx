"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";

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

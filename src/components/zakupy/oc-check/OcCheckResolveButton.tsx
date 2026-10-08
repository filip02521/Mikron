"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actionSetOcCheckResolved } from "@/app/actions/oc-check";
import { Button } from "@/components/ui/Button";

export function OcCheckResolveButton({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await actionSetOcCheckResolved({ id, resolved: !resolved });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant={resolved ? "ghost" : "secondary"} size="sm" onClick={toggle} disabled={pending}>
        {resolved ? "Przywróć do ruchu" : "Wyjaśnione"}
      </Button>
      {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

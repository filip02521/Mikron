"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restartSalesOnboarding } from "@/app/actions/sales-onboarding";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { settingCardInsetClass } from "@/components/settings/SettingToggleRow";
import { cn } from "@/lib/cn";

/** Handlowiec może wrócić do wprowadzenia — „Pomiń” nie jest już decyzją na zawsze. */
export function SalesOnboardingSettingsSection() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        title="Wprowadzenie"
        description="Krótki przewodnik po ekranach handlowca."
      />
      <div className={cn(settingCardInsetClass, "flex flex-wrap items-center gap-3")}>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await restartSalesOnboarding();
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.push("/moje");
              router.refresh();
            })
          }
        >
          {pending ? "Uruchamiam…" : "Pokaż wprowadzenie ponownie"}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restartSalesOnboarding } from "@/app/actions/sales-onboarding";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconHelpCircle } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";

/** Handlowiec może wrócić do wprowadzenia — „Pomiń” nie jest już decyzją na zawsze. */
export function SalesOnboardingSettingsSection() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Wprowadzenie"
        description="Krótki przewodnik po ekranach handlowca."
        leading={
          <SectionHeadingIcon tileClassName="bg-indigo-100 text-indigo-800">
            <IconHelpCircle size={20} />
          </SectionHeadingIcon>
        }
      />
      <div className={cn(salesChromeInsetClass, "flex flex-wrap items-center gap-3 py-3.5")}>
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
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

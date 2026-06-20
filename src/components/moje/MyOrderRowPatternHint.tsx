"use client";

import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import type { MyOrderSectionCalloutTone } from "@/lib/orders/my-order-section-callout";

const toneMap: Record<MyOrderSectionCalloutTone, "warning" | "sky" | "indigo"> = {
  warning: "warning",
  sky: "sky",
  indigo: "indigo",
};

/** Ikona ? przy wierszu listy Moje — wyjaśnienie statusu pozycji. */
export function MyOrderRowPatternHint({
  message,
  tone,
  className,
}: {
  message: string;
  tone: MyOrderSectionCalloutTone;
  className?: string;
}) {
  return (
    <HelpHintBubble
      message={message}
      tone={toneMap[tone]}
      className={className}
      ariaLabel="Wyjaśnienie statusu pozycji"
    />
  );
}

"use client";

import type { ReactNode } from "react";
import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { cn } from "@/lib/cn";
import { panelSegmentFirstClass } from "@/lib/ui/ontime-theme";
import { mojeActionBarShellClass } from "@/lib/ui/surfaces";

/** Potwierdzenie pozycji + menu ⋮ — jak pasek akcji w zwiniętej karcie prośby. */
export function MyOrderLineActionBar({
  showPickup,
  pickupLabel,
  pickupTitle,
  onPickup,
  pending,
  preview,
  informacjaAck = false,
  cancelMenu,
}: {
  showPickup: boolean;
  pickupLabel?: string;
  pickupTitle?: string;
  onPickup?: () => void;
  pending?: boolean;
  preview?: boolean;
  informacjaAck?: boolean;
  cancelMenu?: ReactNode;
}) {
  const hasCancel = Boolean(cancelMenu);
  const hasPickup = showPickup;

  if (!hasPickup && !hasCancel) return null;

  if (hasPickup && hasCancel) {
    return (
      <div className={cn(mojeActionBarShellClass, "w-full min-w-0")}>
        <MyOrderAckButton
          variant={informacjaAck ? "segmentInformacja" : "segmentPrimary"}
          disabled={pending}
          preview={preview}
          title={pickupTitle}
          ariaLabel={pickupTitle}
          onClick={onPickup!}
          className={cn(panelSegmentFirstClass, "min-w-0 flex-1")}
        >
          {pickupLabel}
        </MyOrderAckButton>
        {cancelMenu}
      </div>
    );
  }

  if (hasPickup) {
    return (
      <MyOrderAckButton
        variant="linePickup"
        disabled={pending}
        preview={preview}
        title={pickupTitle}
        ariaLabel={pickupTitle}
        onClick={onPickup!}
      >
        {pickupLabel}
      </MyOrderAckButton>
    );
  }

  return <>{cancelMenu}</>;
}

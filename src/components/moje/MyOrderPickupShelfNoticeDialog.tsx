"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { MY_ORDER_PICKUP_SHELF_NOTICE } from "@/lib/orders/my-order-pickup-shelf-notice";
import { cn } from "@/lib/cn";

function PickupShelfDedicatedIllustration({ glowId }: { glowId: string }) {
  return (
    <svg
      viewBox="0 0 220 128"
      className="h-[7.5rem] w-full max-w-[13.75rem]"
      aria-hidden
    >
      <defs>
        <linearGradient id={glowId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--color-emerald-400)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-emerald-400)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="24" y="82" width="172" height="10" rx="3" fill="var(--color-emerald-100)" />
      <rect x="24" y="82" width="172" height="3" rx="1.5" fill="var(--color-emerald-200)" />
      <rect x="30" y="92" width="6" height="24" rx="2" fill="var(--color-emerald-50)" stroke="var(--color-emerald-200)" />
      <rect x="184" y="92" width="6" height="24" rx="2" fill="var(--color-emerald-50)" stroke="var(--color-emerald-200)" />

      <rect x="38" y="58" width="30" height="24" rx="4" fill="var(--color-slate-50)" stroke="var(--color-slate-300)" />
      <path d="M44 58v-6a3 3 0 013-3h16a3 3 0 013 3v6" fill="none" stroke="var(--color-slate-300)" />

      <rect x="152" y="60" width="28" height="22" rx="4" fill="var(--color-slate-50)" stroke="var(--color-slate-300)" />
      <path d="M158 60v-5a3 3 0 013-3h14a3 3 0 013 3v5" fill="none" stroke="var(--color-slate-300)" />

      <ellipse cx="110" cy="52" rx="34" ry="18" fill={`url(#${glowId})`} />

      <rect
        x="82"
        y="46"
        width="56"
        height="36"
        rx="5"
        fill="var(--color-emerald-50)"
        stroke="var(--color-emerald-500)"
        strokeWidth="2.25"
      />
      <path
        d="M88 46v-8a4 4 0 014-4h36a4 4 0 014 4v8"
        fill="var(--color-emerald-100)"
        stroke="var(--color-emerald-500)"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      <path
        d="M98 66l6 6 14-14"
        fill="none"
        stroke="var(--color-emerald-600)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <rect x="92" y="28" width="36" height="14" rx="7" fill="var(--color-emerald-600)" />
      <text
        x="110"
        y="38.5"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="9"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        Twoje
      </text>

      <path
        d="M62 74h16M142 76h12"
        stroke="var(--color-slate-400)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3 3"
        opacity="0.55"
      />
    </svg>
  );
}

export function MyOrderPickupShelfNoticeDialog({
  open,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const copy = MY_ORDER_PICKUP_SHELF_NOTICE;
  const glowId = useId().replace(/:/g, "");
  const bodyDescriptionId = useId();

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={copy.title}
      titleId="pickup-shelf-notice-title"
      describedById={bodyDescriptionId}
      role="alertdialog"
      size="sm"
      tier="stack"
      disableBackdropClose={pending}
      loadingMessage={pending ? "Przetwarzanie…" : null}
      className="overflow-hidden"
      bodyClassName="px-0 py-0"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={onCancel}
            disabled={pending}
          >
            {copy.cancelLabel}
          </Button>
          <Button
            className={cn(
              "min-h-11 w-full border-0 bg-emerald-600 text-white shadow-sm sm:w-auto",
              "hover:bg-success-hover active:bg-success-pressed"
            )}
            onClick={onConfirm}
            disabled={pending}
          >
            {copy.confirmLabel}
          </Button>
        </div>
      }
    >
      {/* Jedna studnia z ilustracją, tekst bez kolejnej karty — zieleń znaczy „gotowe”, nie dekorację. */}
      <div className="px-5 py-5 sm:px-6">
        <div className="flex justify-center rounded-lg bg-emerald-50/70 px-4 py-3">
          <PickupShelfDedicatedIllustration glowId={glowId} />
        </div>
        <div id={bodyDescriptionId} className="mt-4 space-y-1.5">
          <p className="text-sm font-semibold leading-snug text-slate-900">{copy.headline}</p>
          <p className="text-sm leading-relaxed text-slate-700">{copy.lead}</p>
          <p className="text-sm leading-relaxed text-slate-600">{copy.detail}</p>
        </div>
      </div>
    </ModalShell>
  );
}

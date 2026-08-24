"use client";

import type { ReactNode } from "react";
import {
  formatZdEstimateTableQty,
  isZdEstimateTableQtyZero,
} from "@/lib/orders/zd-estimate-table-qty";
import { cn } from "@/lib/cn";

export type ZdEstimateQtyTier = "a" | "b" | "c" | "d";

export type ZdEstimateQtyUnit =
  | "szt"
  | "op"
  | "jdok"
  | "packRatio"
  | "xn"
  | "none";

export type ZdEstimateQtyTone =
  | "default"
  | "warn"
  | "muted"
  | "decision"
  | "override";

const UNIT_LABEL: Record<Exclude<ZdEstimateQtyUnit, "none">, string> = {
  szt: "szt",
  op: "op.",
  jdok: "j.dok.",
  packRatio: "szt/op",
  xn: "×N",
};

/**
 * Wspólna prezentacja liczb w tabeli szacunku ZD.
 * Tier: a = Do ZD (większy); b/c/d = ta sama wielkość (waga / cichość).
 */
export function ZdEstimateQtyValue({
  value,
  tier,
  unit = "none",
  zeroAsDash = false,
  tone = "default",
  title,
  subline,
  align = "center",
  className,
  valueClassName,
}: {
  value: number;
  tier: ZdEstimateQtyTier;
  unit?: ZdEstimateQtyUnit;
  /** true → 0 jako „—” (Otwarte / Rez / ZK / API / Sprzed.). */
  zeroAsDash?: boolean;
  tone?: ZdEstimateQtyTone;
  title?: string;
  subline?: ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
  valueClassName?: string;
}) {
  const finite = Number.isFinite(value);
  const showDash = !finite || (zeroAsDash && isZdEstimateTableQtyZero(value));
  const unitKey = unit === "none" ? null : unit;

  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full flex-col gap-0.5",
        align === "end"
          ? "items-end text-right"
          : align === "start"
            ? "items-start text-left"
            : "items-center text-center",
        className
      )}
      title={title}
    >
      <span
        className={cn(
          "inline-flex max-w-full items-baseline gap-0.5 leading-none",
          align === "end"
            ? "justify-end"
            : align === "start"
              ? "justify-start"
              : "justify-center"
        )}
      >        {showDash ? (
          <span
            className={cn(
              "zd-est-qty--dash",
              tier === "a"
                ? "zd-est-qty--a"
                : tier === "b"
                  ? "zd-est-qty--b"
                  : tier === "c"
                    ? "zd-est-qty--c"
                    : "zd-est-qty--d"
            )}
          >
            —
          </span>
        ) : (
          <>
            <span
              className={cn(
                "min-w-0 truncate",
                tier === "a"
                  ? "zd-est-qty--a"
                  : tier === "b"
                    ? "zd-est-qty--b"
                    : tier === "c"
                      ? "zd-est-qty--c"
                      : "zd-est-qty--d",
                tone === "warn" && "zd-est-qty--warn",
                tone === "muted" && "zd-est-qty--muted",
                tone === "decision" && "zd-est-qty--decision",
                tone === "override" && "zd-est-qty--override",
                valueClassName
              )}
            >
              {formatZdEstimateTableQty(value)}
            </span>
            {unitKey ? (
              <span className="zd-est-unit shrink-0">{UNIT_LABEL[unitKey]}</span>
            ) : null}
          </>
        )}
      </span>
      {subline && !showDash ? (
        <span
          className={cn(
            "flex w-full min-w-0 flex-col gap-px",
            align === "end"
              ? "items-end"
              : align === "start"
                ? "items-start"
                : "items-center"
          )}
        >
          {subline}
        </span>
      ) : null}
    </span>
  );
}

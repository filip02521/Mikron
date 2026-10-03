"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
} from "@/components/ui/OverflowMenu";
import { actionSetStockWatchRule } from "@/app/actions/stock-watch";
import type { StockWatchRule } from "@/lib/stock-watch/analysis";
import { STOCK_WATCH_RULE_META } from "@/components/stock-watch/stock-watch-format";

const RULE_OPTIONS: { value: StockWatchRule; label: string; title: string }[] = (
  ["standard", "on_request", "excluded"] as const
).map((value) => ({
  value,
  label: STOCK_WATCH_RULE_META[value].short,
  title: STOCK_WATCH_RULE_META[value].description,
}));

/**
 * Inline zmiana reguły towaru (te same flagi co w kreatorze ZD).
 * Optymistycznie — przy błędzie wraca do poprzedniej wartości.
 */
export function StockRuleControl({
  subiektTwId,
  twSymbol,
  twNazwa,
  rule,
  disabled,
  onError,
  onChanged,
}: {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  rule: StockWatchRule;
  disabled?: boolean;
  onError: (message: string) => void;
  onChanged?: (rule: StockWatchRule) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState<StockWatchRule>(rule);
  const [lastPropRule, setLastPropRule] = useState(rule);
  const [pending, startTransition] = useTransition();

  // Nowe dane z serwera (router.refresh) wygrywają nad lokalnym stanem.
  if (rule !== lastPropRule) {
    setLastPropRule(rule);
    setValue(rule);
  }

  const change = (next: StockWatchRule) => {
    if (next === value) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await actionSetStockWatchRule({ subiektTwId, twSymbol, twNazwa, rule: next });
      if (!res.ok) {
        setValue(prev);
        onError(res.message);
        return;
      }
      onChanged?.(next);
      router.refresh();
    });
  };

  return (
    <SegmentedControl
      value={value}
      onChange={change}
      options={RULE_OPTIONS}
      ariaLabel={`Reguła dla ${twSymbol ?? twNazwa}`}
      density="compact"
      disabled={disabled || pending}
    />
  );
}

/** Kompaktowa reguła w gęstych tabelach (alerty) — menu „⋯” zamiast przełącznika. */
export function StockRuleMenu({
  subiektTwId,
  twSymbol,
  twNazwa,
  rule,
  onError,
}: {
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  rule: StockWatchRule;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const set = (next: StockWatchRule) => {
    if (next === rule) return;
    startTransition(async () => {
      const res = await actionSetStockWatchRule({ subiektTwId, twSymbol, twNazwa, rule: next });
      if (!res.ok) {
        onError(res.message);
        return;
      }
      router.refresh();
    });
  };
  return (
    <OverflowMenu label={`Reguła dla ${twSymbol ?? twNazwa}`} align="end" iconOnly disabled={pending}>
      <OverflowMenuLabel>Reguła towaru</OverflowMenuLabel>
      {(["standard", "on_request", "excluded"] as const).map((value) => (
        <OverflowMenuItem
          key={value}
          onClick={() => set(value)}
          disabled={value === rule}
          title={STOCK_WATCH_RULE_META[value].description}
        >
          {value === rule ? "✓ " : ""}
          {STOCK_WATCH_RULE_META[value].label}
        </OverflowMenuItem>
      ))}
    </OverflowMenu>
  );
}

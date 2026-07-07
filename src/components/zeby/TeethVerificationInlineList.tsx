"use client";

import { useEffect, useMemo, useState } from "react";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import {
  teethPanelReadinessContextFromMaps,
  resolveTeethProductLineForPanelOrder,
} from "@/lib/teeth/teeth-panel-order-readiness";
import { buildSpecGroups, type SpecGroup } from "@/lib/teeth/teeth-verification-inline";
import { TeethVerificationInlineRow } from "@/components/zeby/TeethVerificationInlineRow";
import { TeethVerificationAddRow } from "@/components/zeby/TeethVerificationAddRow";
import { TeethPanelEditOrderTrigger } from "@/components/zeby/TeethPanelEditOrderTrigger";
import { Button } from "@/components/ui/Button";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import { teethPanelEditLinkClass } from "@/lib/teeth/teeth-panel-ui";
import type { TeethQueueItem } from "@/lib/data/teeth-queue";
import type { TeethProductLine } from "@/lib/teeth/teeth-catalog-types";

type OrderWithSpecs = {
  orderId: string;
  item: TeethQueueItem;
  productLine: TeethProductLine | null;
  specs: SpecGroup[];
};

function buildOrderSpecs(
  items: TeethQueueItem[],
  readinessCtx: ReturnType<typeof teethPanelReadinessContextFromMaps>,
): OrderWithSpecs[] {
  return items.map((item) => {
    const productLine = resolveTeethProductLineForPanelOrder(item, readinessCtx);
    const details = item.teeth_details ?? [];
    const specs = buildSpecGroups(
      details.map((d) => ({
        color: d.color,
        mould: d.mould,
        jaw: d.jaw,
        kind: d.kind,
        ordered_at: d.ordered_at,
      })),
    );
    return { orderId: item.id, item, productLine, specs };
  });
}

export function TeethVerificationInlineList({
  items,
  onSaved,
  onApproveOrder,
}: {
  items: TeethQueueItem[];
  onSaved?: () => void;
  onApproveOrder?: (orderId: string) => void;
}) {
  const teethProductInfo = useTeethProductInfo();
  const readinessCtx = useMemo(
    () => teethPanelReadinessContextFromMaps(teethProductInfo),
    [teethProductInfo],
  );

  const [checkedOrders, setCheckedOrders] = useState<Set<string>>(new Set());
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const [visitedRows, setVisitedRows] = useState<Set<string>>(new Set());

  const orders = useMemo(
    () => buildOrderSpecs(items, readinessCtx),
    [items, readinessCtx],
  );

  const flatRowKeys = useMemo(() => {
    const keys: string[] = [];
    for (const order of orders) {
      const ant = order.specs.filter((s) => s.kind === "anterior");
      const post = order.specs.filter((s) => s.kind === "posterior");
      ant.forEach((_, idx) => keys.push(`${order.orderId}-ant-${idx}`));
      post.forEach((_, idx) => keys.push(`${order.orderId}-post-${idx}`));
    }
    return keys;
  }, [orders]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      const currentIdx = activeRowKey ? flatRowKeys.indexOf(activeRowKey) : -1;
      let nextIdx: number;
      if (e.key === "ArrowDown") {
        nextIdx = currentIdx + 1;
        if (nextIdx >= flatRowKeys.length) return;
      } else {
        nextIdx = currentIdx - 1;
        if (nextIdx < 0) return;
      }
      if (currentIdx >= 0) {
        setVisitedRows((prev) => new Set(prev).add(flatRowKeys[currentIdx]));
      }
      setActiveRowKey(flatRowKeys[nextIdx]);
      const el = document.querySelector(`[data-row-key="${flatRowKeys[nextIdx]}"]`);
      if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeRowKey, flatRowKeys]);

  const handleSaved = (orderId: string) => {
    setCheckedOrders((prev) => new Set(prev).add(orderId));
    onSaved?.();
  };

  return (
    <div>
      <table className="w-full text-left text-xs">
        <tbody>
          {orders.map((order) => {
            const salesName = order.item.sales_person_name ?? null;
            const hasNoLine = order.productLine == null;
            const isChecked = checkedOrders.has(order.orderId);

            return (
              <OrderRows
                key={order.orderId}
                order={order}
                salesName={salesName}
                hasNoLine={hasNoLine}
                isChecked={isChecked}
                activeRowKey={activeRowKey}
                visitedRows={visitedRows}
                onSaved={() => handleSaved(order.orderId)}
                onApproveOrder={onApproveOrder}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrderRows({
  order,
  salesName,
  hasNoLine,
  isChecked,
  activeRowKey,
  visitedRows,
  onSaved,
  onApproveOrder,
}: {
  order: OrderWithSpecs;
  salesName: string | null;
  hasNoLine: boolean;
  isChecked: boolean;
  activeRowKey: string | null;
  visitedRows: Set<string>;
  onSaved?: () => void;
  onApproveOrder?: (orderId: string) => void;
}) {
  const anteriorSpecs = order.specs.filter((s) => s.kind === "anterior");
  const posteriorSpecs = order.specs.filter((s) => s.kind === "posterior");
  const hasPosterior = posteriorSpecs.length > 0;

  return (
    <>
      {salesName ? (
        <tr className="border-b border-slate-200/60 bg-slate-50/40">
          <td
            colSpan={hasPosterior ? 4 : 3}
            className="py-1 pl-1 pr-1"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {isChecked ? (
                  <IconCircleCheck size={13} className="shrink-0 text-emerald-500" />
                ) : null}
                <span className="text-[11px] font-semibold text-slate-700">
                  {salesName}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {!hasNoLine && onApproveOrder ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onApproveOrder(order.orderId)}
                    className="px-1.5"
                  >
                    <IconCircleCheck size={14} />
                  </Button>
                ) : null}
                {hasNoLine ? (
                  <TeethPanelEditOrderTrigger
                    orderId={order.orderId}
                    onSaved={onSaved}
                    className={teethPanelEditLinkClass}
                    label="Edytuj prośbę"
                  />
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
      {order.specs.length === 0 ? (
        <tr className="border-b border-slate-100">
          <td colSpan={4} className="py-1 pl-1 pr-1 text-[11px] text-slate-400">
            Brak pozycji zębów
          </td>
        </tr>
      ) : (
        <>
          {anteriorSpecs.length > 0 ? (
            <KindSectionHeader label="Przody" hasJaw={false} />
          ) : null}
          {anteriorSpecs.map((spec, idx) => {
            const rowKey = `${order.orderId}-ant-${idx}`;
            return (
              <TeethVerificationInlineRow
                key={rowKey}
                rowKey={rowKey}
                orderId={order.orderId}
                spec={spec}
                productLine={order.productLine}
                showJaw={false}
                isActive={activeRowKey === rowKey}
                isVisited={visitedRows.has(rowKey)}
                onSaved={onSaved}
              />
            );
          })}
          {posteriorSpecs.length > 0 ? (
            <KindSectionHeader label="Boki" hasJaw={true} />
          ) : null}
          {posteriorSpecs.map((spec, idx) => {
            const rowKey = `${order.orderId}-post-${idx}`;
            return (
              <TeethVerificationInlineRow
                key={rowKey}
                rowKey={rowKey}
                orderId={order.orderId}
                spec={spec}
                productLine={order.productLine}
                showJaw={true}
                isActive={activeRowKey === rowKey}
                isVisited={visitedRows.has(rowKey)}
                onSaved={onSaved}
              />
            );
          })}
        </>
      )}
      {order.productLine ? (
        <tr className="border-b border-slate-100 last:border-b-0">
          <td colSpan={4} className="p-0">
            <TeethVerificationAddRow
              orderId={order.orderId}
              productLine={order.productLine}
              onSaved={onSaved}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function KindSectionHeader({ label, hasJaw }: { label: string; hasJaw: boolean }) {
  return (
    <>
      <tr className="border-b border-slate-100 bg-slate-50/40">
        <td className="py-0.5 px-1" colSpan={hasJaw ? 4 : 3}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </span>
        </td>
      </tr>
      <tr className="border-b border-slate-200/60 text-[9px] font-medium uppercase tracking-wide text-slate-400">
        <th className="py-0.5 px-1 font-medium">Kolor</th>
        <th className="py-0.5 px-1 font-medium">Fason</th>
        {hasJaw ? <th className="py-0.5 px-1 font-medium">Szczęka</th> : null}
        <th className="py-0.5 px-1 text-right font-medium">Szt.</th>
      </tr>
    </>
  );
}

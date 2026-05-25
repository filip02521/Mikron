"use client";

import { useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { ARCHIVE_RECENT_DAYS } from "@/lib/orders/my-order-archive";
import { MyOrderShipmentList } from "@/components/moje/MyOrderShipmentList";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MojeSectionIcon, mojeSectionIconTileClass } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";

export function MyOrderArchiveSection({
  rowsRecent,
  rowsExtended,
}: {
  /** Potwierdzenia z ostatnich 7 dni. */
  rowsRecent: MyOrderRow[];
  /** Szersze archiwum (np. 90 dni), po „Pokaż więcej”. */
  rowsExtended: MyOrderRow[];
}) {
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const hasRecent = rowsRecent.length > 0;
  const hasExtended = rowsExtended.length > 0;
  const hasMoreToLoad =
    rowsExtended.length > rowsRecent.length ||
    rowsExtended.some((r) => !rowsRecent.some((x) => x.id === r.id));

  if (!hasRecent && !hasExtended) return null;

  const visibleRows = showMore ? rowsExtended : rowsRecent;

  const countLabel = (n: number) =>
    `${n} ${n === 1 ? "wpis" : n < 5 ? "wpisy" : "wpisów"}`;

  const description = open
    ? showMore
      ? `${countLabel(rowsExtended.length)} z ostatnich 90 dni — tylko do wglądu`
      : hasRecent
        ? `${countLabel(rowsRecent.length)} z ostatnich ${ARCHIVE_RECENT_DAYS} dni — tylko do wglądu`
        : `Brak wpisów z ostatnich ${ARCHIVE_RECENT_DAYS} dni`
    : `Odebrane, wycofane i zakończone prośby z ostatnich ${ARCHIVE_RECENT_DAYS} dni`;

  return (
    <div id="moje-ostatnio-zakonczone">
    <Card padding={false} className="border-slate-200/80 bg-slate-50/50">
      <CardHeader
        inset
        title="Ostatnio zakończone"
        description={description}
        leading={
          <SectionHeadingIcon tileClassName={mojeSectionIconTileClass("archive")}>
            <MojeSectionIcon kind="archive" size={20} />
          </SectionHeadingIcon>
        }
        action={
          <button
            type="button"
            onClick={() => {
              setOpen((v) => {
                if (v) setShowMore(false);
                return !v;
              });
            }}
            className="min-h-10 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            aria-expanded={open}
          >
            {open ? "Zwiń" : "Pokaż"}
          </button>
        }
      />
      {open ? (
        <div>
          {visibleRows.length > 0 ? (
            <MyOrderShipmentList
              rows={visibleRows}
              listKind={visibleRows[0]?.kind === "informacja" ? "informacja" : "zamowienie"}
              showProgress={false}
              canAcknowledge={false}
            />
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">
              W ostatnich {ARCHIVE_RECENT_DAYS} dniach nie ma zakończonych wpisów.
              {hasMoreToLoad
                ? " Starsze pozycje zobaczysz po kliknięciu „Pokaż więcej” poniżej."
                : null}
            </p>
          )}
          {hasMoreToLoad ? (
            <div className="border-t border-slate-100 px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setShowMore((v) => !v)}
              >
                {showMore
                  ? "Pokaż tylko ostatnie 7 dni"
                  : `Pokaż więcej (${countLabel(rowsExtended.length)} z 90 dni)`}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
    </div>
  );
}

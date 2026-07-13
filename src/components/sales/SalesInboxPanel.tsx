"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconBell, IconSun } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { SalesDayStartItemRow } from "@/components/sales/SalesDayStartItemRow";
import { useSalesInbox } from "@/components/sales/SalesInboxContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { hrefWithSalesPreviewFromUrl } from "@/lib/nav/sales-preview-href";
import { scrollToMojeSectionWhenReady } from "@/lib/orders/moje-section-focus";
import {
  salesDayStartPanelDescription,
  sliceSalesDayStartItems,
} from "@/lib/sales/sales-day-start";
import { cn } from "@/lib/cn";
import {
  mojeShipmentListClass,
  mojeShipmentSectionShellClass,
} from "@/lib/ui/moje-shipment-row-styles";
import {
  brandLinkClass,
  controlFocusClass,
  panelTypography,
  salesTypography,
  sectionIconTileBrandClass,
} from "@/lib/ui/ontime-theme";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import { EmptyState } from "@/components/ui/EmptyState";

export const SALES_INBOX_PANEL_ID = "sales-inbox-panel";

export function SalesInboxPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inbox = useSalesInbox();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const hydrated = useClientHydrated();
  const panelRef = useRef<HTMLElement>(null);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const snapshot = inbox?.snapshot;
  const count = inbox?.count ?? 0;

  useBodyScrollLock(open);
  useFocusTrap(panelRef, open);

  const handleClose = useCallback(() => {
    setItemsExpanded(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, open]);

  const previewHref = useCallback(
    (href: string) => hrefWithSalesPreviewFromUrl(href, previewDla),
    [previewDla]
  );

  const handleScrollToSection = useCallback(
    (scrollTarget: string, fallbackHref: string) => {
      const targetHref = previewHref(fallbackHref);
      if (pathname === "/moje") {
        scrollToMojeSectionWhenReady(
          scrollTarget,
          () => router.push(targetHref),
          { delayMs: 120, maxAttempts: 10, initialDelayMs: 150 }
        );
        return;
      }
      router.push(targetHref);
    },
    [pathname, previewHref, router]
  );

  if (!open || !hydrated || !inbox) return null;

  const cleared = !snapshot || snapshot.cleared;
  const { visible: visibleItems, hiddenCount } = sliceSalesDayStartItems(
    snapshot?.items ?? [],
    itemsExpanded
  );

  return createPortal(
    <div className="fixed inset-0 z-[58]" role="presentation">
      <button
        type="button"
        aria-label="Zamknij powiadomienia"
        className="panel-slide-backdrop-enter absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
        onClick={handleClose}
      />
      <aside
        ref={panelRef}
        id={SALES_INBOX_PANEL_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Pilne sprawy"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200/90 bg-white shadow-2xl",
          "panel-slide-enter"
        )}
        {...{ [SCROLL_LOCK_ALLOW_ATTR]: true }}
      >
        <header className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconSun size={20} />
            </SectionHeadingIcon>
            <div className="min-w-0 flex-1">
              <h2 className={panelTypography.sectionTitle}>Pilne sprawy</h2>
              <p className={cn("mt-0.5", salesTypography.sectionHint)}>
                {cleared
                  ? "Brak pilnych spraw — możesz wrócić do pracy."
                  : salesDayStartPanelDescription(count)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "min-h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50",
                controlFocusClass
              )}
            >
              Zamknij
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {cleared ? (
            <EmptyState
              brandAccent
              icon={<IconBell size={28} strokeWidth={1.75} />}
              title="Wszystko ogarnięte"
              description="Gdy pojawi się odbiór, informacja, przypomnienie ZK lub odpowiedź zakupów na Twoje pytanie — zobaczysz to tutaj."
            />
          ) : (
            <>
              <ul className={cn(mojeShipmentSectionShellClass, mojeShipmentListClass)}>
                {visibleItems.map((item) => (
                  <SalesDayStartItemRow
                    key={item.id}
                    item={item}
                    previewHref={previewHref}
                    onNavigate={handleClose}
                    onScrollToSection={handleScrollToSection}
                  />
                ))}
              </ul>
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setItemsExpanded(true)}
                  className={cn("mt-2.5 px-1 text-xs font-semibold", brandLinkClass)}
                >
                  Pokaż jeszcze {hiddenCount}{" "}
                  {hiddenCount === 1 ? "sprawę" : hiddenCount < 5 ? "sprawy" : "spraw"}
                </button>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}

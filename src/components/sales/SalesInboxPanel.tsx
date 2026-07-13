"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconBell, IconSun, IconX } from "@/components/icons/StrokeIcons";
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
  salesTypography,
  sectionIconTileBrandClass,
} from "@/lib/ui/ontime-theme";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import { sidePanelBackdropClass, sidePanelCloseButtonClass, sidePanelHeaderClass } from "@/lib/ui/surfaces";
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
        className={cn(sidePanelBackdropClass, "z-[58]", "panel-slide-backdrop-enter")}
        onClick={handleClose}
      />
      <aside
        ref={panelRef}
        id={SALES_INBOX_PANEL_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Pilne sprawy"
        className={cn(
          "absolute inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-l border-slate-200/80 bg-white shadow-2xl",
          "panel-slide-enter"
        )}
        {...{ [SCROLL_LOCK_ALLOW_ATTR]: true }}
      >
        <header className={sidePanelHeaderClass}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
                <IconSun size={20} />
              </SectionHeadingIcon>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-900">Pilne sprawy</h2>
                <p className={cn("mt-0.5 text-sm leading-relaxed", salesTypography.sectionHint)}>
                  {cleared
                    ? "Brak pilnych spraw — możesz wrócić do pracy."
                    : salesDayStartPanelDescription(count)}
                </p>
              </div>
            </div>
            <button
              type="button"
              className={sidePanelCloseButtonClass}
              onClick={handleClose}
              aria-label="Zamknij"
            >
              <IconX size={18} />
            </button>
          </div>
        </header>

        <div
          className="flex-1 overflow-y-auto px-5 py-5"
          {...{ [SCROLL_LOCK_ALLOW_ATTR]: true }}
        >
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

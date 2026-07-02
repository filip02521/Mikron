"use client";

import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconBell, IconSun } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { SalesDayStartItemRow } from "@/components/sales/SalesDayStartItemRow";
import { useSalesInbox } from "@/components/sales/SalesInboxContext";
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
  const snapshot = inbox?.snapshot;
  const count = inbox?.count ?? 0;

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  const previewHref = useCallback(
    (href: string) => hrefWithSalesPreviewFromUrl(href, previewDla),
    [previewDla]
  );

  const handleScrollToSection = useCallback(
    (scrollTarget: string, fallbackHref: string) => {
      const targetHref = previewHref(fallbackHref);
      if (pathname === "/moje") {
        scrollToMojeSectionWhenReady(scrollTarget, () => router.push(targetHref));
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
    false
  );

  return createPortal(
    <div className="fixed inset-0 z-[58]" role="presentation">
      <button
        type="button"
        aria-label="Zamknij powiadomienia"
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Pilne sprawy"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200/90 bg-white shadow-2xl",
          "sales-inbox-panel-enter"
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
              onClick={onClose}
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
                    onNavigate={onClose}
                    onScrollToSection={handleScrollToSection}
                  />
                ))}
              </ul>
              {hiddenCount > 0 ? (
                <p className={cn("mt-2.5 px-1 text-xs text-slate-600", salesTypography.rowBody)}>
                  Jeszcze {hiddenCount}{" "}
                  {hiddenCount === 1 ? "sprawa" : hiddenCount < 5 ? "sprawy" : "spraw"} — otwórz{" "}
                  <button
                    type="button"
                    className={brandLinkClass}
                    onClick={() => {
                      onClose();
                      router.push(previewHref("/moje"));
                    }}
                  >
                    Moje zamówienia
                  </button>
                  .
                </p>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}

export function SalesInboxBellTrigger({
  className,
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const inbox = useSalesInbox();
  if (!inbox) return null;

  const { count, open, setOpen, ringing } = inbox;
  const showBadge = count > 0;
  const iconSize = size === "lg" ? 24 : 20;
  const buttonSize = size === "lg" ? "h-12 w-12" : "h-10 w-10";

  return (
    <button
      type="button"
      aria-label={
        showBadge
          ? `Pilne sprawy: ${count}. Otwórz panel powiadomień.`
          : "Brak pilnych spraw. Otwórz panel powiadomień."
      }
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-800",
        buttonSize,
        controlFocusClass,
        ringing && "sales-bell-ring",
        className
      )}
    >
      <IconBell size={iconSize} strokeWidth={2} />
      {showBadge ? (
        <span
          className={cn(
            "absolute -right-1 -top-1 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white",
            ringing && "animate-pulse"
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}

/** Desktop: stały dzwonek w prawym górnym rogu. */
export function SalesInboxFloatingBell() {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[45] hidden md:block">
      <div className="pointer-events-auto">
        <SalesInboxBellTrigger size="lg" />
      </div>
    </div>
  );
}

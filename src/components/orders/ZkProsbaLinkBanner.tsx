import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { ZkProsbaLinkChip } from "@/components/orders/ZkProsbaLinkChip";
import { notatnikZkWatchHref } from "@/lib/orders/notatnik-zk-watch-href";
import { ZK_PROSBA_LINK_BANNER_COPY } from "@/lib/orders/zk-prosba-link-banner-copy";
import { salesTypography } from "@/lib/ui/ontime-theme";

export function ZkProsbaLinkBanner({
  zkNumber,
  zkWatchId,
  salesPersonId,
  previewDla,
  clientLabel,
  mode = "full",
  supplementLineCount,
  catalogLocked = false,
}: {
  zkNumber: string;
  zkWatchId?: string | null;
  salesPersonId?: string | null;
  previewDla?: string | null;
  clientLabel?: string | null;
  mode?: "full" | "supplement";
  supplementLineCount?: number;
  /** True gdy typeahead jest ograniczony do produktów ZK. */
  catalogLocked?: boolean;
}) {
  const nr = zkNumber.trim();
  if (!nr) return null;

  const client = clientLabel?.trim();
  const href = notatnikZkWatchHref(zkWatchId, { salesPersonId, previewDla });
  const supplementCount = supplementLineCount ?? 0;
  const isSupplement = mode === "supplement" && supplementCount > 0;

  return (
    <div
      className={cn(
        "border-b px-3 py-2.5 sm:px-4",
        isSupplement
          ? "border-amber-200/90 bg-amber-50/85 text-amber-950"
          : "border-indigo-100/90 bg-indigo-50/55 text-indigo-950"
      )}
      role="status"
    >
      <div className="flex flex-wrap items-start gap-2">
        <Badge
          variant={isSupplement ? "warning" : "default"}
          className="shrink-0 text-[10px]"
        >
          {ZK_PROSBA_LINK_BANNER_COPY.badge}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className={cn("leading-snug", salesTypography.rowTitle)}>
            <span className={isSupplement ? "font-medium text-amber-950" : "font-medium text-indigo-950"}>
              {ZK_PROSBA_LINK_BANNER_COPY.leadCreating}{" "}
            </span>
            <ZkProsbaLinkChip
              zkNumber={nr}
              href={href}
              inline
              className="text-sm"
            />
            {client ? (
              <span className={isSupplement ? "text-amber-900/90" : "text-indigo-900/85"}>
                {" "}
                · {client}
              </span>
            ) : null}
          </p>
          {isSupplement ? (
            <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
              <span className="font-semibold">Uzupełniająca prośba</span> — {supplementCount}{" "}
              {supplementCount === 1
                ? "nowa pozycja"
                : supplementCount < 5
                  ? "nowe pozycje"
                  : "nowych pozycji"}{" "}
              z ZK. Wcześniejsze pozycje są już w zamówieniu.
              {catalogLocked ? ` ${ZK_PROSBA_LINK_BANNER_COPY.supplementLockedSuffix}` : null}
            </p>
          ) : (
            <p
              className={cn(
                "mt-1 text-xs leading-relaxed",
                catalogLocked ? "text-indigo-900/80" : "text-amber-900/90"
              )}
            >
              {catalogLocked
                ? ZK_PROSBA_LINK_BANNER_COPY.fullLockedDetail
                : ZK_PROSBA_LINK_BANNER_COPY.fullUnlockedDetail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

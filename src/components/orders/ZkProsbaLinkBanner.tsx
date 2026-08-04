import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { ZkProsbaLinkChip } from "@/components/orders/ZkProsbaLinkChip";
import { notatnikZkWatchHref } from "@/lib/orders/notatnik-zk-watch-href";
import { ZK_PROSBA_LINK_BANNER_COPY } from "@/lib/orders/zk-prosba-link-banner-copy";
import { salesTypography } from "@/lib/ui/ontime-theme";

/**
 * Sticky pasek kontekstu ZK na formularzu prośby — widoczny przy scrollu pól poniżej.
 */
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

  const tone = isSupplement
    ? {
        strip: "border-amber-200/90 bg-amber-50/95 text-amber-950",
        accent: "bg-amber-500",
        title: "text-amber-950",
        meta: "text-amber-900/85",
        detail: "text-amber-900/90",
        badge: "warning" as const,
      }
    : {
        strip: "border-violet-200/90 bg-violet-50/95 text-violet-950",
        accent: "bg-violet-500",
        title: "text-violet-950",
        meta: "text-violet-900/85",
        detail: catalogLocked ? "text-violet-900/80" : "text-amber-950/85",
        badge: "default" as const,
      };

  return (
    <div
      className={cn(
        "sticky top-0 z-20 border-b backdrop-blur-sm",
        "shadow-[0_8px_20px_-16px_rgba(76,29,149,0.35)]",
        tone.strip
      )}
      role="status"
      aria-label={ZK_PROSBA_LINK_BANNER_COPY.formTitle}
    >
      <div className="flex gap-0">
        <span className={cn("w-1 shrink-0 self-stretch", tone.accent)} aria-hidden />
        <div className="min-w-0 flex-1 px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={tone.badge} className="shrink-0 text-[10px]">
              {isSupplement
                ? ZK_PROSBA_LINK_BANNER_COPY.badgeSupplement
                : ZK_PROSBA_LINK_BANNER_COPY.badge}
            </Badge>
            <p className={cn("min-w-0 flex-1 leading-snug", salesTypography.rowTitle, tone.title)}>
              <span className="font-semibold">
                {ZK_PROSBA_LINK_BANNER_COPY.leadCreating}{" "}
              </span>
              <ZkProsbaLinkChip zkNumber={nr} href={href} inline className="text-sm" />
              {client ? (
                <span className={cn("font-medium", tone.meta)}>
                  {" "}
                  · {client}
                </span>
              ) : null}
            </p>
          </div>
          <p className={cn("mt-1 text-xs leading-relaxed", tone.detail)}>
            {isSupplement ? (
              <>
                <span className="font-semibold">Uzupełniająca prośba</span>
                {" — "}
                {supplementCount}{" "}
                {supplementCount === 1
                  ? "nowa pozycja"
                  : supplementCount < 5
                    ? "nowe pozycje"
                    : "nowych pozycji"}{" "}
                z ZK. Wcześniejsze pozycje są już w zamówieniu.
                {catalogLocked
                  ? ` ${ZK_PROSBA_LINK_BANNER_COPY.supplementLockedSuffix}`
                  : null}
              </>
            ) : catalogLocked ? (
              ZK_PROSBA_LINK_BANNER_COPY.fullLockedDetail
            ) : (
              ZK_PROSBA_LINK_BANNER_COPY.fullUnlockedDetail
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

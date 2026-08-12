import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { ZkProsbaLinkChip } from "@/components/orders/ZkProsbaLinkChip";
import { notatnikZkWatchHref } from "@/lib/orders/notatnik-zk-watch-href";
import {
  formatZkProsbaSupplementDetail,
  ZK_PROSBA_LINK_BANNER_COPY,
} from "@/lib/orders/zk-prosba-link-banner-copy";

type BannerTone = {
  shell: string;
  accent: string;
  title: string;
  meta: string;
  body: string;
  note: string;
  badge: "warning" | "purple";
  chipTone: "amber" | "violet";
};

/**
 * Sticky pasek kontekstu ZK na formularzu prośby — widoczny przy scrollu pól poniżej.
 * Hierarchia: badge + tytuł → ZK/klient → opis → opcjonalna notatka (osobny blok).
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
  caseNoteIncluded = false,
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
  /** Notatka ze sprawy ZK trafiła do uwag pozycji. */
  caseNoteIncluded?: boolean;
}) {
  const nr = zkNumber.trim();
  if (!nr) return null;

  const client = clientLabel?.trim();
  const href = notatnikZkWatchHref(zkWatchId, { salesPersonId, previewDla });
  const supplementCount = supplementLineCount ?? 0;
  const isSupplement = mode === "supplement" && supplementCount > 0;

  const tone: BannerTone = isSupplement
    ? {
        shell: "border-amber-200/90 bg-amber-50/95",
        accent: "bg-amber-500",
        title: "text-amber-950",
        meta: "text-amber-900/80",
        body: "text-amber-950/90",
        note: "border-amber-200/80 bg-white/70 text-amber-950",
        badge: "warning",
        chipTone: "amber",
      }
    : {
        shell: "border-violet-200/90 bg-violet-50/95",
        accent: "bg-violet-500",
        title: "text-violet-950",
        meta: "text-violet-900/80",
        body: "text-violet-950/90",
        note: "border-violet-200/80 bg-white/70 text-violet-950",
        badge: "purple",
        chipTone: "violet",
      };

  const title = isSupplement
    ? ZK_PROSBA_LINK_BANNER_COPY.titleSupplement
    : ZK_PROSBA_LINK_BANNER_COPY.titleFull;

  const detail = isSupplement
    ? formatZkProsbaSupplementDetail(supplementCount, catalogLocked)
    : catalogLocked
      ? ZK_PROSBA_LINK_BANNER_COPY.fullLockedDetail
      : ZK_PROSBA_LINK_BANNER_COPY.fullUnlockedDetail;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 border-b backdrop-blur-sm",
        "shadow-[0_6px_16px_-14px_rgba(15,23,42,0.35)]",
        tone.shell
      )}
      role="status"
      aria-label={ZK_PROSBA_LINK_BANNER_COPY.formTitle}
    >
      <div className="flex">
        <span
          className={cn("w-1 shrink-0 self-stretch", tone.accent)}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Badge
              variant={tone.badge}
              className="shrink-0 px-2 py-0.5 text-[11px] font-semibold leading-none tracking-wide"
            >
              {isSupplement
                ? ZK_PROSBA_LINK_BANNER_COPY.badgeSupplement
                : ZK_PROSBA_LINK_BANNER_COPY.badge}
            </Badge>
            <p
              className={cn(
                "min-w-0 text-sm font-semibold leading-snug",
                tone.title
              )}
            >
              {title}
            </p>
          </div>

          <div
            className={cn(
              "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-snug",
              tone.meta
            )}
          >
            <ZkProsbaLinkChip
              zkNumber={nr}
              href={href}
              inline
              tone={tone.chipTone}
              className="text-xs"
            />
            {client ? (
              <>
                <span className="text-current/40" aria-hidden>
                  ·
                </span>
                <span className="min-w-0 truncate font-medium text-current">
                  {client}
                </span>
              </>
            ) : null}
          </div>

          <p className={cn("text-xs leading-relaxed", tone.body)}>{detail}</p>

          {caseNoteIncluded ? (
            <div
              className={cn(
                "rounded-md border px-2.5 py-2 text-xs leading-snug",
                tone.note
              )}
            >
              <p className="font-semibold">{ZK_PROSBA_LINK_BANNER_COPY.caseNoteTitle}</p>
              <p className="mt-0.5 opacity-80">
                {ZK_PROSBA_LINK_BANNER_COPY.caseNoteHint}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

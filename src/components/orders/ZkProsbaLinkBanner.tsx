import { cn } from "@/lib/cn";
import { ZkProsbaLinkChip } from "@/components/orders/ZkProsbaLinkChip";
import { notatnikZkWatchHref } from "@/lib/orders/notatnik-zk-watch-href";
import { salesTypography } from "@/lib/ui/ontime-theme";

export function ZkProsbaLinkBanner({
  zkNumber,
  zkWatchId,
  salesPersonId,
  previewDla,
  clientLabel,
  mode = "full",
  supplementLineCount,
}: {
  zkNumber: string;
  zkWatchId?: string | null;
  salesPersonId?: string | null;
  previewDla?: string | null;
  clientLabel?: string | null;
  mode?: "full" | "supplement";
  supplementLineCount?: number;
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
        "border-b px-3 py-2 text-sm sm:px-4",
        isSupplement
          ? "border-amber-200/90 bg-amber-50/80 text-amber-950"
          : "border-slate-200/80 bg-slate-50/80 text-slate-700"
      )}
      role="status"
    >
      <p className={cn("leading-snug", salesTypography.rowMeta)}>
        <span className={isSupplement ? "text-amber-900/90" : "text-slate-600"}>
          Powiązana z
        </span>{" "}
        <ZkProsbaLinkChip
          zkNumber={nr}
          href={href}
          inline
          className="text-sm"
        />
        {client ? (
          <span className={isSupplement ? "text-amber-900/90" : "text-slate-600"}>
            {" "}
            · {client}
          </span>
        ) : null}
      </p>
      {isSupplement ? (
        <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
          <span className="font-semibold">Uzupełniająca prośba</span> — {supplementCount}{" "}
          {supplementCount === 1 ? "nowa pozycja" : supplementCount < 5 ? "nowe pozycje" : "nowych pozycji"}{" "}
          z ZK. Wcześniejsze pozycje są już w zamówieniu.
        </p>
      ) : null}
    </div>
  );
}

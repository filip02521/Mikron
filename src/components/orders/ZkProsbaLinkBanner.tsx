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
}: {
  zkNumber: string;
  zkWatchId?: string | null;
  salesPersonId?: string | null;
  previewDla?: string | null;
  clientLabel?: string | null;
}) {
  const nr = zkNumber.trim();
  if (!nr) return null;

  const client = clientLabel?.trim();
  const href = notatnikZkWatchHref(zkWatchId, { salesPersonId, previewDla });

  return (
    <div
      className={cn(
        "border-b border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm text-slate-700 sm:px-6"
      )}
      role="status"
    >
      <p className={cn("leading-snug", salesTypography.rowMeta)}>
        <span className="text-slate-600">Powiązana z</span>{" "}
        <ZkProsbaLinkChip
          zkNumber={nr}
          href={href}
          inline
          className="text-sm"
        />
        {client ? <span className="text-slate-600"> · {client}</span> : null}
      </p>
    </div>
  );
}

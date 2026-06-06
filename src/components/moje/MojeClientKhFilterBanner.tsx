"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass } from "@/lib/ui/ontime-theme";

export function MojeClientKhFilterBanner({
  clientKhId,
  clientLabel,
  zkNumber,
  matchCount,
  syncUrl = true,
}: {
  clientKhId?: number | null;
  clientLabel?: string | null;
  zkNumber?: string | null;
  matchCount?: number;
  syncUrl?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const displayName = clientLabel?.trim() || "klient z Subiekta";
  const zk = zkNumber?.trim();
  const countSuffix =
    matchCount != null
      ? matchCount === 0
        ? " — brak pasujących prośb"
        : matchCount === 1
          ? " — 1 prośba"
          : matchCount >= 2 && matchCount <= 4
            ? ` — ${matchCount} prośby`
            : ` — ${matchCount} prośb`
      : "";

  function clearFilter() {
    if (!syncUrl) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("kh");
    params.delete("klient");
    params.delete("zkWatch");
    params.delete("zk");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-2 border-b border-indigo-100",
        "bg-indigo-50/90 px-3 py-2.5 text-sm text-indigo-950 sm:px-4"
      )}
      role="status"
    >
      <p className="min-w-0 flex-1 leading-snug">
        {zk ? (
          <>
            <span className="font-medium">Prośby z ZK:</span>{" "}
            <span className="font-semibold tabular-nums text-indigo-900">{zk}</span>
            {displayName !== "klient z Subiekta" ? (
              <span className="text-indigo-800/90"> · {displayName}</span>
            ) : null}
          </>
        ) : (
          <>
            <span className="font-medium">Filtr klienta:</span>{" "}
            <span className="text-indigo-900">{displayName}</span>
          </>
        )}
        <span className="text-indigo-800/80">
          {countSuffix}
          <span className="hidden sm:inline">
            {" "}
            · w tym prośby powiązane z notatnikiem
            {clientKhId != null ? ` (kh ${clientKhId})` : ""}
          </span>
        </span>
      </p>
      {syncUrl ? (
        <button
          type="button"
          onClick={clearFilter}
          className={cn(
            "shrink-0 text-xs font-medium underline-offset-2 hover:underline",
            brandLinkSubtleClass
          )}
        >
          Pokaż wszystkich klientów
        </button>
      ) : null}
    </div>
  );
}

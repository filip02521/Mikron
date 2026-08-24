import { cn } from "@/lib/cn";
import {
  zkWatchRowAccentRailClassForKind,
  zkWatchRowRailClassForKind,
  type ZkWatchRowAccentKind,
  type ZkWatchRowRailKind,
} from "@/lib/ui/zk-watch-attention-styles";

/** Lewy rail — wyróżnienie wiersza ZK (regal lub gotowe do zamknięcia). */
export function ZkWatchRowAttentionRail({
  kind,
  className,
}: {
  kind: ZkWatchRowRailKind;
  className?: string;
}) {
  return <div className={cn(zkWatchRowRailClassForKind(kind), className)} aria-hidden />;
}

/** Cienki akcent — informacja, nowe pozycje, przypomnienie itd. */
export function ZkWatchRowAccentRail({
  kind,
  className,
}: {
  kind: ZkWatchRowAccentKind;
  className?: string;
}) {
  return (
    <div className={cn(zkWatchRowAccentRailClassForKind(kind), className)} aria-hidden />
  );
}

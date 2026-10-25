import { cn } from "@/lib/cn";
import { BrandLoader } from "@/components/ui/BrandLoader";

/**
 * Wiersz pod szkieletem, który pojawia się dopiero po 3 s ładowania (sam CSS — działa też w loading.tsx).
 * Krótkie ładowanie wygląda jak dotąd, długie nie wygląda na zawieszone. Miejsce jest zarezerwowane od początku,
 * więc nic nie skacze. Dekoracja (`aria-hidden`) — stan dla czytnika ekranu niesie kontener szkieletu.
 */
export function SlowLoadingNote({ message, className }: { message: string; className?: string }) {
  return (
    <p aria-hidden className={cn("slow-loading-note flex items-center gap-2 text-xs text-slate-500", className)}>
      <BrandLoader size="sm" tile={false} />
      {message}
    </p>
  );
}

import { BrandLoader } from "@/components/ui/BrandLoader";
import { cn } from "@/lib/cn";

/** Spinner w karcie auth — bez powielania tekstu z nagłówka strony. */
export function AuthBootLoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-8 text-center sm:py-10",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Ładowanie panelu"
    >
      <BrandLoader size="lg" />
      <span className="sr-only">Ładowanie panelu</span>
    </div>
  );
}

import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

/**
 * Sekcja w modalu ZK. Bez ikonek „?” przy tytułach: nazwa sekcji mówi sama za siebie, a to, co trzeba
 * wiedzieć w danym stanie (np. czy notatka idzie do prośby), stoi przy kontrolce, której dotyczy.
 */
export function ZkWatchModalSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <h3 className={salesTypography.blockTitle}>{title}</h3>
      {children}
    </section>
  );
}

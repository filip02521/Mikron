import { PageHeader } from "@/components/ui/PageHeader";
import type { NavIconKey } from "@/components/icons/NavIcon";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";

/** Strona administracji z powrotem do huba — nagłówek na tle, treść jako karty-rodzeństwo (DESIGN.md → Anatomia ekranu). */
export function AdminSecondaryShell({
  title,
  description,
  backHref = "/admin",
  backLabel = "Administracja",
  action,
  children,
}: {
  title: string;
  description: string;
  /** @deprecated Nagłówek strony nie ma kafla ikony; ikona jest w menu. */
  iconKey?: NavIconKey;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={adminPageShellClass}>
      <PageHeader back={{ href: backHref, label: backLabel }} title={title} description={description} actions={action} />
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}

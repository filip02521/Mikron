import Link from "next/link";
import { NavIcon } from "@/components/icons/NavIcon";
import { navIconTileIdleClass, type NavIconKey } from "@/components/icons/NavIcon";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { Card, CardHeader } from "@/components/ui/Card";
import { BackChevron } from "@/components/ui/UiGlyphs";
import { adminHubBodyClass, adminPageShellClass } from "@/lib/ui/ontime-theme";

export function AdminSecondaryShell({
  title,
  description,
  iconKey = "admin",
  backHref = "/admin",
  backLabel = "Administracja",
  action,
  children,
}: {
  title: string;
  description: string;
  iconKey?: NavIconKey;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={adminPageShellClass}>
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName={navIconTileIdleClass(iconKey)}>
              <NavIcon navKey={iconKey} size={20} />
            </SectionHeadingIcon>
          }
          title={title}
          description={description}
          action={action}
        />

        <div className="border-b border-slate-100 bg-slate-50/40 px-3 py-2.5 sm:px-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            <BackChevron className="text-slate-500" />
            {backLabel}
          </Link>
        </div>

        <div className={adminHubBodyClass}>{children}</div>
      </Card>
    </div>
  );
}

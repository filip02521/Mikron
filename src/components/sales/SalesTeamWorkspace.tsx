"use client";

import { NavIcon } from "@/components/icons/NavIcon";
import { navIconTileIdleClass } from "@/components/icons/NavIcon";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { Card, CardHeader } from "@/components/ui/Card";
import { salesCardBodyClass, salesTeamPageShellClass } from "@/lib/ui/ontime-theme";

export function SalesTeamWorkspace({
  title,
  description,
  iconKey = "team",
  action,
  children,
}: {
  title: string;
  description: string;
  iconKey?: "team" | "teamAccounts";
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={salesTeamPageShellClass}>
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
        <div className={salesCardBodyClass}>{children}</div>
      </Card>
    </div>
  );
}

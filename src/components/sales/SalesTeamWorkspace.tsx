"use client";

import { NavIcon } from "@/components/icons/NavIcon";
import { navIconTileIdleClass } from "@/components/icons/NavIcon";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { Card, CardHeader } from "@/components/ui/Card";

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
    <div className="mx-auto max-w-6xl">
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          leading={
            <SectionHeadingIcon tileClassName={navIconTileIdleClass(iconKey)}>
              <NavIcon navKey={iconKey} size={20} />
            </SectionHeadingIcon>
          }
          title={title}
          description={description}
          action={action}
        />
        <div className="min-w-0 space-y-4 p-4 sm:p-5">{children}</div>
      </Card>
    </div>
  );
}

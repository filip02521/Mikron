"use client";

import { IconHelpCircle } from "@/components/icons/StrokeIcons";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { cn } from "@/lib/cn";

export function FieldHintButton({
  label,
  title,
  children,
  align = "right",
  className,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <HelpPopover
      label={label}
      title={title}
      shortLabel=""
      align={align}
      icon={<IconHelpCircle size={15} strokeWidth={2} className="text-indigo-600" />}
      className={cn("align-middle", className)}
      buttonClassName="h-6 min-h-6 w-6 justify-center gap-0 border-transparent bg-transparent px-0 py-0 shadow-none hover:border-indigo-200 hover:bg-indigo-50/80"
    >
      {children}
    </HelpPopover>
  );
}

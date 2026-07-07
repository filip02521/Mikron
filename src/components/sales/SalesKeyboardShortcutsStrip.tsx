"use client";

import { ProsbaOptionalSection } from "@/components/orders/ProsbaOptionalSection";
import {
  KeyboardShortcutsHint,
  type KeyboardShortcutItem,
} from "@/components/ui/KeyboardShortcutsHint";
import { PROSBA_OPTIONAL_SECTION_COPY } from "@/lib/orders/prosba-optional-section-copy";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";

/** Zwijany pasek skrótów — spójny z /moje, /notatnik i formularzem prośby. */
export function SalesKeyboardShortcutsStrip({
  items,
  className,
  embedded = false,
  layout = "strip",
  description,
}: {
  items: readonly KeyboardShortcutItem[];
  className?: string;
  /** W karcie strony — inset i obramowanie jak meta-pasek listy. */
  embedded?: boolean;
  /** `toolbar` — zwarty blok w jednej linii z meta-paskiem listy. */
  layout?: "strip" | "toolbar";
  description?: string;
}) {
  const copy = PROSBA_OPTIONAL_SECTION_COPY.keyboard;
  const isToolbar = layout === "toolbar";

  const section = (
    <ProsbaOptionalSection
      kind="keyboard"
      title={copy.title}
      description={isToolbar ? undefined : description ?? copy.description}
      showOptionalLabel={false}
      summaryClassName={cn("items-center", isToolbar ? "gap-1.5 py-0 px-2" : "py-2")}
      bodyClassName={isToolbar ? "pb-2 pt-1.5" : "pb-2.5 pt-2"}
      className={cn(
        isToolbar ? "shrink-0 border-slate-200/70 bg-white/80" : embedded ? "bg-white/70" : undefined,
        className
      )}
    >
      <KeyboardShortcutsHint items={[...items]} compact />
    </ProsbaOptionalSection>
  );

  if (isToolbar) {
    return section;
  }

  return (
    <div
      className={cn(
        embedded
          ? cn(salesChromeInsetClass, "hidden border-b border-slate-100 bg-white py-2 sm:block")
          : "hidden py-2 sm:block",
        className
      )}
    >
      {section}
    </div>
  );
}

import { SIDEBAR_COLLAPSE_SCRIPT } from "@/lib/ui/sidebar-collapse-script";

/** Inline script w <head> — zwinięte menu bez mignięcia szerokiej wersji przed hydracją. */
export function SidebarCollapseScript() {
  return <script dangerouslySetInnerHTML={{ __html: SIDEBAR_COLLAPSE_SCRIPT }} />;
}

import { ensureAdminSection } from "@/lib/auth/section-layout-guards";
import { ensureMailCenterSectionAccess } from "@/lib/auth/section-layout-guards";
import { headers } from "next/headers";

export const maxDuration = 300;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname.startsWith("/admin/mail")) {
    await ensureMailCenterSectionAccess();
  } else {
    await ensureAdminSection();
  }
  return children;
}

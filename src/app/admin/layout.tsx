import { ensureAdminSection } from "@/lib/auth/section-layout-guards";

export const maxDuration = 300;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureAdminSection();
  return children;
}

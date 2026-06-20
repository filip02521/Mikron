import { ensureOperationsSection } from "@/lib/auth/section-layout-guards";

export default async function ZakupyLayout({ children }: { children: React.ReactNode }) {
  await ensureOperationsSection();
  return children;
}

import { ensureOperationsSection } from "@/lib/auth/section-layout-guards";

export default async function PodsumowanieLayout({ children }: { children: React.ReactNode }) {
  await ensureOperationsSection();
  return children;
}

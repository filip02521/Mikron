import { ensureOperationsSection } from "@/lib/auth/section-layout-guards";

export default async function WeryfikacjaLayout({ children }: { children: React.ReactNode }) {
  await ensureOperationsSection();
  return children;
}

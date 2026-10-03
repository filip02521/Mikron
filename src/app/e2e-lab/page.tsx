import { notFound } from "next/navigation";
import { E2ELabClient } from "./E2ELabClient";
import { isE2ELabEnabled } from "./lab-enabled";

/** Runtime env — CI uruchamia `next start` (production), więc nie można polegać na NODE_ENV. */
export const dynamic = "force-dynamic";

export default function E2ELabPage() {
  if (!isE2ELabEnabled()) {
    notFound();
  }

  return <E2ELabClient />;
}

import type { Metadata } from "next";
import { NotFoundScreen } from "@/components/brand/NotFoundScreen";
import { getSessionUser } from "@/lib/auth";
import { homePathForRole, isSalesAccount } from "@/lib/auth-roles";
import { pageMetadata } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadata(
  "Nie znaleziono strony",
  "Ten adres nie prowadzi do żadnego widoku w OnTime."
);

export default async function NotFound() {
  const session = await getSessionUser();

  if (session?.role) {
    const homeHref = homePathForRole(session.role, session.assignedWorkspaces);
    const homeLabel = isSalesAccount(session.role)
      ? "Wróć do moich zamówień"
      : "Wróć do panelu";

    return <NotFoundScreen homeHref={homeHref} homeLabel={homeLabel} />;
  }

  return <NotFoundScreen homeHref="/login" homeLabel="Zaloguj się" />;
}

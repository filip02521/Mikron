import type { SessionUser } from "@/lib/auth";
import { isAdmin, isSalesManager } from "@/lib/auth-roles";
import { getManagedGroupIdsForUser } from "@/lib/data/sales-group-access";

/** Uprawnienia UI sekcji Zespół (admin vs kierownik ze scope). */
export type SalesTeamUiContext = {
  isAdmin: boolean;
  isManager: boolean;
  canCreateGroups: boolean;
  /** Admin albo kierownik z co najmniej jedną grupą w sales_group_managers */
  hasTeamScope: boolean;
  /** Etykiety grup do podpowiedzi (np. „Sklep, Biuro”) */
  groupNamesLabel: string;
  /** Administrator w trybie podglądu panelu — bez mutacji w UI */
  readOnlyPreview?: boolean;
};

/** Wyłącza akcje tworzenia/edycji w sekcji Zespół podczas podglądu panelu. */
export function applyAdminPanelReadOnlyTeamUi(
  ctx: SalesTeamUiContext,
  readOnlyPreview: boolean
): SalesTeamUiContext {
  if (!readOnlyPreview) return ctx;
  return {
    ...ctx,
    readOnlyPreview: true,
    canCreateGroups: false,
  };
}

export async function resolveSalesTeamUiContext(
  user: Pick<SessionUser, "id" | "role">,
  groupNames: string[] = []
): Promise<SalesTeamUiContext> {
  const admin = isAdmin(user.role);
  const manager = isSalesManager(user.role);

  if (admin) {
    return {
      isAdmin: true,
      isManager: false,
      canCreateGroups: true,
      hasTeamScope: true,
      groupNamesLabel: groupNames.length ? groupNames.join(", ") : "Sklep, Biuro",
    };
  }

  if (!manager) {
    return {
      isAdmin: false,
      isManager: false,
      canCreateGroups: false,
      hasTeamScope: false,
      groupNamesLabel: "",
    };
  }

  const scope = await getManagedGroupIdsForUser(user);
  const hasTeamScope = scope != null && scope.length > 0;
  const labels =
    groupNames.length > 0 ? groupNames.join(", ") : hasTeamScope ? "Twoje grupy" : "";

  return {
    isAdmin: false,
    isManager: true,
    canCreateGroups: false,
    hasTeamScope,
    groupNamesLabel: labels,
  };
}

export type SalesTeamPageKey = "overview" | "handlowcy" | "grupy";

export function salesTeamPageCopy(
  ctx: SalesTeamUiContext,
  page: SalesTeamPageKey
): { title: string; description: string } {
  if (page === "overview") {
    if (ctx.isAdmin) {
      return {
        title: "Podgląd zespołu",
        description:
          "Handlowcy w grupach — podgląd prośb i składanie w ich imieniu.",
      };
    }
    if (!ctx.hasTeamScope) {
      return {
        title: "Podgląd zespołu",
        description:
          "Poproś administratora o przypisanie grup (np. Sklep, Biuro) do Twojego konta.",
      };
    }
    return {
      title: "Podgląd zespołu",
      description: `Handlowcy z grup: ${ctx.groupNamesLabel} — podgląd i prośby w ich imieniu.`,
    };
  }

  if (page === "handlowcy") {
    if (ctx.isAdmin) {
      return {
        title: "Handlowcy i konta",
        description:
          "Dodawaj handlowców, przypisuj grupy, zakładaj konta i generuj linki zaproszenia.",
      };
    }
    if (!ctx.hasTeamScope) {
      return {
        title: "Handlowcy i konta",
        description:
          "Po przypisaniu grup przez administratora dodasz tu handlowców i założysz im konta.",
      };
    }
    return {
      title: "Handlowcy i konta",
      description: `Dodawaj i edytuj handlowców w grupach: ${ctx.groupNamesLabel}. Konta, hasła startowe i zaproszenia.`,
    };
  }

  if (ctx.isAdmin) {
    return {
      title: "Grupy zespołu",
      description:
        "Twórz grupy (Sklep, Biuro itd.) i sprawdzaj liczbę handlowców. Kierowników przypisujesz w Admin → Użytkownicy.",
    };
  }
  if (!ctx.hasTeamScope) {
    return {
      title: "Grupy zespołu",
      description:
        "Nie masz przypisanych grup — poproś administratora o zaznaczenie ich przy Twoim koncie (rola kierownika).",
    };
  }
  return {
    title: "Przypisane grupy",
    description: `Możesz edytować nazwę i kolejność grup: ${ctx.groupNamesLabel}. Nowe grupy zakłada administrator.`,
  };
}

/** Opisy w bocznym menu (nav) dla kierownika. */
export function salesManagerNavTeamDescriptions(): {
  overview: string;
  handlowcy: string;
  grupy: string;
} {
  return {
    overview: "Handlowcy z Twoich grup",
    handlowcy: "Dodawanie osób, konta, przypisanie do grupy",
    grupy: "Edycja grup przypisanych przez admina",
  };
}

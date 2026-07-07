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
    if (ctx.readOnlyPreview) {
      return {
        title: "Podgląd zespołu",
        description:
          "Handlowcy w grupach — podgląd prośb i ZK. Zarządzanie w panelu administracji.",
      };
    }
    if (ctx.isAdmin) {
      return {
        title: "Podgląd zespołu",
        description:
          "Handlowcy w grupach — podgląd prośb, ZK i notatnika (składanie prośb tylko przez kierownika).",
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
    if (ctx.readOnlyPreview) {
      return {
        title: "Handlowcy",
        description: "Podgląd kart handlowców — dodawanie i edycja w panelu administracji.",
      };
    }
    if (ctx.isAdmin) {
      return {
        title: "Handlowcy",
        description:
          "Dodawaj handlowców, przypisuj grupy, zakładaj konta i generuj linki zaproszenia.",
      };
    }
    if (!ctx.hasTeamScope) {
      return {
        title: "Handlowcy",
        description:
          "Po przypisaniu grup przez administratora dodasz tu handlowców i założysz im konta.",
      };
    }
    return {
      title: "Handlowcy",
      description: `Dodawaj i edytuj handlowców w grupach: ${ctx.groupNamesLabel}. Konta, hasła startowe i zaproszenia.`,
    };
  }

  if (ctx.isAdmin) {
    if (ctx.readOnlyPreview) {
      return {
        title: "Grupy",
        description:
          "Podgląd grup handlowców — tworzenie i edycja w panelu administracji.",
      };
    }
    return {
      title: "Grupy",
      description:
        "Twórz grupy (Sklep, Biuro itd.) i sprawdzaj liczbę handlowców. Kierowników przypisujesz w Admin → Użytkownicy.",
    };
  }
  if (!ctx.hasTeamScope) {
    return {
      title: "Grupy",
      description:
        "Nie masz przypisanych grup — poproś administratora o zaznaczenie ich przy Twoim koncie (rola kierownika).",
    };
  }
  return {
    title: "Grupy",
    description: `Możesz edytować nazwę i kolejność grup: ${ctx.groupNamesLabel}. Nowe grupy zakłada administrator.`,
  };
}

/** Opisy w bocznym menu (nav) dla kierownika. */
export function salesManagerNavTeamDescriptions(): {
  overview: string;
  handlowcy: string;
  grupy: string;
  urlopy: string;
} {
  return {
    overview: "Handlowcy z Twoich grup",
    handlowcy: "Dodawanie osób, konta, przypisanie do grupy",
    grupy: "Edycja grup przypisanych przez admina",
    urlopy: "Kalendarz urlopów i wyznaczanie zastępców",
  };
}

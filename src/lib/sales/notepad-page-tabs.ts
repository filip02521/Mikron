export type NotatnikPageTab = "zk" | "notes" | "archive";

export const NOTATNIK_PAGE_TABS: NotatnikPageTab[] = ["zk", "notes", "archive"];

export const SALES_ZK_ROUTE_PATHS = ["/zk", "/notatnik"] as const;

export function parseNotatnikPageTab(value: string | null | undefined): NotatnikPageTab | null {
  if (value === "zk" || value === "notes" || value === "archive") return value;
  return null;
}

/** Czy param tab w URL jest nieprawidłowy (wymaga kanonicznego przekierowania). */
export function isInvalidNotatnikTabParam(value: string | null | undefined): boolean {
  const raw = value?.trim();
  return Boolean(raw) && parseNotatnikPageTab(raw) === null;
}

export function isSalesZkNavPath(pathname: string): boolean {
  return pathname === "/zk" || pathname === "/notatnik" || pathname.startsWith("/notatnik/");
}

export function resolveNotatnikPageTab(input: {
  tabParam?: string | null;
  hash?: string | null;
  focusWatchId?: string | null;
  watchInOpen?: boolean;
  watchInArchive?: boolean;
  /** Domyślna zakładka gdy brak jawnych wskazówek w URL. */
  defaultTab?: NotatnikPageTab;
  /** Gdy false i tab=archive w URL — przełącz na defaultTab. */
  archiveAvailable?: boolean;
}): NotatnikPageTab {
  const focus = input.focusWatchId?.trim();
  const hash = input.hash?.trim() ?? "";
  const parsedTab = parseNotatnikPageTab(input.tabParam);

  if (parsedTab === "archive" && input.archiveAvailable === false) {
    return input.defaultTab ?? "zk";
  }

  if (focus || hash.startsWith("#watch-") || hash.startsWith("watch-")) {
    if (input.watchInArchive && !input.watchInOpen) return "archive";
    return "zk";
  }

  if (hash.startsWith("#note-") || hash.startsWith("note-")) {
    return "notes";
  }

  return parseNotatnikPageTab(input.tabParam) ?? input.defaultTab ?? "zk";
}

export type NotatnikSurface = "zk" | "notes";

export function notatnikPagePathForTab(
  tab: NotatnikPageTab,
  surface: NotatnikSurface = tab === "notes" ? "notes" : "zk"
): "/zk" | "/notatnik" {
  if (tab === "notes" || (tab === "archive" && surface === "notes")) return "/notatnik";
  return "/zk";
}

export type BuildNotatnikPageHrefInput = {
  tab?: NotatnikPageTab;
  /** Na której podstronie ma być archiwum (domyślnie ZK dla tab=zk/archive, notatnik dla tab=notes). */
  surface?: NotatnikSurface;
  focusWatch?: string | null;
  salesPersonId?: string | null;
  preview?: boolean;
  hash?: string | null;
  extraParams?: Record<string, string | null | undefined>;
};

/** Buduje URL strony ZK / notatnik z zachowaniem tabów i deep linków. */
export function buildNotatnikPageHref(input: BuildNotatnikPageHrefInput = {}): string {
  const tab = input.tab ?? (input.focusWatch?.trim() ? "zk" : "zk");
  const surface = input.surface ?? (tab === "notes" ? "notes" : "zk");
  const path = notatnikPagePathForTab(tab, surface);
  const params = new URLSearchParams();

  if (input.preview && input.salesPersonId?.trim()) {
    params.set("dla", input.salesPersonId.trim());
  }

  if (input.extraParams) {
    for (const [key, value] of Object.entries(input.extraParams)) {
      const trimmed = value?.trim();
      if (trimmed) params.set(key, trimmed);
    }
  }

  const focusWatch = input.focusWatch?.trim();
  if (focusWatch) {
    params.set("focusWatch", focusWatch);
  }

  if (tab === "archive") {
    params.set("tab", "archive");
  } else if (tab === "notes" && path === "/notatnik") {
    params.delete("tab");
  } else if (tab !== "zk") {
    params.set("tab", tab);
  } else {
    params.delete("tab");
  }

  const hashRaw = input.hash?.trim() ?? "";
  const hash = hashRaw
    ? hashRaw.startsWith("#")
      ? hashRaw
      : `#${hashRaw}`
    : focusWatch
      ? `#watch-${focusWatch}`
      : "";

  const qs = params.toString();
  return qs ? `${path}?${qs}${hash}` : `${path}${hash}`;
}

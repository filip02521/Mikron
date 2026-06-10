export type NotatnikPageTab = "zk" | "notes" | "archive";

export const NOTATNIK_PAGE_TABS: NotatnikPageTab[] = ["zk", "notes", "archive"];

export const SALES_ZK_ROUTE_PATHS = ["/zk", "/notatnik"] as const;

export function parseNotatnikPageTab(value: string | null | undefined): NotatnikPageTab | null {
  if (value === "zk" || value === "notes" || value === "archive") return value;
  return null;
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
}): NotatnikPageTab {
  const focus = input.focusWatchId?.trim();
  const hash = input.hash?.trim() ?? "";

  if (focus || hash.startsWith("#watch-") || hash.startsWith("watch-")) {
    if (input.watchInArchive && !input.watchInOpen) return "archive";
    return "zk";
  }

  if (hash.startsWith("#note-") || hash.startsWith("note-")) {
    return "notes";
  }

  return parseNotatnikPageTab(input.tabParam) ?? "zk";
}

export function notatnikPagePathForTab(tab: NotatnikPageTab): "/zk" | "/notatnik" {
  return tab === "zk" ? "/zk" : "/notatnik";
}

export type BuildNotatnikPageHrefInput = {
  tab?: NotatnikPageTab;
  focusWatch?: string | null;
  salesPersonId?: string | null;
  preview?: boolean;
  hash?: string | null;
  extraParams?: Record<string, string | null | undefined>;
};

/** Buduje URL strony ZK / notatnik z zachowaniem tabów i deep linków. */
export function buildNotatnikPageHref(input: BuildNotatnikPageHrefInput = {}): string {
  const tab = input.tab ?? (input.focusWatch?.trim() ? "zk" : "zk");
  const path = notatnikPagePathForTab(tab);
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

  if (tab !== "zk" || path === "/notatnik") {
    params.set("tab", tab);
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

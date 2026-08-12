import { parseZkTeethDrafts } from "@/lib/sales/zk-watch-teeth-draft";

/**
 * Klucze szkiców do usunięcia po złożeniu prośby zębowej.
 * Gdy podano lineKeys — tylko te (supplement / jawny zakres).
 * Inaczej match po tw_Id draftu lub linii ZK.
 */
export function resolveZkTeethDraftKeysToClear(input: {
  teethDrafts: unknown;
  teethTwIds: Iterable<number>;
  lineKeys?: Iterable<string>;
  viewTwIdByKey?: ReadonlyMap<string, number | null>;
}): string[] {
  const drafts = parseZkTeethDrafts(input.teethDrafts);
  const explicitKeys = [...(input.lineKeys ?? [])]
    .map((key) => String(key).trim())
    .filter(Boolean);
  if (explicitKeys.length > 0) {
    return explicitKeys;
  }

  const twIds = new Set(
    [...input.teethTwIds].map((id) => Math.trunc(id)).filter((id) => id > 0)
  );
  const keys = new Set<string>();
  if (twIds.size === 0) return [];

  for (const draft of Object.values(drafts)) {
    if (twIds.has(draft.subiektTwId)) {
      keys.add(draft.lineKey);
      continue;
    }
    const viewTw = input.viewTwIdByKey?.get(draft.lineKey);
    if (viewTw != null && twIds.has(viewTw)) {
      keys.add(draft.lineKey);
    }
  }

  return [...keys];
}

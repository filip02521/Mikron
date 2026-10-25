import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@/lib/db/admin";
import { resolveOrderLineSubiektTwIdFromCatalog } from "./resolve-order-line-subiekt-tw-id";

/** Katalog z jednym towarem o symbolu „S” — dokładnie przypadek „Silikon…” → „Kieliszek silikonowy S”. */
function catalogWithSymbolS() {
  const calls: string[] = [];
  const builder = {
    select: () => builder,
    ilike: (col: string, value: string) => {
      calls.push(`${col}=${value}`);
      return builder;
    },
    limit: async () => ({
      data: calls.at(-1) === "symbol=S" ? [{ subiekt_tw_id: 777, symbol: "S" }] : [],
      error: null,
    }),
  };
  return { supabase: { from: () => builder } as unknown as SupabaseClient, calls };
}

describe("resolveOrderLineSubiektTwIdFromCatalog", () => {
  it("does not link a request whose symbol is just the start of its typed name", async () => {
    const { supabase, calls } = catalogWithSymbolS();
    const tw = await resolveOrderLineSubiektTwIdFromCatalog(supabase, { symbol: "S", product: "Silikon Larident" });
    expect(tw).toBeNull();
    expect(calls).toEqual([]);
  });

  it("still links a real symbol typed before the name", async () => {
    const { supabase } = catalogWithSymbolS();
    expect(await resolveOrderLineSubiektTwIdFromCatalog(supabase, { symbol: "S", product: "S kieliszek 15ml" })).toBe(777);
  });

  it("keeps a product already picked from Subiekt", async () => {
    const { supabase } = catalogWithSymbolS();
    expect(await resolveOrderLineSubiektTwIdFromCatalog(supabase, { subiektTwId: 12, symbol: "S", product: "Silikon" })).toBe(12);
  });
});

import { describe, expect, it } from "vitest";
import { scrubCapture } from "./scrub";

describe("scrubCapture", () => {
  it("usuwa query z adresów zdarzenia i właściwości osoby", () => {
    const out = scrubCapture({
      event: "$pageview",
      properties: {
        $current_url: "https://ontime.mikran.pl/moje?klient=Jan%20Kowalski",
        $referrer: "https://ontime.mikran.pl/zamowienia?q=abc",
        $pathname: "/moje",
        tytul: "bez zmian?x=1",
      },
      $set_once: { $initial_current_url: "https://ontime.mikran.pl/moje?klient=A" },
    });
    expect(out.properties.$current_url).toBe("https://ontime.mikran.pl/moje");
    expect(out.properties.$referrer).toBe("https://ontime.mikran.pl/zamowienia");
    expect(out.properties.tytul).toBe("bez zmian?x=1");
    expect(out.$set_once?.$initial_current_url).toBe("https://ontime.mikran.pl/moje");
  });

  it("usuwa query z adresu w nagraniu, nie ruszając pozostałych zdarzeń", () => {
    const out = scrubCapture({
      event: "$snapshot",
      properties: {
        $snapshot_data: [
          { type: 4, data: { href: "https://ontime.mikran.pl/moje?klient=A", width: 375 } },
          { type: 2, data: "compressed" },
          null,
        ],
      },
    });
    const items = out.properties.$snapshot_data as Array<{ data?: unknown } | null>;
    expect(items[0]).toEqual({ type: 4, data: { href: "https://ontime.mikran.pl/moje", width: 375 } });
    expect(items[1]).toEqual({ type: 2, data: "compressed" });
  });
});

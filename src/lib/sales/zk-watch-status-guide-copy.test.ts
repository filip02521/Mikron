import { describe, expect, it } from "vitest";
import { ZK_WATCH_STATUS_GUIDE_COPY } from "./zk-watch-status-guide-copy";

describe("zk-watch-status-guide-copy", () => {
  it("ma tytuł i krótki opis legendy", () => {
    expect(ZK_WATCH_STATUS_GUIDE_COPY.title).toContain("statusy");
    expect(ZK_WATCH_STATUS_GUIDE_COPY.description.length).toBeGreaterThan(10);
  });
});

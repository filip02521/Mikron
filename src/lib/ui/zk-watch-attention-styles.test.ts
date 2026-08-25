import { describe, expect, it } from "vitest";
import {
  zkWatchRowAttentionBadgeClass,
  zkWatchRowInlineBadgeClass,
} from "@/lib/ui/zk-watch-attention-styles";

describe("zkWatchRowAttentionBadgeClass", () => {
  it("wszystkie rodzaje dzielą wspólną bazę chipa", () => {
    const kinds = [
      "regal_new",
      "follow_up_due",
      "regal_waiting",
      "informacja_ready",
      "new_lines",
      "newly_added",
      "ready_to_close",
      "scope_overflow",
    ] as const;

    for (const kind of kinds) {
      const cls = zkWatchRowAttentionBadgeClass(kind);
      expect(cls).toContain("h-5");
      expect(cls).toContain("rounded-md");
      expect(cls).toContain("ring-1");
    }

    expect(zkWatchRowInlineBadgeClass).toContain("h-5");
  });

  it("wyróżnia chipy akcji / pilne mocniejszym krojem", () => {
    expect(zkWatchRowAttentionBadgeClass("ready_to_close")).toContain("font-semibold");
    expect(zkWatchRowAttentionBadgeClass("regal_new")).toContain("font-semibold");
    expect(zkWatchRowAttentionBadgeClass("follow_up_due")).toContain("font-semibold");
    expect(zkWatchRowAttentionBadgeClass("regal_waiting")).not.toContain("font-semibold");
    expect(zkWatchRowAttentionBadgeClass("scope_overflow")).not.toContain("font-semibold");
  });

  it("zachowuje kolorystykę semantyczną", () => {
    expect(zkWatchRowAttentionBadgeClass("ready_to_close")).toContain("emerald");
    expect(zkWatchRowAttentionBadgeClass("regal_waiting")).toContain("violet");
    expect(zkWatchRowAttentionBadgeClass("follow_up_due")).toContain("amber");
    expect(zkWatchRowAttentionBadgeClass("informacja_ready")).toContain("sky");
    expect(zkWatchRowAttentionBadgeClass("newly_added")).toContain("indigo");
  });
});

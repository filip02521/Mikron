import { describe, expect, it } from "vitest";
import {
  panelRowActionsFooterRevealClass,
  panelRowActionsFooterRevealContentClass,
  panelRowActionsInlineEndClass,
  panelRowActionsInlineEndContentClass,
} from "@/lib/ui/panel-row-actions-reveal";

describe("panelRowActionsInlineEnd reserveSpace", () => {
  it("does not collapse to 0fr when reserveSpace is set", () => {
    const cls = panelRowActionsInlineEndClass({ reserveSpace: true });
    expect(cls).toContain("grid-cols-[1fr]");
    expect(cls).not.toContain("grid-cols-[0fr]");
  });

  it("still uses 0fr→1fr hover expand by default", () => {
    const cls = panelRowActionsInlineEndClass({});
    expect(cls).toContain("grid-cols-[0fr]");
    expect(cls).toContain("group-hover/panelRow:grid-cols-[1fr]");
    expect(cls).toContain("group-hover/panelRow:delay-[450ms]");
    expect(cls).toContain("group-focus-within/panelRow:grid-cols-[1fr]");
  });

  it("uses hover intent timing on inline content fade", () => {
    const cls = panelRowActionsInlineEndContentClass({});
    expect(cls).toContain("group-hover/panelRow:delay-[450ms]");
    expect(cls).toContain("group-focus-within/panelRow:opacity-100");
  });

  it("uses full width content without slide when reserveSpace", () => {
    const cls = panelRowActionsInlineEndContentClass({ reserveSpace: true });
    expect(cls).toContain("w-full");
    expect(cls).not.toContain("translate-x-2");
  });
});

describe("panelRowActionsFooterReveal", () => {
  it("collapses rows on hover devices and opens on group hover/focus", () => {
    const cls = panelRowActionsFooterRevealClass({});
    expect(cls).toContain("grid-rows-[0fr]");
    expect(cls).toContain("group-hover/panelRow:grid-rows-[1fr]");
    expect(cls).toContain("group-focus-within/panelRow:grid-rows-[1fr]");
    expect(cls).toContain("group-hover/panelRow:delay-[450ms]");
    expect(cls).toContain("delay-[120ms]");
    expect(cls).toContain("group-focus-within/panelRow:delay-0");
  });

  it("stays open when forceVisible", () => {
    const cls = panelRowActionsFooterRevealClass({ forceVisible: true });
    expect(cls).toContain("[@media(hover:hover)]:grid-rows-[1fr]");
  });

  it("hides content from tab order when collapsed on hover devices", () => {
    const cls = panelRowActionsFooterRevealContentClass({});
    expect(cls).toContain("invisible");
    expect(cls).toContain("pointer-events-none");
    expect(cls).toContain("group-hover/panelRow:visible");
    expect(cls).toContain("group-focus-within/panelRow:visible");
  });
});

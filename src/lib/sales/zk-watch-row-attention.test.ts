import { describe, expect, it } from "vitest";
import {
  buildZkWatchCardMetaSummary,
  deriveZkWatchFollowUpDueBadge,
  deriveZkWatchRowAttention,
  deriveZkWatchRowChrome,
  deriveZkWatchRowSecondaryMeta,
  type ZkWatchRowAttentionInput,
} from "./zk-watch-row-attention";

function baseInput(
  overrides: Partial<ZkWatchRowAttentionInput> = {}
): ZkWatchRowAttentionInput {
  return {
    archived: false,
    hasNewWarehouseArrival: false,
    followUpDue: false,
    followUpLabel: null,
    regalWaitingCount: 0,
    hasRegalWaiting: false,
    hasInformacjaReady: false,
    hasNewZkLines: false,
    isNewlyAdded: false,
    readyToClose: false,
    hiddenOutsideScope: 0,
    ...overrides,
  };
}

describe("deriveZkWatchRowAttention", () => {
  it("archived — brak badge'a", () => {
    expect(
      deriveZkWatchRowAttention(
        baseInput({ archived: true, hasNewWarehouseArrival: true })
      )
    ).toBeNull();
  });

  it("priorytet: nowy regal przed regalem odczytanym", () => {
    expect(
      deriveZkWatchRowAttention(
        baseInput({
          hasNewWarehouseArrival: true,
          hasRegalWaiting: true,
          regalWaitingCount: 2,
        })
      )
    ).toMatchObject({ kind: "regal_new", label: "Nowy na regale" });
  });

  it("regal odczytany — czeka na odbiór", () => {
    expect(
      deriveZkWatchRowAttention(
        baseInput({ hasRegalWaiting: true, regalWaitingCount: 2 })
      )
    ).toMatchObject({ kind: "regal_waiting", label: "Czeka na odbiór (2)" });
  });

  it("informacja bez regalu", () => {
    expect(
      deriveZkWatchRowAttention(baseInput({ hasInformacjaReady: true }))
    ).toMatchObject({ kind: "informacja_ready", label: "Dostępne" });
  });

  it("gotowe do zamknięcia tylko bez regalu", () => {
    expect(
      deriveZkWatchRowAttention(
        baseInput({ readyToClose: true, hasRegalWaiting: true, regalWaitingCount: 1 })
      )
    ).toMatchObject({ kind: "regal_waiting" });

    expect(
      deriveZkWatchRowAttention(baseInput({ readyToClose: true }))
    ).toMatchObject({ kind: "ready_to_close" });
  });

  it("gotowe do zamknięcia wygrywa z przypomnieniem", () => {
    expect(
      deriveZkWatchRowAttention(
        baseInput({
          readyToClose: true,
          followUpDue: true,
          followUpLabel: "24.08",
        })
      )
    ).toMatchObject({ kind: "ready_to_close", label: "Do zamknięcia" });
  });
});

describe("deriveZkWatchRowChrome", () => {
  it("regal + readyToClose — rail regalu, bez isAction", () => {
    const chrome = deriveZkWatchRowChrome(
      baseInput({
        readyToClose: true,
        hasRegalWaiting: true,
        regalWaitingCount: 1,
      })
    );
    expect(chrome.isAction).toBe(false);
    expect(chrome.railKind).toBe("regal_waiting");
  });

  it("regal_new — rail i mocniejsza obudowa", () => {
    expect(
      deriveZkWatchRowChrome(
        baseInput({ hasNewWarehouseArrival: true, hasRegalWaiting: true, regalWaitingCount: 1 })
      ).railKind
    ).toBe("regal_new");
  });

  it("informacja bez regalu — accent informacja", () => {
    expect(
      deriveZkWatchRowChrome(baseInput({ hasInformacjaReady: true }))
    ).toMatchObject({ accentKind: "informacja" });
  });

  it("przypomnienie jako primary — accent follow_up", () => {
    expect(
      deriveZkWatchRowAttention(
        baseInput({ followUpDue: true, followUpLabel: "24.08" })
      )
    ).toMatchObject({ kind: "follow_up_due", label: "Przypomnienie · 24.08" });

    expect(
      deriveZkWatchRowChrome(
        baseInput({ followUpDue: true, followUpLabel: "24.08" })
      )
    ).toMatchObject({ accentKind: "follow_up", isUrgent: true });
  });

  it("gotowe + przypomnienie — zielony rail, bez urgent overlay", () => {
    expect(
      deriveZkWatchRowChrome(
        baseInput({
          readyToClose: true,
          followUpDue: true,
          followUpLabel: "24.08",
        })
      )
    ).toMatchObject({
      isAction: true,
      railKind: "ready_to_close",
      isUrgent: false,
    });
  });

  it("przypomnienie ustępuje regalowi", () => {
    expect(
      deriveZkWatchRowAttention(
        baseInput({
          followUpDue: true,
          followUpLabel: "24.08",
          hasRegalWaiting: true,
          regalWaitingCount: 1,
        })
      )
    ).toMatchObject({ kind: "regal_waiting" });
  });

  it("nowe pozycje — accent new_lines", () => {
    expect(
      deriveZkWatchRowChrome(baseInput({ hasNewZkLines: true }))
    ).toMatchObject({ accentKind: "new_lines" });
  });

  it("gotowe do zamknięcia bez regalu — rail zamknięcia", () => {
    expect(deriveZkWatchRowChrome(baseInput({ readyToClose: true }))).toMatchObject({
      isAction: true,
      railKind: "ready_to_close",
    });
  });

  it("przypomnienie — isUrgent niezależnie od regalu", () => {
    expect(
      deriveZkWatchRowChrome(
        baseInput({
          followUpDue: true,
          hasRegalWaiting: true,
          regalWaitingCount: 1,
        })
      ).isUrgent
    ).toBe(true);
  });
});

describe("deriveZkWatchRowSecondaryMeta", () => {
  it("przypomnienie w meta gdy primary to regal", () => {
    expect(
      deriveZkWatchRowSecondaryMeta(
        baseInput({
          followUpDue: true,
          followUpLabel: "24.08",
          hasRegalWaiting: true,
          regalWaitingCount: 1,
        })
      )
    ).toEqual(["Przypomnienie: 24.08"]);
  });

  it("brak duplikatu przypomnienia gdy primary to follow_up", () => {
    expect(
      deriveZkWatchRowSecondaryMeta(
        baseInput({
          followUpDue: true,
          followUpLabel: "24.08",
        })
      )
    ).toEqual([]);
  });

  it("brak przypomnienia w meta gdy primary to gotowe do zamknięcia", () => {
    expect(
      deriveZkWatchRowSecondaryMeta(
        baseInput({
          readyToClose: true,
          followUpDue: true,
          followUpLabel: "24.08",
        })
      )
    ).toEqual([]);
  });

  it("nowe ZK w secondary gdy primary to regal_new", () => {
    expect(
      deriveZkWatchRowSecondaryMeta(
        baseInput({
          hasNewWarehouseArrival: true,
          hasRegalWaiting: true,
          regalWaitingCount: 1,
          isNewlyAdded: true,
        })
      )
    ).toContain("Nowe ZK");
  });
});

describe("deriveZkWatchFollowUpDueBadge", () => {
  it("badge obok gotowego do zamknięcia", () => {
    const input = baseInput({
      readyToClose: true,
      followUpDue: true,
      followUpLabel: "24.08",
    });
    expect(deriveZkWatchFollowUpDueBadge(input)).toMatchObject({
      kind: "follow_up_due",
      label: "Przypomnienie · 24.08",
    });
  });

  it("brak drugiego badge gdy przypomnienie jest primary", () => {
    expect(
      deriveZkWatchFollowUpDueBadge(
        baseInput({ followUpDue: true, followUpLabel: "24.08" })
      )
    ).toBeNull();
  });
});

describe("buildZkWatchCardMetaSummary", () => {
  it("deduplikuje „2 na regale” gdy primary to regal_waiting", () => {
    const summary = buildZkWatchCardMetaSummary({
      prosbaScopeSummary: null,
      prosbaRowMeta: null,
      lineStatusSummary: "2 na regale · 1 zakończone",
      secondaryMeta: [],
      primaryAttention: deriveZkWatchRowAttention(
        baseInput({ hasRegalWaiting: true, regalWaitingCount: 2 })
      ),
    });
    expect(summary).toBe("1 zakończone");
    expect(summary).not.toMatch(/2 na regale/);
  });

  it("prosba covered + line summary", () => {
    const summary = buildZkWatchCardMetaSummary({
      prosbaScopeSummary: null,
      prosbaRowMeta: "Prośba: bez otwartej",
      lineStatusSummary: "1 zakończone",
      secondaryMeta: [],
      primaryAttention: null,
    });
    expect(summary).toBe("Prośba: bez otwartej · 1 zakończone");
  });

  it("scope unconfigured — bez prosbaRowMeta covered", () => {
    const summary = buildZkWatchCardMetaSummary({
      prosbaScopeSummary: "Wybierz pozycje do zamówienia",
      prosbaRowMeta: null,
      lineStatusSummary: "1 do zamówienia",
      secondaryMeta: [],
      primaryAttention: null,
    });
    expect(summary).toBe("Wybierz pozycje do zamówienia · 1 do zamówienia");
    expect(summary).not.toMatch(/Prośba:/);
  });
});

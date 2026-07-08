import { describe, it, expect } from "vitest";
import { newProductLine } from "@/components/orders/request-product-lines";
import {
  buildTeethRegistryIndex,
  commitDualKindTeethLines,
  findTeethSiblingLineIndex,
  partitionTeethDetailsByKind,
  resolveTeethCatalogProduct,
  supportsDualKindBuilder,
  type TeethRegistryEntry,
} from "@/lib/teeth/teeth-dual-kind";
import { createTeethGroupDraft } from "@/lib/teeth/teeth-catalog";
import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";

const PHONARES_LINE = "ivoclar_phonares_ii" as const;

const registryEntries: TeethRegistryEntry[] = [
  {
    twId: 101,
    manufacturer: "ivoclar",
    productLine: PHONARES_LINE,
    kind: "anterior",
    symbol: "PH-PRZ",
    name: "Phonares II przednie",
    plu: "1001",
  },
  {
    twId: 102,
    manufacturer: "ivoclar",
    productLine: PHONARES_LINE,
    kind: "posterior",
    symbol: "PH-BOC",
    name: "Phonares II boczne",
    plu: "1002",
  },
];

const index = buildTeethRegistryIndex(registryEntries);

function completeGroup(
  kind: "anterior" | "posterior",
  count: number,
): ReturnType<typeof createTeethGroupDraft> {
  return createTeethGroupDraft({
    color: "A2",
    mould: kind === "anterior" ? "S61" : "NU6",
    jaw: "upper",
    kind,
    count,
  });
}

function anchorLine() {
  return {
    ...newProductLine(),
    id: "anchor-1",
    product: "Phonares II przednie",
    symbol: "PH-PRZ",
    mikranCode: "1001",
    subiektTwId: 101,
    teethManufacturer: "ivoclar" as const,
    teethProductLine: PHONARES_LINE,
    teethKind: "anterior" as const,
    clientName: "Jan Kowalski",
  };
}

describe("teeth-dual-kind", () => {
  it("builds registry index and supports dual kind for phonares", () => {
    expect(supportsDualKindBuilder(index, PHONARES_LINE)).toBe(true);
    expect(resolveTeethCatalogProduct(index, PHONARES_LINE, "anterior")?.twId).toBe(101);
    expect(resolveTeethCatalogProduct(index, PHONARES_LINE, "posterior")?.twId).toBe(102);
  });

  it("supports dual for phonares catalog even with only anterior in registry", () => {
    const partialIndex = buildTeethRegistryIndex([registryEntries[0]!]);
    expect(supportsDualKindBuilder(partialIndex, PHONARES_LINE)).toBe(true);
  });

  it("enriches product line and kind from Subiekt name", () => {
    const index = buildTeethRegistryIndex([
      {
        twId: 201,
        manufacturer: null,
        productLine: null,
        kind: null,
        name: "Phonares II zęby boczne",
        symbol: "PH-BOC",
        plu: "2002",
      },
    ]);
    expect(resolveTeethCatalogProduct(index, PHONARES_LINE, "posterior")?.twId).toBe(201);
  });

  it("partitions details by kind", () => {
    const { anterior, posterior } = partitionTeethDetailsByKind([
      { position: 1, color: "A2", jaw: "upper", kind: "anterior", mould: "S61" },
      { position: 2, color: "A2", jaw: "lower", kind: "posterior", mould: "NU6" },
    ]);
    expect(anterior).toHaveLength(1);
    expect(posterior).toHaveLength(1);
  });

  it("splits 4 przody + 8 boki into two lines", () => {
    const lines = [anchorLine()];
    const result = commitDualKindTeethLines(
      lines,
      0,
      [completeGroup("anterior", 4)],
      [completeGroup("posterior", 8)],
      index,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toHaveLength(2);
    const anterior = result.lines.find((l) => l.teethKind === "anterior");
    const posterior = result.lines.find((l) => l.teethKind === "posterior");
    expect(anterior?.subiektTwId).toBe(101);
    expect(anterior?.quantity).toBe("4");
    expect(anterior?.teethDetails).toHaveLength(4);
    expect(posterior?.subiektTwId).toBe(102);
    expect(posterior?.quantity).toBe("8");
    expect(posterior?.teethDetails).toHaveLength(8);
    expect(result.summary.added).toHaveLength(1);
    expect(result.summary.added[0]?.kind).toBe("posterior");
    expect(result.summary.updated).toHaveLength(1);
    expect(result.summary.updated[0]?.kind).toBe("anterior");
  });

  it("keeps single line when only przody", () => {
    const lines = [anchorLine()];
    const result = commitDualKindTeethLines(
      lines,
      0,
      [completeGroup("anterior", 3)],
      [],
      index,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.quantity).toBe("3");
    expect(result.summary.added).toHaveLength(0);
    expect(result.summary.updated).toHaveLength(1);
  });

  it("updates existing sibling instead of duplicating", () => {
    const anterior = anchorLine();
    const posterior = {
      ...newProductLine(),
      id: "posterior-1",
      product: "Phonares II boczne",
      symbol: "PH-BOC",
      subiektTwId: 102,
      teethManufacturer: "ivoclar" as const,
      teethProductLine: PHONARES_LINE,
      teethKind: "posterior" as const,
      clientName: "Jan Kowalski",
      quantity: "2",
      teethDetails: Array.from({ length: 2 }, (_, i) => ({
        position: i + 1,
        color: "A1",
        mould: "NU6",
        jaw: "upper" as const,
        kind: "posterior" as const,
      })),
    };
    const result = commitDualKindTeethLines(
      [anterior, posterior],
      0,
      [completeGroup("anterior", 2)],
      [completeGroup("posterior", 5)],
      index,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toHaveLength(2);
    expect(result.lines.find((l) => l.id === "posterior-1")?.quantity).toBe("5");
  });

  it("removes posterior line when boki section cleared", () => {
    const anterior = anchorLine();
    const posterior = {
      ...newProductLine(),
      id: "posterior-1",
      product: "Phonares II boczne",
      subiektTwId: 102,
      teethManufacturer: "ivoclar" as const,
      teethProductLine: PHONARES_LINE,
      teethKind: "posterior" as const,
      clientName: "Jan Kowalski",
      quantity: "2",
      teethDetails: Array.from({ length: 2 }, (_, i) => ({
        position: i + 1,
        color: "A1",
        mould: "NU6",
        jaw: "upper" as const,
        kind: "posterior" as const,
      })),
    };
    const result = commitDualKindTeethLines(
      [anterior, posterior],
      0,
      [completeGroup("anterior", 2)],
      [],
      index,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toHaveLength(1);
    expect(result.summary.removed).toContain("posterior");
  });

  it("preserves line order when committing from posterior anchor", () => {
    const other = {
      ...newProductLine(),
      id: "other-1",
      product: "Inny produkt",
    };
    const anterior = anchorLine();
    const posterior = {
      ...newProductLine(),
      id: "posterior-1",
      product: "Phonares II boczne",
      symbol: "PH-BOC",
      subiektTwId: 102,
      teethManufacturer: "ivoclar" as const,
      teethProductLine: PHONARES_LINE,
      teethKind: "posterior" as const,
      clientName: "Jan Kowalski",
      quantity: "2",
      teethDetails: Array.from({ length: 2 }, (_, i) => ({
        position: i + 1,
        color: "A1",
        mould: "NU6",
        jaw: "upper" as const,
        kind: "posterior" as const,
      })),
    };
    const lines = [other, anterior, posterior];
    const result = commitDualKindTeethLines(
      lines,
      2,
      [completeGroup("anterior", 2)],
      [completeGroup("posterior", 4)],
      index,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines.map((l) => l.id)).toEqual([
      "other-1",
      "anchor-1",
      "posterior-1",
    ]);
  });

  it("does not remove unrelated anterior lines with same product line", () => {
    const anteriorA = anchorLine();
    const anteriorB = {
      ...anchorLine(),
      id: "anchor-2",
      clientName: "Anna Nowak",
    };
    const result = commitDualKindTeethLines(
      [anteriorA, anteriorB],
      0,
      [completeGroup("anterior", 3)],
      [],
      index,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toHaveLength(2);
    expect(result.lines.find((l) => l.id === "anchor-2")).toBeTruthy();
  });

  it("rejects when registry product missing", () => {
    const partialIndex = buildTeethRegistryIndex([registryEntries[0]!]);
    const result = commitDualKindTeethLines(
      [anchorLine()],
      0,
      [],
      [completeGroup("posterior", 2)],
      partialIndex,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/boczn/i);
  });

  it("rejects when line limit exceeded", () => {
    const filler = Array.from({ length: MAX_BATCH_ORDER_LINES }, (_, i) => ({
      ...newProductLine(),
      id: `filler-${i}`,
      product: `Produkt ${i}`,
    }));
    const lines = [...filler, anchorLine()];
    const result = commitDualKindTeethLines(
      lines,
      MAX_BATCH_ORDER_LINES,
      [completeGroup("anterior", 1)],
      [completeGroup("posterior", 1)],
      index,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/limit/i);
  });
});

const IVOSTAR_LINE = "ivoclar_ivostar" as const;
const GNATHOSTAR_LINE = "ivoclar_gnathostar" as const;

const ivoclarRegistryEntries: TeethRegistryEntry[] = [
  {
    twId: 301,
    manufacturer: "ivoclar",
    productLine: IVOSTAR_LINE,
    kind: "anterior",
    symbol: "IV-PRZ",
    name: "Ivostar przednie",
    plu: "3001",
  },
  {
    twId: 302,
    manufacturer: "ivoclar",
    productLine: GNATHOSTAR_LINE,
    kind: "posterior",
    symbol: "IV-BOC",
    name: "Gnathostar boczne",
    plu: "3002",
  },
];

const ivoclarIndex = buildTeethRegistryIndex(ivoclarRegistryEntries);

function ivostarAnchorLine() {
  return {
    ...newProductLine(),
    id: "ivostar-anchor",
    product: "Ivostar przednie",
    symbol: "IV-PRZ",
    mikranCode: "3001",
    subiektTwId: 301,
    teethManufacturer: "ivoclar" as const,
    teethProductLine: IVOSTAR_LINE,
    teethKind: "anterior" as const,
    clientName: "Jan Kowalski",
  };
}

function ivostarAnteriorGroup(count: number) {
  return createTeethGroupDraft({
    color: "140/1C",
    mould: "03",
    jaw: "upper",
    kind: "anterior",
    count,
  });
}

function gnathostarPosteriorGroup(count: number) {
  return createTeethGroupDraft({
    color: "140/1C",
    mould: "D80",
    jaw: "upper",
    kind: "posterior",
    count,
  });
}

describe("teeth-dual-kind ivostar/gnathostar", () => {
  it("supports dual kind across ivostar and gnathostar registry lines", () => {
    expect(supportsDualKindBuilder(ivoclarIndex, IVOSTAR_LINE)).toBe(true);
    expect(supportsDualKindBuilder(ivoclarIndex, GNATHOSTAR_LINE)).toBe(true);
    expect(resolveTeethCatalogProduct(ivoclarIndex, IVOSTAR_LINE, "posterior")?.twId).toBe(302);
    expect(resolveTeethCatalogProduct(ivoclarIndex, GNATHOSTAR_LINE, "anterior")?.twId).toBe(301);
  });

  it("splits ivostar/gnathostar into two lines with correct catalog lines", () => {
    const result = commitDualKindTeethLines(
      [ivostarAnchorLine()],
      0,
      [ivostarAnteriorGroup(2)],
      [gnathostarPosteriorGroup(4)],
      ivoclarIndex,
      true,
      "teeth-ocr/test.jpg",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.lines).toHaveLength(2);
    const anterior = result.lines.find((l) => l.teethKind === "anterior");
    const posterior = result.lines.find((l) => l.teethKind === "posterior");
    expect(anterior?.teethProductLine).toBe(IVOSTAR_LINE);
    expect(anterior?.subiektTwId).toBe(301);
    expect(anterior?.teethOcrPending).toBe(true);
    expect(anterior?.teethOcrImagePath).toBe("teeth-ocr/test.jpg");
    expect(posterior?.teethProductLine).toBe(GNATHOSTAR_LINE);
    expect(posterior?.subiektTwId).toBe(302);
    expect(posterior?.teethOcrPending).toBe(true);
    expect(posterior?.teethOcrImagePath).toBe("teeth-ocr/test.jpg");
  });

  it("finds gnathostar sibling when product lines differ", () => {
    const anterior = ivostarAnchorLine();
    const posterior = {
      ...newProductLine(),
      id: "gnathostar-line",
      product: "Gnathostar boczne",
      subiektTwId: 302,
      teethManufacturer: "ivoclar" as const,
      teethProductLine: GNATHOSTAR_LINE,
      teethKind: "posterior" as const,
      clientName: "Jan Kowalski",
      quantity: "3",
      teethDetails: Array.from({ length: 3 }, (_, i) => ({
        position: i + 1,
        color: "140/1C",
        mould: "D82",
        jaw: "upper" as const,
        kind: "posterior" as const,
      })),
    };
    expect(findTeethSiblingLineIndex([anterior, posterior], 0)).toBe(1);
    expect(findTeethSiblingLineIndex([anterior, posterior], 1)).toBe(0);
  });
});

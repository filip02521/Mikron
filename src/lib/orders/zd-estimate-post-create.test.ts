import { describe, expect, it } from "vitest";
import {
  buildMailtoHref,
  buildZdPostCreateSessionFromCreate,
  buildZdPostCreateSessionFromLink,
  buildZdPostCreateSessionFromTimeout,
  buildZdSupplierMailto,
  clearSalesTrackQtyReviewMeta,
  patchZdPostCreateTimeoutCandidates,
  postCreateLinesSnapshotToTsv,
  postCreateNeedsHistoryLink,
  postCreateOrderableTwIds,
  snapLinesFromCreatePreview,
} from "./zd-estimate-post-create";

describe("zd-estimate-post-create", () => {
  it("snapLinesFromCreatePreview", () => {
    expect(
      snapLinesFromCreatePreview([
        {
          twId: 1,
          symbol: "A",
          nazwa: "Aa",
          plu: "p",
          ilosc: 3.2,
          packagingHint: null,
        },
      ])
    ).toEqual([
      {
        twId: 1,
        symbol: "A",
        plu: "p",
        ilosc: 3,
        celAtLink: 0,
        deltaAtLink: 0,
      },
    ]);
    expect(
      snapLinesFromCreatePreview(
        [
          {
            twId: 1,
            symbol: "A",
            nazwa: "Aa",
            ilosc: 2,
            packagingHint: null,
          },
        ],
        [{ twId: 1, celAtLink: 10, deltaAtLink: -1 }]
      )[0]
    ).toMatchObject({ celAtLink: 10, deltaAtLink: -1 });
  });

  it("fromCreate: snapshot fail → linkNrPrefill", () => {
    const s = buildZdPostCreateSessionFromCreate({
      supplierId: "s1",
      supplierName: "Dostawca",
      fromDaily: true,
      dokId: 9,
      dokNrPelny: "ZD/1",
      lineCount: 1,
      snapshotOk: false,
      previewLines: [
        {
          twId: 10,
          symbol: "X",
          nazwa: "X",
          ilosc: 2,
          packagingHint: null,
        },
      ],
      createdAtMs: 1,
    });
    expect(s.kind).toBe("created");
    expect(s.snapshotOk).toBe(false);
    expect(s.linkNrPrefill).toBe("ZD/1");
    expect(s.fromDaily).toBe(true);
    expect(postCreateNeedsHistoryLink(s)).toBe(true);
    expect(postCreateOrderableTwIds(s)).toEqual([10]);
  });

  it("fromTimeout + patch candidates", () => {
    let s = buildZdPostCreateSessionFromTimeout({
      supplierId: "s1",
      supplierName: "D",
      fromDaily: false,
      previewLines: [],
      createdAtMs: 1,
    });
    expect(s.kind).toBe("timeout_recovery");
    expect(postCreateNeedsHistoryLink(s)).toBe(true);
    s = patchZdPostCreateTimeoutCandidates(s, {
      linkNrPrefill: "ZD/9",
      recentCandidateCount: 2,
    });
    expect(s.linkNrPrefill).toBe("ZD/9");
    expect(s.recentCandidateCount).toBe(2);
  });

  it("fromLink zachowuje linesSnapshot z previous", () => {
    const prev = buildZdPostCreateSessionFromCreate({
      supplierId: "s1",
      supplierName: "D",
      fromDaily: false,
      dokId: 1,
      dokNrPelny: "ZD/1",
      lineCount: 1,
      snapshotOk: false,
      previewLines: [
        {
          twId: 5,
          symbol: "P",
          nazwa: "P",
          ilosc: 1,
          packagingHint: null,
        },
      ],
      createdAtMs: 1,
    });
    const linked = buildZdPostCreateSessionFromLink({
      supplierId: "s1",
      supplierName: "D",
      fromDaily: false,
      dokId: 42,
      dokNrPelny: "ZD/1",
      lineCount: 3,
      previous: prev,
      createdAtMs: 2,
    });
    expect(linked.kind).toBe("linked");
    expect(linked.snapshotOk).toBe(true);
    expect(linked.dokId).toBe(42);
    expect(linked.linesSnapshot).toEqual(prev.linesSnapshot);
  });

  it("fromLink bez previous bierze live previewLines", () => {
    const linked = buildZdPostCreateSessionFromLink({
      supplierId: "s1",
      supplierName: "D",
      fromDaily: false,
      dokId: 7,
      dokNrPelny: "ZD/7",
      lineCount: 2,
      previewLines: [
        {
          twId: 11,
          symbol: "L",
          nazwa: "Live",
          ilosc: 4,
          packagingHint: null,
        },
      ],
      lineMeta: [{ twId: 11, celAtLink: 8, deltaAtLink: 1 }],
      createdAtMs: 3,
    });
    expect(linked.linesSnapshot).toEqual([
      {
        twId: 11,
        symbol: "L",
        plu: null,
        ilosc: 4,
        celAtLink: 8,
        deltaAtLink: 1,
      },
    ]);
  });

  it("buildMailtoHref składa edytowany mailto", () => {
    const href = buildMailtoHref({
      email: "a@b.pl",
      subject: "Temat",
      body: "Treść\nlinia2",
    });
    expect(href).toMatch(/^mailto:a@b\.pl\?/);
    expect(href).toContain(encodeURIComponent("Temat"));
  });

  it("mailto wymaga emaila", () => {
    expect(
      buildZdSupplierMailto({
        email: "",
        dokNr: "ZD/1",
        supplierName: "D",
        lineCount: 2,
        dateKey: "2026-08-13",
      })
    ).toBeNull();
    const m = buildZdSupplierMailto({
      email: "a@b.pl",
      dokNr: "ZD/1",
      supplierName: "D",
      lineCount: 2,
      dateKey: "2026-08-13",
    });
    expect(m?.href).toMatch(/^mailto:/);
    expect(m?.subject).toContain("ZD/1");
  });

  it("TSV ze snapshota", () => {
    const tsv = postCreateLinesSnapshotToTsv([
      { twId: 1, symbol: "A", plu: null, ilosc: 4, celAtLink: 0, deltaAtLink: 0 },
    ]);
    expect(tsv.split("\n")[0]).toBe("symbol\tplu\tdo_zd\ttw_Id");
    expect(tsv).toContain("A\t\t4\t1");
  });

  it("clearSalesTrackQtyReviewMeta", () => {
    const cleared = clearSalesTrackQtyReviewMeta({
      salesTrackQtyReview: true,
      salesTrackHeldExtraQty: 2,
      salesTrackAllowedExtraQty: 1,
      salesTrackReasons: ["thin_cover", "boost_held", "boost_scaled"],
    });
    expect(cleared.salesTrackQtyReview).toBe(false);
    expect(cleared.salesTrackHeldExtraQty).toBe(0);
    expect(cleared.salesTrackAllowedExtraQty).toBe(0);
    expect(cleared.salesTrackReasons).toEqual(["thin_cover"]);
  });
});

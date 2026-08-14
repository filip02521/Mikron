import { describe, expect, it } from "vitest";
import {
  buildMailtoHref,
  buildZdPostCreateMarkFreeze,
  buildZdPostCreateSessionFromCreate,
  buildZdPostCreateSessionFromLink,
  buildZdPostCreateSessionFromTimeout,
  buildZdSupplierMailto,
  clearSalesTrackQtyReviewMeta,
  excludeConsumedPendingOrders,
  patchZdPostCreateTimeoutCandidates,
  pendingGlowneOrderIds,
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
        nazwa: "Aa",
        plu: "p",
        ilosc: 3,
        packagingHint: null,
        individualExtraPieces: 0,
        extraOnly: false,
        piecesArriving: null,
        unitsPerPackage: null,
        documentUnitMode: null,
        roundupNeed: null,
        roundupArrive: null,
        bomOrPairLabel: null,
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
        nazwa: "Live",
        plu: null,
        ilosc: 4,
        packagingHint: null,
        individualExtraPieces: 0,
        extraOnly: false,
        piecesArriving: null,
        unitsPerPackage: null,
        documentUnitMode: null,
        roundupNeed: null,
        roundupArrive: null,
        bomOrPairLabel: null,
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
      {
        twId: 1,
        symbol: "A",
        nazwa: "Nazwa A",
        plu: null,
        ilosc: 4,
        packagingHint: "10 szt / 1 op.",
        individualExtraPieces: 2,
        extraOnly: false,
        piecesArriving: 40,
        unitsPerPackage: 10,
        documentUnitMode: "packages",
        roundupNeed: null,
        roundupArrive: null,
        bomOrPairLabel: null,
        celAtLink: 0,
        deltaAtLink: 0,
      },
    ]);
    expect(tsv.split("\n")[0]).toBe(
      "symbol\tplu\tnazwa\tdo_zd\tsztuki\topakowanie\tprosba_szt\ttw_Id"
    );
    expect(tsv).toContain("A\t\tNazwa A\t4\t40\t10 szt / 1 op.\t2\t1");
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

  it("snap zachowuje nazwę / opakowanie / extras / qty po bumpie", () => {
    const s = buildZdPostCreateSessionFromCreate({
      supplierId: "s1",
      supplierName: "D",
      fromDaily: false,
      dokId: 3,
      dokNrPelny: "ZD/3",
      lineCount: 1,
      snapshotOk: true,
      previewLines: [
        {
          twId: 9,
          symbol: "K",
          nazwa: "Karton",
          ilosc: 1,
          packagingHint: "40 szt / 1 op.",
          individualExtraPieces: 25,
          extraOnly: true,
          piecesArriving: 40,
          unitsPerPackage: 40,
          documentUnitMode: "packages",
          celZapasuTracked: 12,
          salesTrackDelta: -2,
          bomOrPairLabel: "para 40 szt/op.",
        },
      ],
      createdLines: [{ twId: 9, ilosc: 2 }],
      createdAtMs: 1,
    });
    expect(s.linesSnapshot[0]).toMatchObject({
      nazwa: "Karton",
      packagingHint: "40 szt / 1 op.",
      individualExtraPieces: 25,
      extraOnly: true,
      ilosc: 2,
      piecesArriving: 80,
      bomOrPairLabel: "para 40 szt/op.",
      celAtLink: 12,
      deltaAtLink: -2,
    });
  });

  it("freeze Główne+plan przechodzi timeout → link", () => {
    const freeze = buildZdPostCreateMarkFreeze({
      catalogOrderIds: ["c1"],
      includedServiceOrderIds: ["svc1", "teeth1"],
      omittedServiceCount: 1,
      catalogByTwId: new Map([
        [
          1,
          {
            extraPieces: 3,
            requests: [
              {
                orderId: "c1",
                salesPersonId: "sp",
                salesPersonName: "Anna",
                qty: 3,
                products: "X",
                symbol: "X",
                mikranCode: null,
                requestNote: null,
              },
            ],
          },
        ],
      ]),
      serviceLines: [
        {
          key: "teeth:teeth1",
          label: "Usługa zęby",
          qty: 1,
          reason: "teeth",
          requests: [
            {
              orderId: "teeth1",
              salesPersonId: "sp",
              salesPersonName: "Anna",
              qty: 1,
              products: "Ząb",
              symbol: "Z",
              mikranCode: null,
              requestNote: null,
            },
          ],
        },
        {
          key: "svc:svc1",
          label: "Usługa",
          qty: 2,
          reason: "excluded",
          requests: [
            {
              orderId: "svc1",
              salesPersonId: "sp",
              salesPersonName: "Bartek",
              qty: 2,
              products: "Y",
              symbol: "Y",
              mikranCode: null,
              requestNote: null,
            },
          ],
        },
      ],
    });
    expect(freeze.pendingGlowneServiceIds).toEqual(["svc1"]);
    expect(freeze.teethServiceCount).toBe(1);
    expect(pendingGlowneOrderIds(freeze).sort()).toEqual(["c1", "svc1"]);

    const timeout = buildZdPostCreateSessionFromTimeout({
      supplierId: "s1",
      supplierName: "D",
      fromDaily: true,
      previewLines: [
        { twId: 1, symbol: "X", nazwa: "X", ilosc: 3, packagingHint: null },
      ],
      markFreeze: freeze,
      createdAtMs: 1,
    });
    const linked = buildZdPostCreateSessionFromLink({
      supplierId: "s1",
      supplierName: "D",
      fromDaily: true,
      dokId: 11,
      dokNrPelny: "ZD/11",
      lineCount: 1,
      previous: timeout,
      createdAtMs: 2,
    });
    expect(linked.kind).toBe("linked");
    expect(linked.markFreeze.pendingGlowneCatalogIds).toEqual(["c1"]);
    expect(linked.markFreeze.pendingGlowneServiceIds).toEqual(["svc1"]);
    expect(linked.linesSnapshot[0]?.symbol).toBe("X");
  });

  it("excludeConsumedPendingOrders pomija extras z tego ZD", () => {
    const kept = excludeConsumedPendingOrders(
      [
        {
          id: "a",
          salesPersonId: "sp",
          salesPersonName: "A",
          products: "P",
          symbol: "P",
          mikranCode: null,
          subiektTwId: 1,
          qty: 1,
          requestNote: null,
        },
        {
          id: "b",
          salesPersonId: "sp",
          salesPersonName: "B",
          products: "Q",
          symbol: "Q",
          mikranCode: null,
          subiektTwId: 2,
          qty: 2,
          requestNote: null,
        },
      ],
      ["a"]
    );
    expect(kept.map((o) => o.id)).toEqual(["b"]);
  });
});

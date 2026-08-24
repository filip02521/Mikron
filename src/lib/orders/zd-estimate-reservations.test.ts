import { describe, expect, it } from "vitest";
import {
  collectZdEstimateReservedZkRows,
  formatZdEstimateZkStatusLabel,
  isZdEstimateZkReservedLine,
  mapZdEstimateZkLineToReservedRow,
  mapZdEstimateZkPodsumowanie,
  sortZdEstimateReservedZkRows,
  sumZdEstimateReservedZkQuantity,
} from "./zd-estimate-reservations";
import type { SubiektZdEstimateZkLine } from "@/lib/subiekt/types";

const reserved: SubiektZdEstimateZkLine = {
  dok_Id: 10,
  dok_NrPelny: "ZK 1/M/08/2026",
  dok_Status: 7,
  dok_StatusNazwa: "Zarezerwowany",
  dok_StatusOpis: "Zamówienie niezrealizowane z rezerwacją stanów (ZK/ZM).",
  dok_DataWyst: "2026-08-01T00:00:00",
  adr_Nazwa: "Klient A",
  ob_Ilosc: 4,
  bezRezerwacji: false,
};

const openNoRez: SubiektZdEstimateZkLine = {
  dok_Id: 11,
  dok_NrPelny: "ZK 2/M/08/2026",
  dok_Status: 6,
  dok_StatusNazwa: "BezRezerwacji",
  dok_DataWyst: "2026-08-02T00:00:00",
  adr_Nazwa: "Klient B",
  ob_Ilosc: 9,
  bezRezerwacji: true,
};

describe("zd-estimate-reservations", () => {
  it("rozpoznaje ZK zarezerwowane po statusie i fladze", () => {
    expect(isZdEstimateZkReservedLine(reserved)).toBe(true);
    expect(isZdEstimateZkReservedLine(openNoRez)).toBe(false);
    expect(isZdEstimateZkReservedLine({ dok_Status: 7, bezRezerwacji: true })).toBe(
      true
    );
  });

  it("mapuje i filtruje tylko zarezerwowane", () => {
    const rows = collectZdEstimateReservedZkRows([openNoRez, reserved]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.zkNumber).toBe("ZK 1/M/08/2026");
    expect(rows[0]?.quantity).toBe(4);
    expect(rows[0]?.clientLabel).toBe("Klient A");
    expect(rows[0]?.statusLabel).toBe("Zarezerwowany");
    expect(rows[0]?.statusDescription).toMatch(/rezerwacj/i);
  });

  it("mapuje dok_OdbiorcaId jako clientKhId", () => {
    const row = mapZdEstimateZkLineToReservedRow({
      ...reserved,
      dok_OdbiorcaId: 4242,
    });
    expect(row?.clientKhId).toBe(4242);
  });

  it("buduje podtytuł klienta ze symbolu, gdy różni się od nazwy", () => {
    const row = mapZdEstimateZkLineToReservedRow({
      ...reserved,
      adr_Nazwa: "Martin Napierała",
      kh_Symbol: "MARTIN NAPIERAŁA",
      dok_StatusOpis: "Zamówienie z rezerwacją stanów.",
    });
    expect(row?.clientSymbol).toBeNull();

    const withDiff = mapZdEstimateZkLineToReservedRow({
      ...reserved,
      adr_Nazwa: "Martin Napierała",
      kh_Symbol: "MN-01",
    });
    expect(withDiff?.clientSymbol).toBe("MN-01");
  });

  it("humanizuje nazwy statusów z API", () => {
    expect(formatZdEstimateZkStatusLabel("BezRezerwacji", 6)).toBe(
      "Bez rezerwacji"
    );
    expect(formatZdEstimateZkStatusLabel("Zarezerwowany", 7)).toBe(
      "Zarezerwowany"
    );
  });

  it("odrzuca wiersz bez dok_Id", () => {
    expect(
      mapZdEstimateZkLineToReservedRow({
        ...reserved,
        dok_Id: 0,
      })
    ).toBeNull();
  });

  it("sumuje i sortuje od najnowszych", () => {
    const older = mapZdEstimateZkLineToReservedRow({
      ...reserved,
      dok_Id: 1,
      dok_DataWyst: "2026-07-01T00:00:00",
      ob_Ilosc: 2,
    })!;
    const newer = mapZdEstimateZkLineToReservedRow({
      ...reserved,
      dok_Id: 2,
      dok_NrPelny: "ZK 9/M/08/2026",
      dok_DataWyst: "2026-08-10T00:00:00",
      ob_Ilosc: 5,
    })!;
    const sorted = sortZdEstimateReservedZkRows([older, newer]);
    expect(sorted.map((r) => r.dokId)).toEqual([2, 1]);
    expect(sumZdEstimateReservedZkQuantity(sorted)).toBe(7);
  });

  it("mapuje podsumowanie estimate/zk", () => {
    expect(
      mapZdEstimateZkPodsumowanie({
        tw_Id: 7598,
        tw_Symbol: "14061000",
        tw_Nazwa: "Piny",
        tw_StanRez: 3,
        otwarteZkZarezerwowane: 3,
        otwarteZkBezRez: 10,
      })
    ).toEqual({
      twId: 7598,
      symbol: "14061000",
      name: "Piny",
      stanRez: 3,
      otwarteZkZarezerwowane: 3,
      otwarteZkBezRez: 10,
    });
  });
});

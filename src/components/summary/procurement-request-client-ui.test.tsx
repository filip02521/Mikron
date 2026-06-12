/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProcurementRequestClientMeta, procurementGroupRequestNote } from "@/components/summary/ProcurementRequestLine";
import {
  shouldSuppressProcurementLineClient,
  shouldSuppressProcurementLineRequestNote,
} from "@/components/summary/procurement-request-client-ui";

describe("shouldSuppressProcurementLineClient", () => {
  it("suppresses per-line client when group has one shared client", () => {
    expect(shouldSuppressProcurementLineClient("ACME Sp. z o.o.")).toBe(true);
  });

  it("keeps per-line clients when group has mixed clients", () => {
    expect(shouldSuppressProcurementLineClient("3 różnych klientów")).toBe(false);
  });

  it("does not suppress when there is no client", () => {
    expect(shouldSuppressProcurementLineClient(null)).toBe(false);
  });
});

describe("shouldSuppressProcurementLineRequestNote", () => {
  it("suppresses per-line note when shared note is in group header", () => {
    expect(shouldSuppressProcurementLineRequestNote("pilne")).toBe(true);
  });

  it("keeps per-line notes when group has no shared note", () => {
    expect(shouldSuppressProcurementLineRequestNote(null)).toBe(false);
  });
});

describe("procurementGroupRequestNote", () => {
  it("hoists a single shared note for multi-line groups", () => {
    expect(
      procurementGroupRequestNote([
        { requestNote: "pilne" },
        { requestNote: "pilne" },
      ])
    ).toBe("pilne");
  });

  it("returns null when lines have different notes", () => {
    expect(
      procurementGroupRequestNote([
        { requestNote: "a" },
        { requestNote: "b" },
      ])
    ).toBeNull();
  });
});

describe("ProcurementRequestClientMeta", () => {
  it("renders single client with Klient chip", () => {
    render(<ProcurementRequestClientMeta clientLabel="Jan Kowalski" />);
    expect(screen.getByText("Klient")).toBeTruthy();
    expect(screen.getByText("Jan Kowalski")).toBeTruthy();
  });

  it("renders mixed-client summary", () => {
    render(<ProcurementRequestClientMeta clientLabel="2 różnych klientów" />);
    expect(screen.getByText("Klienci")).toBeTruthy();
    expect(screen.getByText("2 różnych klientów")).toBeTruthy();
  });
});

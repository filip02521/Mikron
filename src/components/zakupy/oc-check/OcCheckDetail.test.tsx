/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { OcCheck } from "@/lib/oc-check/types";
import { OcCheckDetail } from "./OcCheckDetail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/oc-check", () => ({ actionSetOcCheckResolved: vi.fn() }));

const base: OcCheck = {
  id: "11111111-1111-1111-1111-111111111111",
  mailbox: "filip.naskret@mikran.com",
  gmailThreadId: "1a10bd3a47bb83e6",
  supplierName: "Polirapid",
  zdNumber: "3/M/10/2026",
  ocNumber: "2027-20320",
  ocReceivedAt: "2026-10-05T11:29:28Z",
  status: "rozbieznosci",
  priority: 2,
  summary: "5 pozycji jako opakowania",
  nextStep: "Zdecyduj o pełnych opakowaniach",
  linesTotal: 22,
  linesOk: 17,
  resolvedAt: null,
  resolvedByName: null,
  resolutionNote: "",
  lines: [
    {
      position: 1,
      symbol: "MBH 11 309",
      name: "",
      qtyOrdered: 1,
      qtyConfirmed: 100,
      unitOrdered: "szt.",
      unitConfirmed: "Pcs",
      priceOrdered: null,
      priceConfirmed: null,
      currency: "",
      deliveryDate: null,
      kind: "jednostka",
      note: "PU=100",
    },
    {
      position: 2,
      symbol: "OK 1",
      name: "",
      qtyOrdered: 1,
      qtyConfirmed: 1,
      unitOrdered: "",
      unitConfirmed: "",
      priceOrdered: null,
      priceConfirmed: null,
      currency: "",
      deliveryDate: null,
      kind: "ok",
      note: "",
    },
  ],
};

describe("OcCheckDetail", () => {
  afterEach(() => cleanup());

  it("otwarta sprawa: status, pilne, ruch, różnice bez pozycji zgodnych i link do Gmaila", () => {
    render(<OcCheckDetail check={base} backHref="/zakupy/asystent?sekcja=oc" />);
    expect(screen.getByText("Polirapid · OC 2027-20320")).toBeTruthy();
    expect(screen.getByText("Rozbieżności")).toBeTruthy();
    expect(screen.getByText("Pilne")).toBeTruthy();
    expect(screen.getByText(/Zdecyduj o pełnych opakowaniach/)).toBeTruthy();
    expect(screen.getByText("Różnice w pozycjach (1)")).toBeTruthy();
    expect(screen.queryByText("OK 1")).toBeNull();
    expect(screen.getByRole("link", { name: "Wątek w Gmailu" }).getAttribute("href")).toContain(
      "thread-f:1878209102622720998"
    );
    expect(screen.getByRole("button", { name: "Wyjaśnione" })).toBeTruthy();
  });

  it("wyjaśniona sprawa: bez ruchu i pilnego, z kim i kiedy", () => {
    render(
      <OcCheckDetail backHref="/zakupy/asystent?sekcja=oc"
        check={{ ...base, resolvedAt: "2026-10-05T14:00:00Z", resolvedByName: "filip@mikran.com", resolutionNote: "bierzemy" }}
      />
    );
    expect(screen.queryByText("Pilne")).toBeNull();
    expect(screen.queryByText(/Zdecyduj/)).toBeNull();
    expect(screen.getByText(/filip@mikran\.com · bierzemy/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Przywróć do ruchu" })).toBeTruthy();
  });
});

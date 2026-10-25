/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EMPTY_SHIPMENT } from "@/lib/customs/customs-shipment";
import type { CustomsClearanceListItem } from "@/app/actions/customs-clearance";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/app/actions/customs-ai", () => ({ actionReadInvoiceFile: vi.fn() }));
vi.mock("@/app/actions/customs-clearance", () => ({
  actionCreateCustomsClearance: vi.fn(),
  actionUploadCustomsInvoice: vi.fn(),
  actionListSupplierRecentZd: vi.fn(),
}));

import { CustomsClearanceListClient } from "./CustomsClearanceListClient";

function clearance(over: Partial<CustomsClearanceListItem>): CustomsClearanceListItem {
  return {
    id: "c1",
    supplierName: "Dostawca A",
    invoiceNumber: "F/1",
    invoiceDate: "2026-10-01",
    zdNumber: null,
    status: "draft",
    createdAt: "2026-10-01T08:00:00Z",
    sentAt: null,
    lineCount: 3,
    shipment: EMPTY_SHIPMENT,
    ...over,
  };
}

const clearances = [
  clearance({ id: "c1", invoiceNumber: "F/1" }),
  clearance({ id: "c2", invoiceNumber: "F/2", status: "sent", sentAt: "2026-10-02T08:00:00Z" }),
  clearance({ id: "c3", invoiceNumber: "F/3", supplierName: "Dostawca B" }),
  clearance({ id: "c4", invoiceNumber: "F/4", status: "sent", sentAt: "2026-10-03T08:00:00Z" }),
];

afterEach(cleanup);

describe("CustomsClearanceListClient", () => {
  it("puts the create action in the page header and filters the list from one row", () => {
    render(
      <CustomsClearanceListClient suppliers={[]} clearances={clearances} aiEnabled={false} title="Odprawy celne">
        <p>panele</p>
      </CustomsClearanceListClient>
    );
    expect(screen.getByRole("heading", { level: 1, name: "Odprawy celne" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nowa odprawa" })).toBeTruthy();
    expect(screen.getByText("4 odprawy")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mail wysłany" }));
    expect(screen.getByText("2 odprawy")).toBeTruthy();
    expect(screen.queryByText(/F\/1/)).toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: "Szukaj odprawy" }), { target: { value: "F/4" } });
    expect(screen.getByText("1 odprawa")).toBeTruthy();
  });

  it("opens the form under the header and hides the header action", () => {
    render(<CustomsClearanceListClient suppliers={[]} clearances={clearances} aiEnabled={false} title="Odprawy celne" />);
    fireEvent.click(screen.getByRole("button", { name: "Nowa odprawa" }));
    expect(screen.queryByRole("button", { name: "Nowa odprawa" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Nowa odprawa" })).toBeTruthy();
  });
});

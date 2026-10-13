/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const lookup = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/product-zd-lookup", () => ({ actionLookupProductZdDelivery: lookup }));

import { BoardQuestionZdHint } from "./BoardQuestionZdHint";

const draft = { symbol: "ABC", product: "Implant", subiektTwId: 42, mikranCode: "" };

afterEach(cleanup);

describe("BoardQuestionZdHint", () => {
  it("pokazuje termin z ZD dla towaru z Subiekta", async () => {
    lookup.mockResolvedValue({
      status: "found",
      supplierName: "Dostawca",
      supplierId: "s1",
      matches: [{ dokId: 1, dokNr: "ZD/7/2026", deadline: "2026-10-20", supplierId: "s1", supplierName: "Dostawca", quantity: 2 }],
    });
    render(<BoardQuestionZdHint product={draft} />);
    expect(await screen.findByText(/ZD\/7\/2026/, {}, { timeout: 2000 })).toBeTruthy();
    expect(lookup).toHaveBeenCalledWith(expect.objectContaining({ tw_Id: 42 }));
  });

  it("nic nie robi bez towaru z Subiekta", () => {
    lookup.mockClear();
    const { container } = render(<BoardQuestionZdHint product={{ ...draft, subiektTwId: null }} />);
    expect(container.textContent).toBe("");
    expect(lookup).not.toHaveBeenCalled();
  });
});

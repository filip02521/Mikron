import { describe, expect, it, vi } from "vitest";
import { SubiektNetworkError, SubiektRequestError } from "@/lib/subiekt/errors";

const getSubiektProduct = vi.fn();
vi.mock("@/lib/subiekt/api", () => ({ getSubiektProduct: (id: number) => getSubiektProduct(id) }));

import { verifySubiektProduct } from "./product-verify";

describe("verifySubiektProduct", () => {
  it("bierze symbol i nazwę z Subiekta", async () => {
    getSubiektProduct.mockResolvedValueOnce({ tw_Id: 4900, tw_Symbol: " MIKRO ", tw_Nazwa: "Mikrosilnik" });
    await expect(verifySubiektProduct(4900)).resolves.toEqual({ twId: 4900, symbol: "MIKRO", name: "Mikrosilnik" });
  });

  it("404 albo inny tw_Id → null (towaru nie ma)", async () => {
    getSubiektProduct.mockRejectedValueOnce(new SubiektRequestError(404, "not found"));
    await expect(verifySubiektProduct(1)).resolves.toBeNull();
    getSubiektProduct.mockResolvedValueOnce({ tw_Id: 2 });
    await expect(verifySubiektProduct(1)).resolves.toBeNull();
  });

  it("brak połączenia rzuca dalej — nie udaje, że towaru nie ma", async () => {
    getSubiektProduct.mockRejectedValueOnce(new SubiektNetworkError("offline"));
    await expect(verifySubiektProduct(1)).rejects.toBeInstanceOf(SubiektNetworkError);
  });
});

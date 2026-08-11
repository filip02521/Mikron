import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  resolveSalesPersonEmail,
  resolveSalesPersonEmailById,
} from "@/lib/orders/resolve-sales-person-email";

describe("resolveSalesPersonEmailById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preferuje e-mail powiązanego konta nad kartą handlowca", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "sales_people") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "sp-stan",
                    email: "filip.naskret@mikran.com",
                    name: "STAN",
                  },
                }),
              })),
            })),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { email: "filip02521@wp.pl" },
                }),
              })),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const res = await resolveSalesPersonEmailById(supabase as never, "sp-stan");
    expect(res).toEqual({
      personId: "sp-stan",
      email: "filip02521@wp.pl",
      name: "STAN",
    });
  });

  it("używa karty gdy brak powiązanego konta", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "sales_people") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "sp-1",
                    email: "karta@firma.pl",
                    name: "Anna",
                  },
                }),
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            })),
          })),
        };
      }),
    };

    const res = await resolveSalesPersonEmailById(supabase as never, "sp-1");
    expect(res?.email).toBe("karta@firma.pl");
  });
});

describe("resolveSalesPersonEmail", () => {
  it("preferuje e-mail konta także przy joinie z zamówienia", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { email: "login@firma.pl" },
                }),
              })),
            })),
          };
        }
        throw new Error(`unexpected ${table}`);
      }),
    };

    const res = await resolveSalesPersonEmail(supabase as never, {
      sales_person_id: "sp-1",
      sales_person: { id: "sp-1", name: "Jan", email: "karta@firma.pl" },
    });
    expect(res?.email).toBe("login@firma.pl");
  });
});

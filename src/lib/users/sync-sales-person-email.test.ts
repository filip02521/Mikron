import { describe, expect, it, vi, beforeEach } from "vitest";

const { profileRow, updateUserById, profileUpdate } = vi.hoisted(() => ({
  profileRow: vi.fn(),
  updateUserById: vi.fn(),
  profileUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  assertManagerMayChangeCardEmail,
  syncLinkedSalesPersonLoginEmail,
  syncSalesPersonCardEmailFromProfile,
} from "./sync-sales-person-email";

describe("syncLinkedSalesPersonLoginEmail", () => {
  beforeEach(() => {
    profileRow.mockReset();
    updateUserById.mockReset();
    profileUpdate.mockReset();
  });

  it("aktualizuje auth i profile gdy e-mail się zmienił", async () => {
    profileRow.mockResolvedValue({
      data: { id: "user-1", email: "stary@firma.pl" },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });
    profileUpdate.mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: profileRow,
          })),
        })),
        update: vi.fn(() => ({
          eq: profileUpdate,
        })),
      })),
      auth: {
        admin: {
          updateUserById,
        },
      },
    };

    const error = await syncLinkedSalesPersonLoginEmail(
      supabase as never,
      "sp-1",
      "Nowy@Firma.pl"
    );

    expect(error).toBeNull();
    expect(updateUserById).toHaveBeenCalledWith("user-1", { email: "nowy@firma.pl" });
  });

  it("nic nie robi gdy brak powiązanego konta", async () => {
    profileRow.mockResolvedValue({ data: null, error: null });
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: profileRow,
          })),
        })),
      })),
      auth: { admin: { updateUserById } },
    };

    const error = await syncLinkedSalesPersonLoginEmail(supabase as never, "sp-1", "a@b.pl");
    expect(error).toBeNull();
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe("syncSalesPersonCardEmailFromProfile", () => {
  it("aktualizuje kartę gdy e-mail konta różni się od karty", async () => {
    const cardUpdate = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "sales_people") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { email: "stary@firma.pl" },
                  error: null,
                }),
              })),
            })),
            update: vi.fn(() => ({
              eq: cardUpdate,
            })),
          };
        }
        throw new Error(table);
      }),
    };

    const error = await syncSalesPersonCardEmailFromProfile(
      supabase as never,
      "sp-1",
      "Nowy@Firma.pl"
    );
    expect(error).toBeNull();
    expect(cardUpdate).toHaveBeenCalled();
  });
});

describe("assertManagerMayChangeCardEmail", () => {
  const supabaseWith = (data: unknown) => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data, error: null }) }),
      }),
    }),
  });

  it("pozwala, gdy karta nie ma konta albo konto to handlowiec", async () => {
    expect(await assertManagerMayChangeCardEmail(supabaseWith(null) as never, "sp", "a@b.pl")).toBeNull();
    expect(
      await assertManagerMayChangeCardEmail(
        supabaseWith({ role: "sales", email: "x@b.pl" }) as never,
        "sp",
        "a@b.pl"
      )
    ).toBeNull();
  });

  it("blokuje zmianę e-maila konta admina lub kierownika (przejęcie loginu)", async () => {
    for (const role of ["admin", "sales_manager", "zakupy"]) {
      expect(
        await assertManagerMayChangeCardEmail(
          supabaseWith({ role, email: "szef@b.pl" }) as never,
          "sp",
          "atak@b.pl"
        )
      ).toMatch(/innej roli/);
    }
  });

  it("nie blokuje zapisu karty bez zmiany e-maila", async () => {
    expect(
      await assertManagerMayChangeCardEmail(
        supabaseWith({ role: "admin", email: "szef@b.pl" }) as never,
        "sp",
        "Szef@b.pl"
      )
    ).toBeNull();
  });
});

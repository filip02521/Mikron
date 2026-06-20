import { describe, expect, it, vi, beforeEach } from "vitest";

const { profileRow, updateUserById, profileUpdate } = vi.hoisted(() => ({
  profileRow: vi.fn(),
  updateUserById: vi.fn(),
  profileUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { syncLinkedSalesPersonLoginEmail } from "./sync-sales-person-email";

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

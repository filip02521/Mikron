import { describe, expect, it, vi, beforeEach } from "vitest";

const { maybeSingleMock, fromMock } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const fromMock = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: maybeSingleMock,
      })),
      ilike: vi.fn(() => ({
        maybeSingle: maybeSingleMock,
      })),
    })),
  }));
  return { maybeSingleMock, fromMock };
});

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseConfig: () => true,
  createAdminClient: () => ({ from: fromMock }),
}));

import { resolveSalesPersonForUser } from "./sales-person";

describe("resolveSalesPersonForUser", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    fromMock.mockClear();
  });

  it("używa salesPersonId z profilu", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "sp-1", name: "Jan Kowalski" },
      error: null,
    });

    const result = await resolveSalesPersonForUser({
      id: "user-1",
      role: "sales",
      email: "jan@mikran.com",
      salesPersonId: "sp-1",
    });

    expect(result).toEqual({ id: "sp-1", name: "Jan Kowalski" });
  });

  it("nie przypisuje karty po e-mailu, gdy jest już powiązana z innym kontem", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({ data: { id: "sp-other", name: "Inny" }, error: null })
      .mockResolvedValueOnce({ data: { id: "owner-user" }, error: null });

    const result = await resolveSalesPersonForUser({
      id: "user-1",
      role: "sales",
      email: "jan@mikran.com",
      salesPersonId: null,
    });

    expect(result).toBeNull();
  });

  it("dopuszcza fallback po e-mailu, gdy karta nie jest przypisana do innego konta", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({ data: { id: "sp-email", name: "Jan" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await resolveSalesPersonForUser({
      id: "user-1",
      role: "sales",
      email: "jan@mikran.com",
      salesPersonId: null,
    });

    expect(result).toEqual({ id: "sp-email", name: "Jan" });
  });
});

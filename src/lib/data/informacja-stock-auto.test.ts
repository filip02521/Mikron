import { beforeEach, describe, expect, it, vi } from "vitest";

const { maybeSingleMock, upsertMock, hasSupabaseConfigMock } = vi.hoisted(() => ({
  maybeSingleMock: vi.fn(),
  upsertMock: vi.fn(),
  hasSupabaseConfigMock: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseConfig: () => hasSupabaseConfigMock(),
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => maybeSingleMock(),
        }),
      }),
      upsert: (...args: unknown[]) => upsertMock(...args),
    }),
  }),
}));

import {
  fetchInformacjaStockAutoEnabled,
  upsertInformacjaStockAutoEnabled,
} from "./informacja-stock-auto";

describe("informacja stock auto setting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasSupabaseConfigMock.mockReturnValue(true);
    delete process.env.INFORMACJA_STOCK_AUTO_ENABLED;
  });

  it("domyślnie włącza automatykę bez wpisu", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    await expect(fetchInformacjaStockAutoEnabled()).resolves.toBe(true);
  });

  it("czyta ustawienie z app_settings", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { value: { enabled: false } },
      error: null,
    });
    await expect(fetchInformacjaStockAutoEnabled()).resolves.toBe(false);
  });

  it("fallbackuje do env gdy supabase nie jest dostępne", async () => {
    hasSupabaseConfigMock.mockReturnValue(false);
    process.env.INFORMACJA_STOCK_AUTO_ENABLED = "false";
    await expect(fetchInformacjaStockAutoEnabled()).resolves.toBe(false);
  });

  it("upsertuje ustawienie do app_settings", async () => {
    upsertMock.mockResolvedValue({ error: null });
    await expect(upsertInformacjaStockAutoEnabled(false)).resolves.toBe(false);
    expect(upsertMock).toHaveBeenCalledWith({
      key: "informacja_stock_auto_enabled",
      value: { enabled: false },
    });
  });

  it("odrzuca nie-boolean przy upsercie", async () => {
    await expect(
      upsertInformacjaStockAutoEnabled("false" as unknown as boolean)
    ).rejects.toThrow(/boolean/i);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

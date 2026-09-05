/** Wspólny mock bazy dla testów jednostkowych. */
import { vi } from "vitest";

export function createMockDb() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const chain: Record<string, unknown> = {};
  chain.maybeSingle = maybeSingle;
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  const select = vi.fn().mockReturnValue(chain);
  return {
    from: vi.fn().mockReturnValue({
      select,
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    auth: { admin: {} },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn(),
        remove: vi.fn(),
        createSignedUrl: vi.fn(),
      }),
    },
  };
}

export const mockCreateAdminClient = vi.fn(() => createMockDb());

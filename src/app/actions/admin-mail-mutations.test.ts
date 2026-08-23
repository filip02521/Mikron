import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAIL_CENTER_MUTATIONS_DISABLED_MESSAGE } from "@/lib/auth/admin-modules";

const mockRequireMutation = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/admin-modules", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/admin-modules")>(
    "@/lib/auth/admin-modules"
  );
  return {
    ...actual,
    requireMailCenterForMutation: mockRequireMutation,
  };
});

vi.mock("@/lib/services/mail/mail-log", () => ({
  setMailJobEnabled: vi.fn(),
  upsertMailJobRecipient: vi.fn(),
  deleteMailJobRecipient: vi.fn(),
  loadAllMailJobs: vi.fn(),
  loadMailJob: vi.fn(),
  loadMailJobRecipients: vi.fn(),
  listMailSendLogs: vi.fn(),
  getLatestMailLogForJob: vi.fn(),
  getMailSendLogDetail: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("admin-mail mutations blocked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const err = new Error(MAIL_CENTER_MUTATIONS_DISABLED_MESSAGE) as Error & {
      status?: number;
    };
    err.status = 403;
    mockRequireMutation.mockRejectedValue(err);
  });

  it("actionSetMailJobEnabled throws 403", async () => {
    const { actionSetMailJobEnabled } = await import("@/app/actions/admin-mail");
    await expect(actionSetMailJobEnabled("ivoclar_weekly", false)).rejects.toMatchObject({
      message: MAIL_CENTER_MUTATIONS_DISABLED_MESSAGE,
      status: 403,
    });
  });

  it("actionSendMailJobNow throws 403", async () => {
    const { actionSendMailJobNow } = await import("@/app/actions/admin-mail");
    await expect(actionSendMailJobNow("ivoclar_weekly", false)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("actionSendMailJobTest throws 403", async () => {
    const { actionSendMailJobTest } = await import("@/app/actions/admin-mail");
    await expect(actionSendMailJobTest("ivoclar_weekly")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("actionPreviewMailJob throws 403", async () => {
    const { actionPreviewMailJob } = await import("@/app/actions/admin-mail");
    await expect(actionPreviewMailJob("ivoclar_weekly")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("actionUpsertMailRecipient throws 403", async () => {
    const { actionUpsertMailRecipient } = await import("@/app/actions/admin-mail");
    await expect(
      actionUpsertMailRecipient({
        jobId: "ivoclar_weekly",
        email: "a@b.pl",
        recipientRole: "to",
        enabled: true,
        sortOrder: 0,
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("actionDeleteMailRecipient throws 403", async () => {
    const { actionDeleteMailRecipient } = await import("@/app/actions/admin-mail");
    await expect(
      actionDeleteMailRecipient("r1", "ivoclar_weekly")
    ).rejects.toMatchObject({ status: 403 });
  });
});

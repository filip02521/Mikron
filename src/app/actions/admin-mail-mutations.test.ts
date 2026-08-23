import { describe, expect, it } from "vitest";

describe("admin-mail (read-only surface)", () => {
  it("nie eksportuje mutacji generate/send/odbiorców", async () => {
    const mod = await import("@/app/actions/admin-mail");
    expect(mod).not.toHaveProperty("actionSetMailJobEnabled");
    expect(mod).not.toHaveProperty("actionUpsertMailRecipient");
    expect(mod).not.toHaveProperty("actionDeleteMailRecipient");
    expect(mod).not.toHaveProperty("actionPreviewMailJob");
    expect(mod).not.toHaveProperty("actionSendMailJobTest");
    expect(mod).not.toHaveProperty("actionSendMailJobNow");
    expect(typeof mod.actionListMailJobs).toBe("function");
    expect(typeof mod.actionGetMailJob).toBe("function");
    expect(typeof mod.actionListMailLogs).toBe("function");
    expect(typeof mod.actionGetMailLogDetail).toBe("function");
  });
});

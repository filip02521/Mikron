import { describe, expect, it } from "vitest";
import {
  zdEstimateCreateConfirmLabel,
  zdEstimateEmptyListDescription,
  zdEstimateHostBadgeLabel,
  zdEstimateLaunchFetchHint,
  zdEstimatePageHint,
} from "./zd-estimate-ui-copy";

describe("zd-estimate-ui-copy", () => {
  it("badge LIVE vs test", () => {
    expect(zdEstimateHostBadgeLabel({ isLive: true, port: 5080 })).toBe(
      "LIVE :5080"
    );
    expect(zdEstimateHostBadgeLabel({ isLive: false, port: 5082 })).toBe(
      "Test :5082"
    );
  });

  it("page hint bez host_kind i bez etykiety LIVE (status jest w intro)", () => {
    expect(zdEstimatePageHint({ isLive: true, configured: true })).not.toMatch(
      /host_kind/
    );
    expect(zdEstimatePageHint({ isLive: true, configured: true })).not.toMatch(
      /\bLIVE\b/
    );
    expect(zdEstimatePageHint({ isLive: true, configured: true })).toMatch(
      /Do ZD/i
    );
    expect(zdEstimatePageHint({ isLive: true, configured: true })).toMatch(
      /prawdziwy dokument/i
    );
    expect(zdEstimatePageHint({ isLive: true, configured: true })).toMatch(
      /tylko na prośbę/i
    );
  });

  it("empty / launch bez „testowego” na live", () => {
    expect(zdEstimateEmptyListDescription(true)).not.toMatch(/testowego/);
    expect(zdEstimateLaunchFetchHint(true)).toMatch(/aktualnej bazy/);
    expect(zdEstimateLaunchFetchHint(false)).toMatch(/testowego/);
  });

  it("confirm live wskazuje katalogowe prośby", () => {
    const text = zdEstimateCreateConfirmLabel({
      isLive: true,
      port: 5080,
      markCount: 2,
    });
    expect(text).toMatch(/aktualnej bazie/);
    expect(text).toMatch(/katalogowe/);
  });
});

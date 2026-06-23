/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  clearNewlyAddedZkWatch,
  isZkWatchNewlyAdded,
  loadZkNewlyAddedSnapshot,
  markZkWatchNewlyAdded,
  reconcileZkNewlyAddedSnapshot,
  saveZkNewlyAddedSnapshot,
} from "./zk-watch-newly-added-snapshot";

const salesPersonId = "sp-1";

afterEach(() => {
  localStorage.clear();
});

describe("zk-watch-newly-added-snapshot", () => {
  it("marks and clears a newly added watch", () => {
    markZkWatchNewlyAdded(salesPersonId, "w-1");
    expect(loadZkNewlyAddedSnapshot(salesPersonId)).toEqual(["w-1"]);
    expect(isZkWatchNewlyAdded(loadZkNewlyAddedSnapshot(salesPersonId), "w-1")).toBe(true);

    clearNewlyAddedZkWatch(salesPersonId, "w-1");
    expect(loadZkNewlyAddedSnapshot(salesPersonId)).toEqual([]);
  });

  it("prepends new ids without duplicates", () => {
    markZkWatchNewlyAdded(salesPersonId, "w-1");
    markZkWatchNewlyAdded(salesPersonId, "w-2");
    markZkWatchNewlyAdded(salesPersonId, "w-1");
    expect(loadZkNewlyAddedSnapshot(salesPersonId)).toEqual(["w-2", "w-1"]);
  });

  it("reconciles against valid watch ids", () => {
    saveZkNewlyAddedSnapshot(salesPersonId, ["w-1", "w-2", "w-3"]);
    const reconciled = reconcileZkNewlyAddedSnapshot(["w-1", "w-2", "w-3"], new Set(["w-2"]));
    expect(reconciled).toEqual(["w-2"]);
  });
});

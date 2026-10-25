import { describe, expect, it } from "vitest";
import { matchZdForUnconfirmedProposal } from "./zd-auto-proposal-reconcile";

const doc = (dokId: number, tw: number[]) => ({ dokId, dokNr: `ZD ${dokId}/10`, qtyByTwId: new Map(tw.map((t) => [t, 1])) });

describe("matchZdForUnconfirmedProposal", () => {
  it("ZD z co najmniej 80% towarów propozycji = utworzone z niej", () => {
    expect(matchZdForUnconfirmedProposal([1, 2, 3, 4, 5], [doc(10, [1, 2, 3, 4, 9])])?.dokId).toBe(10);
  });
  it("mniejsze pokrycie — inne zamówienie, nie to", () => {
    expect(matchZdForUnconfirmedProposal([1, 2, 3, 4, 5], [doc(10, [1, 2, 3])])).toBeNull();
  });
  it("kilka ZD — największe pokrycie; remis — żadne", () => {
    expect(matchZdForUnconfirmedProposal([1, 2, 3, 4, 5], [doc(10, [1, 2, 3, 4]), doc(11, [1, 2, 3, 4, 5])])?.dokId).toBe(11);
    expect(matchZdForUnconfirmedProposal([1, 2, 3, 4, 5], [doc(10, [1, 2, 3, 4, 5]), doc(11, [1, 2, 3, 4, 5])])).toBeNull();
  });
  it("pusta propozycja nie pasuje do niczego", () => {
    expect(matchZdForUnconfirmedProposal([], [doc(10, [1])])).toBeNull();
  });
});

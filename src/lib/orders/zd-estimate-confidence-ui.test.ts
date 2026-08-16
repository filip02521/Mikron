/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  buildZdEstimateConfidenceUi,
  resolveZdEstimateDoZdHintKind,
  zdEstimateConfidencePct,
} from "@/lib/orders/zd-estimate-confidence-ui";

describe("zd-estimate-confidence-ui", () => {
  it("pct clamp 0–100", () => {
    expect(zdEstimateConfidencePct(0.624)).toBe(62);
    expect(zdEstimateConfidencePct(-1)).toBe(0);
    expect(zdEstimateConfidencePct(2)).toBe(100);
  });

  it("idle bez sygnału", () => {
    const ui = buildZdEstimateConfidenceUi({
      confidence: 0,
      qtyReview: false,
      reasons: [],
    });
    expect(ui.hasSignal).toBe(false);
    expect(ui.tone).toBe("idle");
  });

  it("ok — sygnał bez review", () => {
    const ui = buildZdEstimateConfidenceUi({
      confidence: 0.8,
      qtyReview: false,
      reasons: ["thin_cover"],
    });
    expect(ui.hasSignal).toBe(true);
    expect(ui.tone).toBe("ok");
    expect(ui.needsReview).toBe(false);
    expect(ui.pct).toBe(80);
  });

  it("review — title + aria", () => {
    const ui = buildZdEstimateConfidenceUi({
      confidence: 0.42,
      qtyReview: true,
      reasons: ["thin_cover", "boost_held"],
      canAccept: true,
    });
    expect(ui.tone).toBe("review");
    expect(ui.needsReview).toBe(true);
    expect(ui.title).toContain("Do weryfikacji");
    expect(ui.title).toContain("cienkie pokrycie");
    expect(ui.title).toContain("Kliknij, żeby zaakceptować");
    expect(ui.acceptAriaLabel).toMatch(/42%/);
  });

  it("accepted — emerald tone", () => {
    const ui = buildZdEstimateConfidenceUi({
      confidence: 0.42,
      qtyReview: true,
      reasons: ["thin_cover"],
      accepted: true,
    });
    expect(ui.tone).toBe("accepted");
    expect(ui.needsReview).toBe(false);
    expect(ui.title).toContain("Zaakceptowano");
  });

  it("hintKind — override > roundup > confidence > pieces", () => {
    expect(
      resolveZdEstimateDoZdHintKind({
        overridden: true,
        hasRoundup: true,
        showConfidenceWhisper: true,
        hasPiecesSubline: true,
      })
    ).toBe("override");
    expect(
      resolveZdEstimateDoZdHintKind({
        overridden: false,
        hasRoundup: true,
        showConfidenceWhisper: true,
        hasPiecesSubline: true,
      })
    ).toBe("roundup");
    expect(
      resolveZdEstimateDoZdHintKind({
        overridden: false,
        hasRoundup: false,
        showConfidenceWhisper: true,
        hasPiecesSubline: true,
      })
    ).toBe("confidence");
    expect(
      resolveZdEstimateDoZdHintKind({
        overridden: false,
        hasRoundup: false,
        showConfidenceWhisper: false,
        hasPiecesSubline: true,
      })
    ).toBe("pieces");
  });
});

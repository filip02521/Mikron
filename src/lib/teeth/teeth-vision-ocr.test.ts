import { describe, expect, it } from "vitest";
import {
  geminiModelCandidates,
  isGeminiQuotaExceeded,
  isRetryableGeminiError,
} from "@/lib/teeth/teeth-vision-ocr";

const QUOTA_ERROR = new Error(
  '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. limit: 0, model: gemini-2.0-flash FreeTier","status":"RESOURCE_EXHAUSTED"}}',
);

describe("teeth-vision-ocr retry helpers", () => {
  it("wykrywa błędy przejściowe Gemini", () => {
    expect(isRetryableGeminiError({ status: 503 })).toBe(true);
    expect(isRetryableGeminiError(new Error('{"status":"UNAVAILABLE","message":"high demand"}'))).toBe(
      true,
    );
    expect(isRetryableGeminiError(new Error("invalid API key"))).toBe(false);
  });

  it("nie retryuje przy wyczerpanym limicie free tier", () => {
    expect(isGeminiQuotaExceeded(QUOTA_ERROR)).toBe(true);
    expect(isRetryableGeminiError(QUOTA_ERROR)).toBe(false);
    expect(isRetryableGeminiError({ status: 429 })).toBe(true);
  });

  it("zwraca domyślną kolejność modeli", () => {
    expect(geminiModelCandidates()).toEqual([
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ]);
  });
});

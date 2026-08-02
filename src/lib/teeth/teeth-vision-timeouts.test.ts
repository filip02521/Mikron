import { describe, expect, it } from "vitest";
import {
  GEMINI_TIMEOUT_MS,
  TEETH_VISION_DETECT_CLIENT_TIMEOUT_MS,
  TEETH_VISION_DETECT_ROUTE_MAX_SEC,
  TEETH_VISION_OCR_CLIENT_TIMEOUT_MS,
  TEETH_VISION_OCR_ROUTE_MAX_SEC,
} from "./teeth-vision-timeouts";

describe("teeth vision timeout ladder", () => {
  it("klient OCR czeka dłużej niż Gemini, a Gemini mieści się w route", () => {
    expect(GEMINI_TIMEOUT_MS).toBeLessThan(TEETH_VISION_OCR_ROUTE_MAX_SEC * 1000);
    expect(TEETH_VISION_OCR_CLIENT_TIMEOUT_MS).toBeGreaterThan(GEMINI_TIMEOUT_MS);
  });

  it("klient detect ma zapas nad route", () => {
    expect(TEETH_VISION_DETECT_CLIENT_TIMEOUT_MS).toBeGreaterThan(
      TEETH_VISION_DETECT_ROUTE_MAX_SEC * 1000
    );
  });
});

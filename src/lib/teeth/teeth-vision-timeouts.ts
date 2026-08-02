import { clientFetchTimeoutMs } from "@/lib/timing";

/** Soft limit Gemini — poniżej route OCR (260s). */
export const GEMINI_TIMEOUT_MS = 240_000;
/** Route `/api/teeth-vision-ocr` maxDuration (s). */
export const TEETH_VISION_OCR_ROUTE_MAX_SEC = 260;
/** Route `/api/teeth-vision-detect` maxDuration (s). */
export const TEETH_VISION_DETECT_ROUTE_MAX_SEC = 120;
/** Client abort OCR — powyżej Gemini + zapas odpowiedzi HTTP. */
export const TEETH_VISION_OCR_CLIENT_TIMEOUT_MS = clientFetchTimeoutMs(
  GEMINI_TIMEOUT_MS,
  30_000
);
/** Client abort detect — lekki zapas nad route 120s. */
export const TEETH_VISION_DETECT_CLIENT_TIMEOUT_MS = clientFetchTimeoutMs(
  TEETH_VISION_DETECT_ROUTE_MAX_SEC * 1000,
  5_000
);

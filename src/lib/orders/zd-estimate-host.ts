/**
 * Wspólny model belki hosta Kreatora ZD (intro + okno loadingu).
 * salesEnd* opcjonalne — route loading / partial bootstrap mogą ich nie mieć.
 */
export type ZdEstimateHostStrip = {
  configured: boolean;
  isLive: boolean;
  port: number | null;
  salesEndFromFs?: boolean;
  salesEndKeyFormatted?: string | null;
};

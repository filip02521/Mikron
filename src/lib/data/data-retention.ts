/** Okres przechowywania danych historycznych i dzienników w bazie (miesiące kalendarzowe). */
export const DATA_RETENTION_MONTHS = 3;

export function dataRetentionCutoffIso(now = new Date()): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - DATA_RETENTION_MONTHS);
  return d.toISOString();
}

export function dataRetentionCutoffDateOnly(now = new Date()): string {
  return dataRetentionCutoffIso(now).slice(0, 10);
}

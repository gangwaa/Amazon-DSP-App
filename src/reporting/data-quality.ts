import { getDb } from "../db/client.js";

export interface DataQualityResult {
  profileId: string;
  dateRange: { start: string; end: string };
  missingDates: string[];
  anomalyCount: number;
  lateRecords: number;
  summary: "ok" | "warn" | "error";
}

function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export function runDataQualityCheck(
  profileId: string,
  startDate: string,
  endDate: string
): DataQualityResult {
  const db = getDb();
  const expectedDates = getDateRange(startDate, endDate);
  const rows = db
    .prepare(
      `SELECT date, spend, impressions FROM metrics
       WHERE profile_id = ? AND date >= ? AND date <= ?
       ORDER BY date`
    )
    .all(profileId, startDate, endDate) as Array<{ date: string; spend: number; impressions: number }>;

  const foundDates = new Set(rows.map((r) => r.date));
  const missingDates = expectedDates.filter((d) => !foundDates.has(d));

  let anomalyCount = 0;
  const byDate = new Map<string, { spend: number; impressions: number }>();
  for (const r of rows) {
    byDate.set(r.date, { spend: r.spend, impressions: r.impressions });
  }
  for (let i = 1; i < expectedDates.length; i++) {
    const prev = byDate.get(expectedDates[i - 1]);
    const curr = byDate.get(expectedDates[i]);
    if (prev && curr && prev.impressions > 0 && curr.impressions > 0) {
      const drop = (prev.impressions - curr.impressions) / prev.impressions;
      if (drop > 0.5) anomalyCount++;
    }
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 2);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const lateRecords = rows.filter((r) => r.date < cutoffStr && !r.impressions && !r.spend).length;

  let summary: "ok" | "warn" | "error" = "ok";
  if (missingDates.length > 3 || anomalyCount > 5 || lateRecords > 10) summary = "error";
  else if (missingDates.length > 0 || anomalyCount > 0) summary = "warn";

  return {
    profileId,
    dateRange: { start: startDate, end: endDate },
    missingDates,
    anomalyCount,
    lateRecords,
    summary,
  };
}

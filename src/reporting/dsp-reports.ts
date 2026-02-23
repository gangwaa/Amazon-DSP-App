import { adsRequest } from "../ads/client.js";
import { getDb } from "../db/client.js";

export interface ReportRequest {
  reportId?: string;
  recordType: string;
  dimensions: string[];
  metrics: string[];
  startDate: string;
  endDate: string;
}

export async function createReport(
  tokenId: string,
  profileId: string,
  opts: { startDate: string; endDate: string }
): Promise<{ reportId: string }> {
  const body = {
    recordType: "lineItems",
    dimensions: ["date", "orderId", "lineItemId"],
    metrics: ["impressions", "clicks", "spend", "reach", "frequency", "viewableImpressions"],
    startDate: opts.startDate,
    endDate: opts.endDate,
  };
  const res = await adsRequest<{ reportId: string }>({
    tokenId,
    profileId,
    method: "POST",
    path: "/reporting/dsp/reports",
    body,
  });
  return res;
}

export async function getReportStatus(
  tokenId: string,
  profileId: string,
  reportId: string
): Promise<{ status: string; url?: string }> {
  const res = await adsRequest<{ status: string; url?: string }>({
    tokenId,
    profileId,
    path: `/reporting/dsp/reports/${reportId}`,
  });
  return res;
}

export function upsertMetrics(rows: Array<{
  profile_id: string;
  date: string;
  entity_type: string;
  entity_id: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  cpm: number;
  ctr: number;
  clicks: number;
  conversions: number;
  conv_rate: number;
}>): void {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT INTO metrics (profile_id, date, entity_type, entity_id, spend, impressions, reach, frequency, cpm, ctr, clicks, conversions, conv_rate, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_id, date, entity_type, entity_id) DO UPDATE SET
       spend=excluded.spend, impressions=excluded.impressions, reach=excluded.reach,
       frequency=excluded.frequency, cpm=excluded.cpm, ctr=excluded.ctr,
       clicks=excluded.clicks, conversions=excluded.conversions, conv_rate=excluded.conv_rate`
  );
  for (const r of rows) {
    stmt.run(
      r.profile_id, r.date, r.entity_type, r.entity_id,
      r.spend, r.impressions, r.reach, r.frequency, r.cpm, r.ctr,
      r.clicks, r.conversions, r.conv_rate, now
    );
  }
}

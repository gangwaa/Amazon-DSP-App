#!/usr/bin/env node
/**
 * Scheduled job: pull DSP reports and upsert into metrics table.
 * Run daily via cron: 0 6 * * * node dist/jobs/reporting-sync.js
 */
import "dotenv/config";
import { getDb } from "../db/client.js";
import { getProfilesForToken } from "../ads/profiles-store.js";
import { createReport, getReportStatus, upsertMetrics } from "../reporting/dsp-reports.js";

async function main() {
  const db = getDb();
  const tokens = db.prepare("SELECT id, internal_client_id FROM tokens WHERE revocation_status = 'active'").all() as Array<{ id: string; internal_client_id: string }>;

  for (const { id: tokenId } of tokens) {
    const profiles = getProfilesForToken(tokenId);
    for (const p of profiles) {
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);

        const { reportId } = await createReport(tokenId, p.profileId, {
          startDate: startStr,
          endDate: endStr,
        });

        let status: { status: string; url?: string };
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          status = await getReportStatus(tokenId, p.profileId, reportId);
          if (status.status === "COMPLETED" && status.url) {
            const resp = await fetch(status.url);
            const text = await resp.text();
            const lines = text.trim().split("\n").filter(Boolean);
            const header = lines[0].split("\t");
            const rows: Array<Record<string, string | number>> = [];
            for (let j = 1; j < lines.length; j++) {
              const vals = lines[j].split("\t");
              const row: Record<string, string | number> = {};
              header.forEach((h, k) => { row[h] = vals[k] ?? ""; });
              rows.push(row);
            }
            const normalized = rows.map((r) => ({
              profile_id: p.profileId,
              date: String(r.date ?? r.Date ?? ""),
              entity_type: "lineItem",
              entity_id: String(r.lineItemId ?? r.line_item_id ?? r.id ?? ""),
              spend: parseFloat(String(r.spend ?? r.Spend ?? 0)) || 0,
              impressions: parseInt(String(r.impressions ?? r.Impressions ?? 0), 10) || 0,
              reach: parseInt(String(r.reach ?? r.Reach ?? 0), 10) || 0,
              frequency: parseFloat(String(r.frequency ?? r.Frequency ?? 0)) || 0,
              cpm: parseFloat(String(r.cpm ?? r.CPM ?? 0)) || 0,
              ctr: parseFloat(String(r.ctr ?? r.CTR ?? 0)) || 0,
              clicks: parseInt(String(r.clicks ?? r.Clicks ?? 0), 10) || 0,
              conversions: parseInt(String(r.conversions ?? r.Conversions ?? 0), 10) || 0,
              conv_rate: parseFloat(String(r.convRate ?? r.conv_rate ?? 0)) || 0,
            }));
            upsertMetrics(normalized);
            console.log(`Synced ${normalized.length} rows for profile ${p.profileId}`);
            break;
          }
          if (status.status === "FAILED") {
            console.error(`Report ${reportId} failed for profile ${p.profileId}`);
            break;
          }
        }
      } catch (e) {
        console.error(`Reporting sync error for profile ${p.profileId}:`, e);
      }
    }
  }
}

main().catch(console.error);

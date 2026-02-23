#!/usr/bin/env node
/**
 * Scheduled job: fetch DSP guidance recommendations and store for approval.
 * Run periodically (every 6h): 0 0,6,12,18 * * * node dist/jobs/guidance-sync.js
 */
import "dotenv/config";
import { getDb } from "../db/client.js";
import { getProfilesForToken } from "../ads/profiles-store.js";
import {
  listGuidanceAdvertisers,
  listGuidanceOrders,
  listGuidanceLineItems,
} from "../optimization/guidance.js";

async function main() {
  const db = getDb();
  const tokens = db.prepare("SELECT id FROM tokens WHERE revocation_status = 'active'").all() as Array<{ id: string }>;

  for (const { id: tokenId } of tokens) {
    const profiles = getProfilesForToken(tokenId);
    for (const p of profiles) {
      try {
        const [adv, ord, li] = await Promise.all([
          listGuidanceAdvertisers(tokenId, p.profileId),
          listGuidanceOrders(tokenId, p.profileId),
          listGuidanceLineItems(tokenId, p.profileId),
        ]);
        const all = [...adv, ...ord, ...li];
        const now = Date.now();
        const stmt = db.prepare(
          `INSERT OR REPLACE INTO guidance (profile_id, action_id, entity_type, entity_id, entity_name, recommendation_type, payload, score, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
        );
        for (const g of all) {
          stmt.run(
            p.profileId,
            g.actionId,
            g.entityType ?? "unknown",
            g.entityId,
            g.entityName ?? null,
            g.recommendationType ?? "unknown",
            g.payload ? JSON.stringify(g.payload) : null,
            g.score ?? null,
            now,
            now
          );
        }
        console.log(`Synced ${all.length} guidance items for profile ${p.profileId}`);
      } catch (e) {
        console.error(`Guidance sync error for profile ${p.profileId}:`, e);
      }
    }
  }
}

main().catch(console.error);

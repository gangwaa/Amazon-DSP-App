import { listManagerAccounts, extractDspAdvertiserRoots } from "./manager-accounts.js";
import { addEntity, upsertEntityAdvertisers } from "../db/entities-store.js";

export interface SyncResult {
  entityCount: number;
  advertisersFetched: number;
  failures: string[];
}

/**
 * Sync DSP advertisers from Manager Accounts API.
 * Uses linkedAccounts with dspAdvertiserId as source of truth.
 * Persists entity->advertiser mappings for dashboard use.
 */
export async function syncAdvertisersForToken(tokenId: string): Promise<SyncResult> {
  const failures: string[] = [];
  try {
    const managerAccounts = await listManagerAccounts(tokenId);
    const roots = extractDspAdvertiserRoots(managerAccounts);

    const entityIds = [...new Set(roots.map((r) => r.entityAccountId))];
    for (const entityId of entityIds) {
      addEntity(tokenId, entityId);
    }

    const advertisersByEntity = new Map<string, Array<{ advertiserId: string; name: string }>>();
    for (const r of roots) {
      const list = advertisersByEntity.get(r.entityAccountId) ?? [];
      list.push({ advertiserId: r.advertiserId, name: r.advertiserName });
      advertisersByEntity.set(r.entityAccountId, list);
    }

    for (const [entityId, advertisers] of advertisersByEntity) {
      upsertEntityAdvertisers(entityId, advertisers);
    }

    return {
      entityCount: entityIds.length,
      advertisersFetched: roots.length,
      failures: [],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(msg);
    if (failures.length > 0) {
      console.warn(`[advertiser-sync] token=${tokenId} failed:`, failures);
    }
    return {
      entityCount: 0,
      advertisersFetched: 0,
      failures,
    };
  }
}

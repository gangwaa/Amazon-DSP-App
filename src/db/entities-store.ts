import { getDb } from "./client.js";

export function addEntity(tokenId: string, entityId: string, displayName?: string): void {
  const db = getDb();
  const id = `${tokenId}-${entityId}`;
  const now = Date.now();
  db.prepare(
    `INSERT OR REPLACE INTO entities (id, token_id, entity_id, display_name, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, tokenId, entityId, displayName ?? entityId, now);
}

export function getEntitiesForToken(tokenId: string): Array<{ entityId: string; displayName: string | null }> {
  const rows = getDb()
    .prepare(`SELECT entity_id AS entityId, display_name AS displayName FROM entities WHERE token_id = ? ORDER BY entity_id`)
    .all(tokenId) as Array<{ entityId: string; displayName: string | null }>;
  return rows;
}

export function upsertEntityAdvertisers(
  entityId: string,
  advertisers: Array<{ advertiserId: string; name?: string }>
): void {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT INTO entity_advertisers (entity_id, advertiser_id, advertiser_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(entity_id, advertiser_id) DO UPDATE SET
       advertiser_name = excluded.advertiser_name,
       updated_at = excluded.updated_at`
  );
  for (const a of advertisers) {
    stmt.run(entityId, a.advertiserId, a.name ?? null, now, now);
  }
}

export function getAdvertisersForEntity(entityId: string): Array<{ advertiserId: string; advertiserName: string | null }> {
  const rows = getDb()
    .prepare(
      `SELECT advertiser_id AS advertiserId, advertiser_name AS advertiserName
       FROM entity_advertisers WHERE entity_id = ? ORDER BY advertiser_id`
    )
    .all(entityId) as Array<{ advertiserId: string; advertiserName: string | null }>;
  return rows;
}

export function addEntityAdvertiser(entityId: string, advertiserId: string, name?: string): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO entity_advertisers (entity_id, advertiser_id, advertiser_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(entity_id, advertiser_id) DO UPDATE SET advertiser_name = excluded.advertiser_name, updated_at = excluded.updated_at`
  ).run(entityId, advertiserId, name ?? null, now, now);
}

/** Resolve entity scope for an advertiser (required for DSP hierarchy API). */
export function getEntityForAdvertiser(
  tokenId: string,
  advertiserId: string
): string | null {
  const row = getDb()
    .prepare(
      `SELECT e.entity_id AS entityId
       FROM entities e
       JOIN entity_advertisers ea ON ea.entity_id = e.entity_id
       WHERE ea.advertiser_id = ? AND e.token_id = ?
       LIMIT 1`
    )
    .get(advertiserId, tokenId) as { entityId: string } | undefined;
  return row?.entityId ?? null;
}

/** All advertisers across entities for a token (deduplicated by advertiser_id). */
export function getAdvertisersForToken(
  tokenId: string
): Array<{ profileId: string; accountId: string; accountInfo: { id: string; name?: string; type?: string } }> {
  const rows = getDb()
    .prepare(
      `SELECT ea.advertiser_id AS profileId, ea.advertiser_name AS advertiserName
       FROM entity_advertisers ea
       JOIN entities e ON e.entity_id = ea.entity_id
       WHERE e.token_id = ?
       GROUP BY ea.advertiser_id
       ORDER BY ea.advertiser_id`
    )
    .all(tokenId) as Array<{ profileId: string; advertiserName: string | null }>;
  return rows.map((r) => ({
    profileId: r.profileId,
    accountId: r.profileId,
    accountInfo: {
      id: r.profileId,
      name: r.advertiserName ?? undefined,
      type: undefined,
    },
  }));
}

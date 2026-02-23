import { getDb } from "../db/client.js";
import type { Profile } from "./profiles.js";

export async function storeProfiles(tokenId: string, profiles: Profile[]): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO profiles (id, token_id, profile_id, account_id, account_name, account_type, country_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const p of profiles) {
    const id = `${tokenId}-${p.profileId}`;
    const accountId = p.accountId ?? p.accountInfo?.id ?? p.profileId;
    stmt.run(
      id,
      tokenId,
      p.profileId,
      accountId,
      p.accountInfo?.name ?? null,
      p.accountInfo?.type ?? null,
      p.countryCode ?? null,
      now,
      now
    );
  }
}

export function getProfilesForToken(tokenId: string): Profile[] {
  const rows = getDb()
    .prepare(
      `SELECT profile_id AS profileId, account_id AS accountId, account_name, account_type, country_code AS countryCode
       FROM profiles WHERE token_id = ? ORDER BY profile_id`
    )
    .all(tokenId) as Array<{
      profileId: string;
      accountId: string;
      account_name: string | null;
      account_type: string | null;
      countryCode: string | null;
    }>;
  return rows.map((r) => ({
    profileId: r.profileId,
    accountId: r.accountId,
    accountInfo: {
      id: r.accountId,
      name: r.account_name ?? undefined,
      type: r.account_type ?? undefined,
    },
    countryCode: r.countryCode ?? undefined,
  }));
}

export function addManualProfile(
  tokenId: string,
  advertiserId: string,
  name?: string
): void {
  const db = getDb();
  const id = `${tokenId}-${advertiserId}`;
  const now = Date.now();
  db.prepare(
    `INSERT OR REPLACE INTO profiles (id, token_id, profile_id, account_id, account_name, account_type, country_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'dsp_manual', NULL, ?, ?)`
  ).run(id, tokenId, advertiserId, advertiserId, name ?? `DSP Advertiser ${advertiserId}`, now, now);
}

import { v4 as uuid } from "uuid";
import { getDb } from "../db/client.js";
import { encryptToken, decryptToken } from "../crypto/token-vault.js";
import { refreshAccessToken } from "./lwa.js";

export interface TokenRow {
  id: string;
  internal_client_id: string;
  refresh_token_encrypted: string;
  issued_at: number;
  expires_in: number | null;
  last_refresh_at: number | null;
  revocation_status: string;
  created_at: number;
  updated_at: number;
}

export function saveTokens(params: {
  internalClientId: string;
  refreshToken: string;
  expiresIn: number;
}): string {
  const id = uuid();
  const now = Date.now();
  const enc = encryptToken(params.refreshToken);
  getDb()
    .prepare(
      `INSERT INTO tokens (id, internal_client_id, refresh_token_encrypted, issued_at, expires_in, last_refresh_at, revocation_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    )
    .run(id, params.internalClientId, enc, now, params.expiresIn, null, now, now);
  return id;
}

export function getTokenRow(tokenId: string): TokenRow | null {
  const row = getDb()
    .prepare("SELECT * FROM tokens WHERE id = ? AND revocation_status = 'active'")
    .get(tokenId) as TokenRow | undefined;
  return row ?? null;
}

export function getLatestActiveTokenId(internalClientId = "default"): string | null {
  const row = getDb()
    .prepare(
      `SELECT id
       FROM tokens
       WHERE internal_client_id = ? AND revocation_status = 'active'
       ORDER BY updated_at DESC
       LIMIT 1`
    )
    .get(internalClientId) as { id: string } | undefined;
  return row?.id ?? null;
}

export function getRefreshToken(tokenId: string): string | null {
  const row = getTokenRow(tokenId);
  if (!row) return null;
  try {
    return decryptToken(row.refresh_token_encrypted);
  } catch {
    return null;
  }
}

export async function getValidAccessToken(tokenId: string): Promise<string | null> {
  const row = getTokenRow(tokenId);
  if (!row) return null;
  const refresh = getRefreshToken(tokenId);
  if (!refresh) return null;
  const tokens = await refreshAccessToken(refresh);
  const now = Date.now();
  getDb()
    .prepare("UPDATE tokens SET last_refresh_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, tokenId);
  return tokens.access_token;
}

export function revokeToken(tokenId: string): void {
  const now = Date.now();
  getDb()
    .prepare("UPDATE tokens SET revocation_status = 'revoked', updated_at = ? WHERE id = ?")
    .run(now, tokenId);
}

import { config, DSP_API_BASE } from "../config.js";
import { getValidAccessToken } from "../auth/token-store.js";

export interface LinkedAccount {
  accountId: string;
  accountName: string;
  accountType: string;
  dspAdvertiserId?: string;
  marketplaceId?: string;
  profileId?: string;
}

export interface ManagerAccount {
  managerAccountId: string;
  managerAccountName: string;
  linkedAccounts: LinkedAccount[];
}

export interface ManagerAccountsResponse {
  managerAccounts: ManagerAccount[];
}

/**
 * Fetch manager accounts from Amazon Ads API.
 * Returns linked accounts including dspAdvertiserId for DSP advertisers.
 * Does not require Amazon-Advertising-API-Scope header.
 */
export async function listManagerAccounts(tokenId: string): Promise<ManagerAccount[]> {
  const accessToken = await getValidAccessToken(tokenId);
  if (!accessToken) {
    throw new Error("Invalid or expired token");
  }

  const url = `${DSP_API_BASE}/managerAccounts`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Amazon-Advertising-API-ClientId": config.adsApiClientId,
  };

  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Invalid response: ${text || res.statusText}`);
  }

  if (!res.ok) {
    const msg =
      typeof json === "object" && json !== null && "message" in json
        ? String((json as { message: string }).message)
        : text || res.statusText;
    throw new Error(`Manager accounts failed: ${res.status} ${msg}`);
  }

  const data = json as ManagerAccountsResponse;
  return data?.managerAccounts ?? [];
}

/**
 * Extract DSP advertiser roots (entity -> advertiser) from manager accounts.
 * Only includes linked accounts that have dspAdvertiserId.
 */
export function extractDspAdvertiserRoots(
  managerAccounts: ManagerAccount[]
): Array<{ entityAccountId: string; advertiserId: string; advertiserName: string }> {
  const roots: Array<{ entityAccountId: string; advertiserId: string; advertiserName: string }> = [];
  for (const ma of managerAccounts) {
    for (const la of ma.linkedAccounts ?? []) {
      if (la.dspAdvertiserId && la.accountId) {
        roots.push({
          entityAccountId: la.accountId,
          advertiserId: la.dspAdvertiserId,
          advertiserName: la.accountName || la.dspAdvertiserId,
        });
      }
    }
  }
  return roots;
}

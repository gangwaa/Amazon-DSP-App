import { adsRequest } from "./client.js";

export interface DspAdvertiser {
  advertiserId: string;
  name?: string;
}

/**
 * Fetch advertisers under a DSP entity.
 * Uses entity ID as scope. Tries common API patterns.
 */
export async function listAdvertisersUnderEntity(
  tokenId: string,
  entityId: string
): Promise<DspAdvertiser[]> {
  try {
    const res = await adsRequest<{ advertisers?: DspAdvertiser[]; advertiserIds?: string[] }>({
      tokenId,
      profileId: entityId,
      method: "POST",
      path: "/dsp/v1/advertisers/list",
      body: {},
    });
    if (res?.advertisers && Array.isArray(res.advertisers)) {
      return res.advertisers;
    }
    if (res?.advertiserIds && Array.isArray(res.advertiserIds)) {
      return res.advertiserIds.map((id) => ({ advertiserId: String(id) }));
    }
    const anyRes = res as Record<string, unknown>;
    if (Array.isArray(anyRes)) {
      return anyRes.map((a: Record<string, unknown>) => ({
        advertiserId: String(a.advertiserId ?? a.id ?? a),
        name: a.name as string | undefined,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

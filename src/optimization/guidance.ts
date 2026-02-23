import { adsRequest } from "../ads/client.js";

export interface GuidanceItem {
  actionId: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  recommendationType: string;
  payload?: Record<string, unknown>;
  score?: number;
}

export async function listGuidanceAdvertisers(
  tokenId: string,
  profileId: string,
  advertiserIds?: string[]
): Promise<GuidanceItem[]> {
  const res = await adsRequest<{ guidance?: GuidanceItem[] }>({
    tokenId,
    profileId,
    method: "POST",
    path: "/dsp/v1/guidance/advertisers/list",
    body: advertiserIds ? { advertiserIds } : {},
  });
  return res?.guidance ?? [];
}

export async function listGuidanceOrders(
  tokenId: string,
  profileId: string,
  orderIds?: string[]
): Promise<GuidanceItem[]> {
  const res = await adsRequest<{ guidance?: GuidanceItem[] }>({
    tokenId,
    profileId,
    method: "POST",
    path: "/dsp/v1/guidance/orders/list",
    body: orderIds ? { orderIds } : {},
  });
  return res?.guidance ?? [];
}

export async function listGuidanceLineItems(
  tokenId: string,
  profileId: string,
  lineItemIds?: string[]
): Promise<GuidanceItem[]> {
  const res = await adsRequest<{ guidance?: GuidanceItem[] }>({
    tokenId,
    profileId,
    method: "POST",
    path: "/dsp/v1/guidance/lineitems/list",
    body: lineItemIds ? { lineItemIds } : {},
  });
  return res?.guidance ?? [];
}

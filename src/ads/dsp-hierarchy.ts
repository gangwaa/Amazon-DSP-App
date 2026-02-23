import { adsRequest } from "./client.js";

export interface DspCampaign {
  campaignId: string;
  advertiserId?: string;
  name?: string;
  state?: string;
  deliveryStatus?: string;
  startDateTime?: string;
  endDateTime?: string;
}

export interface DspAdGroup {
  adGroupId: string;
  campaignId: string;
  name?: string;
  state?: string;
  deliveryStatus?: string;
  startDateTime?: string;
  endDateTime?: string;
}

async function listCampaignsPage(
  tokenId: string,
  entityScope: string,
  advertiserId: string,
  nextToken?: string
): Promise<{ campaigns: DspCampaign[]; nextToken?: string }> {
  const body: Record<string, unknown> = { maxResults: 100 };
  if (nextToken) body.nextToken = nextToken;

  const res = await adsRequest<{ campaigns?: DspCampaign[]; nextToken?: string }>({
    tokenId,
    profileId: entityScope,
    amazonAdsAccountId: advertiserId,
    method: "POST",
    path: "/dsp/v1/campaigns/list",
    body,
  });

  const campaigns = res?.campaigns ?? [];
  return { campaigns, nextToken: res?.nextToken };
}

export async function listCampaigns(
  tokenId: string,
  entityScope: string,
  advertiserId: string
): Promise<DspCampaign[]> {
  const all: DspCampaign[] = [];
  let nextToken: string | undefined;
  do {
    const { campaigns, nextToken: nt } = await listCampaignsPage(
      tokenId,
      entityScope,
      advertiserId,
      nextToken
    );
    all.push(...campaigns);
    nextToken = nt;
  } while (nextToken);
  return all;
}

async function listAdGroupsPage(
  tokenId: string,
  entityScope: string,
  advertiserId: string,
  campaignIds: string[],
  nextToken?: string
): Promise<{ adGroups: DspAdGroup[]; nextToken?: string }> {
  const body: Record<string, unknown> = {
    campaignIdFilter: campaignIds,
    maxResults: 100,
  };
  if (nextToken) body.nextToken = nextToken;

  const res = await adsRequest<{ adGroups?: DspAdGroup[]; nextToken?: string }>({
    tokenId,
    profileId: entityScope,
    amazonAdsAccountId: advertiserId,
    method: "POST",
    path: "/dsp/v1/adGroups/list",
    body,
  });

  const adGroups = res?.adGroups ?? [];
  return { adGroups, nextToken: res?.nextToken };
}

export async function listAdGroups(
  tokenId: string,
  entityScope: string,
  advertiserId: string,
  campaignIds: string[]
): Promise<DspAdGroup[]> {
  if (campaignIds.length === 0) return [];

  const all: DspAdGroup[] = [];
  let nextToken: string | undefined;
  do {
    const { adGroups, nextToken: nt } = await listAdGroupsPage(
      tokenId,
      entityScope,
      advertiserId,
      campaignIds,
      nextToken
    );
    all.push(...adGroups);
    nextToken = nt;
  } while (nextToken);
  return all;
}

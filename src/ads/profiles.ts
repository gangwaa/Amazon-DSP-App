import { adsRequest } from "./client.js";

export interface Profile {
  profileId: string;
  accountId: string;
  countryCode?: string;
  currencyCode?: string;
  timezone?: string;
  accountInfo?: {
    id: string;
    name?: string;
    type?: string;
    marketplaceStringId?: string;
  };
}

export async function fetchProfiles(
  tokenId: string,
  accessToken?: string
): Promise<Profile[]> {
  const res = await adsRequest<unknown>({
    tokenId,
    profileId: "0",
    path: "/v2/profiles",
    accessTokenOverride: accessToken,
  });
  const raw = Array.isArray(res) ? res : [];
  return raw
    .filter((p: Record<string, unknown>) => p.profileId ?? p.profile_id)
    .map((p: Record<string, unknown>) => {
    const accountInfo = p.accountInfo as Record<string, unknown> | undefined;
    return {
      profileId: String(p.profileId ?? p.profile_id ?? ""),
      accountId: String(p.accountId ?? accountInfo?.id ?? p.profileId ?? p.profile_id ?? ""),
      countryCode: p.countryCode as string | undefined,
      currencyCode: p.currencyCode as string | undefined,
      timezone: p.timezone as string | undefined,
      accountInfo: accountInfo
        ? {
            id: String(accountInfo.id ?? p.profileId ?? p.profile_id ?? ""),
            name: accountInfo.name as string | undefined,
            type: accountInfo.type as string | undefined,
            marketplaceStringId: accountInfo.marketplaceStringId as string | undefined,
          }
        : undefined,
    };
  })
    .filter((p) => p.profileId && p.accountId);
}

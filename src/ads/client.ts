import { config, DSP_API_BASE } from "../config.js";
import { getValidAccessToken } from "../auth/token-store.js";

export interface AdsRequestOptions {
  tokenId: string;
  profileId: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  retryOn401?: boolean;
  /** Use this access token instead of fetching from store (e.g. right after OAuth exchange) */
  accessTokenOverride?: string;
  /** DSP endpoints require Amazon-Ads-AccountId (advertiser ID); when set, add this header */
  amazonAdsAccountId?: string;
}

export async function adsRequest<T>(opts: AdsRequestOptions): Promise<T> {
  const accessToken =
    opts.accessTokenOverride ?? (await getValidAccessToken(opts.tokenId));
  if (!accessToken) {
    throw new AdsApiError(401, "Invalid or expired token");
  }

  const url = `${DSP_API_BASE}${opts.path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Amazon-Advertising-API-ClientId": config.adsApiClientId,
    "Amazon-Advertising-API-Scope": opts.profileId,
    "Content-Type": "application/json",
  };
  if (opts.amazonAdsAccountId) {
    headers["Amazon-Ads-AccountId"] = opts.amazonAdsAccountId;
  }

  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers,
  };
  if (opts.body && (opts.method === "POST" || opts.method === "PUT")) {
    init.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, init);

  if (res.status === 401 && opts.retryOn401 !== false) {
    throw new AdsApiError(401, "Unauthorized - token may need re-authorization");
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new AdsApiError(res.status, text || res.statusText);
  }

  if (!res.ok) {
    const msg = typeof json === "object" && json !== null && "message" in json
      ? String((json as { message: string }).message)
      : text || res.statusText;
    throw new AdsApiError(res.status, msg);
  }

  return json as T;
}

export class AdsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AdsApiError";
  }
}

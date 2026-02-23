import { config, LWA_URLS } from "../config.js";

const scope = "advertising::campaign_management";

export function buildAuthUrl(state: string): string {
  const base = LWA_URLS[config.region].auth;
  const params = new URLSearchParams({
    client_id: config.lwaClientId,
    scope,
    response_type: "code",
    redirect_uri: config.redirectUri,
    state,
  });
  return `${base}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const endpoint = LWA_URLS[config.region].token;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.lwaClientId,
    client_secret: config.lwaClientSecret,
    redirect_uri: config.redirectUri,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LwA token exchange failed: ${res.status} ${err}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>;
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
}> {
  const endpoint = LWA_URLS[config.region].token;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.lwaClientId,
    client_secret: config.lwaClientSecret,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LwA refresh failed: ${res.status} ${err}`);
  }

  return res.json() as Promise<{
    access_token: string;
    expires_in: number;
    token_type: string;
  }>;
}

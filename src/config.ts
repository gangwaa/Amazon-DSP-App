import "dotenv/config";

const required = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
};

const optional = (key: string, def: string): string => process.env[key] ?? def;

export const config = {
  lwaClientId: required("LWA_CLIENT_ID"),
  lwaClientSecret: required("LWA_CLIENT_SECRET"),
  adsApiClientId: required("AMAZON_ADS_API_CLIENT_ID"),
  redirectUri: required("OAUTH_REDIRECT_URI"),
  baseUrl: optional("BASE_URL", "http://localhost:3000"),
  region: optional("REGION", "NA") as "NA" | "EU" | "FE",
  tokenEncryptionKey: required("TOKEN_ENCRYPTION_KEY"),
  sessionSecret: required("SESSION_SECRET"),
  dbPath: optional("DB_PATH", "./data/app.db"),
} as const;

export const LWA_URLS = {
  NA: {
    auth: "https://www.amazon.com/ap/oa",
    token: "https://api.amazon.com/auth/o2/token",
  },
  EU: {
    auth: "https://eu.account.amazon.com/ap/oa",
    token: "https://api.amazon.co.uk/auth/o2/token",
  },
  FE: {
    auth: "https://apac.account.amazon.com/ap/oa",
    token: "https://api.amazon.co.jp/auth/o2/token",
  },
} as const;

export const DSP_API_BASE = "https://advertising-api.amazon.com";

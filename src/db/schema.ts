export const schema = `
-- Tokens: encrypted refresh + metadata (access tokens fetched on demand)
CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  internal_client_id TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_in INTEGER,
  last_refresh_at INTEGER,
  revocation_status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_client ON tokens(internal_client_id);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(revocation_status);

-- Profiles: advertiser profiles discoverable after auth
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL REFERENCES tokens(id),
  profile_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT,
  account_type TEXT,
  country_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(token_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_token ON profiles(token_id);
CREATE INDEX IF NOT EXISTS idx_profiles_account ON profiles(account_id);

-- Entities: DSP entity level (e.g. ENTITY15RMSENUFKC34)
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL REFERENCES tokens(id),
  entity_id TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(token_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_entities_token ON entities(token_id);

-- Advertisers under an entity
CREATE TABLE IF NOT EXISTS entity_advertisers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL,
  advertiser_id TEXT NOT NULL,
  advertiser_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(entity_id, advertiser_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_advertisers_entity ON entity_advertisers(entity_id);

-- Audit log: who linked/unlinked when
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  internal_client_id TEXT,
  profile_id TEXT,
  account_id TEXT,
  actor_id TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_client ON audit_log(internal_client_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- Metrics: canonical KPI model
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL,
  date TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  spend REAL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  frequency REAL DEFAULT 0,
  cpm REAL DEFAULT 0,
  ctr REAL DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conv_rate REAL DEFAULT 0,
  raw_json TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(profile_id, date, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_metrics_profile_date ON metrics(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_metrics_entity ON metrics(entity_type, entity_id);

-- Guidance recommendations
CREATE TABLE IF NOT EXISTS guidance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  recommendation_type TEXT,
  payload TEXT,
  score REAL,
  status TEXT DEFAULT 'pending',
  approved_at INTEGER,
  executed_at INTEGER,
  execution_id TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guidance_profile ON guidance(profile_id);
CREATE INDEX IF NOT EXISTS idx_guidance_status ON guidance(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guidance_action ON guidance(profile_id, action_id);
`;

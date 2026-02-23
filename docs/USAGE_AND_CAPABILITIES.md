# Amazon DSP API Internal Tool — Usage and Capabilities

## Overview

This tool is an internal agency platform for Amazon DSP (Demand-Side Platform). It provides:

- **Authentication** — OAuth 2.0 via Login with Amazon (LwA) for secure Amazon Ads API access
- **Account discovery** — DSP entity → advertiser hierarchy from Manager Accounts
- **Campaign hierarchy** — Live view of campaigns (orders) and line items (ad groups)
- **Reporting** — Performance metrics sync and data quality checks
- **Optimization** — Guidance recommendations and Quick Action execution
- **External interface** — Read-only API for chat/LLM applications

## Capabilities

### 1. Authentication and account linking

| Capability | Description |
|------------|-------------|
| OAuth flow | Authorization Code Grant via LwA; server-side token exchange |
| Token storage | Encrypted refresh tokens at rest; access tokens fetched on demand |
| Session | Express session with `connect.sid` cookie (7-day max age) |
| Token restore | If no session, restores last token for `default` client when possible |
| Unlink | Revoke linked account via POST `/auth/unlink` |

**Endpoints**

- `GET /auth/authorize` — Start OAuth flow (redirects to Amazon)
- `GET /auth/callback` — OAuth callback (handled by LwA redirect)
- `POST /auth/unlink` — Revoke linked account

---

### 2. DSP hierarchy and account management

| Capability | Description |
|------------|-------------|
| Entity discovery | DSP entities (e.g. ENTITY15RMSENUFKC34) from Manager Accounts |
| Advertiser sync | Advertisers under each entity; auto-sync on dashboard load |
| Manual advertiser add | Add advertiser by ID when not auto-discovered |
| Campaign list | Orders (campaigns) for an advertiser via DSP API |
| Line item list | Line items (ad groups) per campaign via DSP API |

**Data flow**

```
Manager Accounts (GET /managerAccounts)
    → linkedAccounts[].accountId (entity)
    → linkedAccounts[].dspAdvertiserId (advertiser)
    → POST /dsp/v1/campaigns/list
    → POST /dsp/v1/adGroups/list
```

**Endpoints**

- `GET /api/entities` — Entities with nested advertisers
- `POST /api/entities/add` — Add entity (body: `entity_id`, `display_name`)
- `GET /api/entities/:entityId/advertisers` — Advertisers for entity
- `POST /api/entities/:entityId/advertisers/fetch` — Sync advertisers from API
- `POST /api/entities/:entityId/advertisers/add` — Add advertiser manually
- `GET /api/advertisers/:advertiserId/hierarchy` — Campaigns + line items
- `GET /api/profiles` — Legacy profiles list
- `POST /api/profiles/add` — Add advertiser as profile

---

### 3. Performance metrics

| Capability | Description |
|------------|-------------|
| Report sync | Scheduled job pulls DSP reports into `metrics` table |
| Metrics model | `profile_id`, `date`, `entity_type`, `entity_id`, spend, impressions, reach, frequency, cpm, ctr, clicks, conversions, conv_rate |
| Data quality | Missing dates, anomalies, late-arriving records |

**Endpoints**

- `GET /api/metrics?profile_id=&start_date=&end_date=` — Metrics for date range
- `GET /api/metrics/quality?profile_id=&start_date=&end_date=` — Data quality check

**Sync**

- `npm run reporting:sync` — Daily; fetches last 7 days per advertiser

---

### 4. Optimization (Guidance and Quick Actions)

| Capability | Description |
|------------|-------------|
| Guidance sync | Scheduled job fetches recommendations (advertiser, order, line-item level) |
| Recommendation types | e.g. BUDGET_INCREASE; stored with score, payload, status |
| Quick Action execute | Apply recommendation via Amazon DSP Quick Action API |
| Audit trail | `audit_log` records guidance_executed, guidance_failed |

**Endpoints**

- `GET /api/guidance?profile_id=&status=` — Recommendations (status: pending, executed, failed, rejected)
- `POST /api/guidance/:actionId/execute` — Execute Quick Action (body: `{ profile_id }`)

**Sync**

- `npm run guidance:sync` — Every 6h; fetches pending recommendations per advertiser

---

### 5. Campaign write operations

| Capability | Description |
|------------|-------------|
| Create order | Create campaign (order) under advertiser |
| Create line item | Create line item (ad group) under order |

**Endpoints**

- `POST /api/campaigns/orders` — Body: `profile_id`, `name`, `budget?`
- `POST /api/campaigns/lineItems` — Body: `profile_id`, `order_id`, `name`, `budget?`, `frequency_cap?`

---

### 6. Assistant Tool API (for external chat/LLM apps)

Read-only, normalized endpoints for external chat UIs or agent apps. Uses envelope `{ ok, data, meta }` or `{ ok: false, error: { code, message } }`.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/assistant/tools/health` | Session readiness, advertiser/entity counts |
| `GET /api/assistant/tools/entities` | List entities |
| `GET /api/assistant/tools/advertisers?entity_id=` | List advertisers (optional filter) |
| `GET /api/assistant/tools/hierarchy?advertiser_id=` | Campaigns + line items |
| `GET /api/assistant/tools/metrics?advertiser_id=&start_date=&end_date=` | Metrics |
| `GET /api/assistant/tools/guidance?advertiser_id=&status=` | Recommendations |

**Behavior**

- Pagination: `limit` (default 100, max 500), `offset`
- Date range: `start_date`, `end_date` (YYYY-MM-DD); defaults to last 7 days
- Tenant isolation: All data scoped to linked token

See [ASSISTANT_INTEGRATION.md](ASSISTANT_INTEGRATION.md) for full API reference and tool-calling guidance.

---

## Dashboard usage

### First-time setup

1. Open `http://localhost:3000` (or your `BASE_URL`).
2. Click **Link Amazon Ads Account**.
3. Complete LwA OAuth (sign in, grant scopes).
4. After redirect, dashboard loads with advertisers from Manager Accounts.

### Dashboard features

- **Advertiser cards** — Each card shows advertiser name, ID, and actions.
- **View hierarchy** — Expand to see campaigns (orders) and line items; fetches live from DSP API.
- **Guidance** — Link to pending recommendations (JSON).
- **Add advertiser** — Form to add an advertiser by ID when not auto-synced.
- **Unlink** — Revoke linked account.

### Entity and advertiser flow

- Entities come from Manager Accounts; advertisers are synced on dashboard load.
- If an advertiser is missing, add it manually using the ID from the DSP console URL:  
  `.../advertisers/<advertiser_id>/orders`.

---

## Configuration

### Environment variables (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `LWA_CLIENT_ID` | Yes | Login with Amazon app client ID |
| `LWA_CLIENT_SECRET` | Yes | LwA client secret |
| `AMAZON_ADS_API_CLIENT_ID` | Yes | Same as LWA or Amazon Ads API app client ID |
| `OAUTH_REDIRECT_URI` | Yes | Must match Allowed Return URLs in LwA |
| `BASE_URL` | No | Base URL for redirects (default: http://localhost:3000) |
| `REGION` | No | NA, EU, or FE (default: NA) |
| `TOKEN_ENCRYPTION_KEY` | Yes | 32-byte hex (e.g. `openssl rand -hex 32`) |
| `SESSION_SECRET` | Yes | Session signing secret (min 32 chars) |
| `DB_PATH` | No | SQLite DB path (default: ./data/app.db) |
| `PORT` | No | Server port (default: 3000) |
| `CORS_ORIGINS` | No | Comma-separated origins for cross-origin requests |

### LwA and Amazon Ads API setup

1. Create an LwA security profile at [developer.amazon.com](https://developer.amazon.com).
2. Add `advertising::campaign_management` scope.
3. Apply for Amazon Ads API access.
4. Add `OAUTH_REDIRECT_URI` to Allowed Return URLs (e.g. `http://localhost:3000/auth/callback`).

---

## External app integration

### Same-origin

If the chat app is served from the same domain as this backend, session cookies apply automatically.

### Cross-origin

1. Set `CORS_ORIGINS=https://your-chat-app.com` in `.env`.
2. Use `credentials: "include"` (or equivalent) in all fetch/axios calls.
3. User must complete OAuth in this app first (same browser session or proxied auth).

### Recommended flow

1. User links account at `/auth/authorize` → `/auth/callback`.
2. Chat app calls `GET /api/assistant/tools/health` to verify readiness.
3. Chat app calls `entities` or `advertisers` to get IDs.
4. Use `advertiser_id` for `hierarchy`, `metrics`, `guidance`.

---

## NPM scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run dev` | Run with tsx watch |
| `npm start` | Run compiled server |
| `npm run db:migrate` | Initialize/reset DB |
| `npm run reporting:sync` | Sync DSP reports into metrics |
| `npm run guidance:sync` | Sync guidance recommendations |
| `npm run test:assistant` | Test assistant API (server must be running) |
| `npm run lint` | Run ESLint |

---

## Limitations and scope

- **Read-heavy** — Assistant API is read-only; no execution via assistant namespace.
- **DSP only** — Built for Amazon DSP; Sponsored Products/ Brands use different APIs.
- **Single client** — Token restore uses `default` client; multi-tenant needs session/client routing.
- **Metrics freshness** — Metrics depend on `reporting:sync`; run daily for up-to-date data.
- **Guidance freshness** — Run `guidance:sync` every 6h for current recommendations.

---

## Runbook

See [RUNBOOK.md](RUNBOOK.md) for re-auth, revoked access, failed action recovery, and operational commands.

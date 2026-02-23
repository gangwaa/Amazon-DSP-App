# Amazon DSP API Internal Tool

Internal agency platform for Amazon DSP: OAuth auth, reporting ingestion, and optimization automation.

## Setup

1. **Register LwA app**: Create a Login with Amazon app in [Amazon Developer Console](https://developer.amazon.com) and apply for Amazon Ads API access.
2. **Configure env**: Copy `.env.example` to `.env` and fill in:
   - `LWA_CLIENT_ID`, `LWA_CLIENT_SECRET`, `AMAZON_ADS_API_CLIENT_ID`
   - `OAUTH_REDIRECT_URI` (must match Allowed Return URLs in LwA Web Settings)
   - `TOKEN_ENCRYPTION_KEY` (32-byte hex: `openssl rand -hex 32`)
   - `SESSION_SECRET`
3. **Install and run**:
   ```bash
   npm install
   npm run build
   npm run db:migrate
   npm run dev
   ```
4. Open `http://localhost:3000`, click "Link Amazon Ads Account", complete OAuth.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /auth/authorize` | Start OAuth flow |
| `GET /auth/callback` | OAuth callback (handled by LwA redirect) |
| `POST /auth/unlink` | Revoke linked account |
| `GET /api/profiles` | List advertiser profiles |
| `GET /api/metrics?profile_id=&start_date=&end_date=` | Performance metrics |
| `GET /api/guidance?profile_id=&status=` | Optimization recommendations |
| `POST /api/guidance/:actionId/execute` | Execute a Quick Action (body: `{ profile_id }`) |
| `GET /api/metrics/quality?profile_id=&start_date=&end_date=` | Data quality check (missing dates, anomalies) |
| `POST /api/campaigns/orders` | Create order (body: `{ profile_id, name, budget? }`) |
| `POST /api/campaigns/lineItems` | Create line item (body: `{ profile_id, order_id, name, budget?, frequency_cap? }`) |

## Scheduled Jobs

- **Reporting sync**: `npm run reporting:sync` — Pull DSP reports into `metrics` table. Run daily.
- **Guidance sync**: `npm run guidance:sync` — Fetch recommendations. Run every 6h.

## Runbook

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for re-auth, revoked access, and failed action recovery.

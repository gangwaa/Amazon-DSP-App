# Amazon DSP API Internal Tool

Internal agency platform for Amazon DSP: OAuth auth, reporting ingestion, optimization automation, and a read-only API for external chat/LLM apps.

## Quick start

1. **Register LwA app** in [Amazon Developer Console](https://developer.amazon.com) and apply for Amazon Ads API access.
2. **Configure env**: Copy `.env.example` to `.env` and set:
   - `LWA_CLIENT_ID`, `LWA_CLIENT_SECRET`, `AMAZON_ADS_API_CLIENT_ID`
   - `OAUTH_REDIRECT_URI` (match Allowed Return URLs in LwA)
   - `TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`)
   - `SESSION_SECRET`
3. **Run**:
   ```bash
   npm install && npm run build && npm run db:migrate && npm run dev
   ```
4. Open `http://localhost:3000`, link your Amazon Ads account via OAuth.

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/USAGE_AND_CAPABILITIES.md](docs/USAGE_AND_CAPABILITIES.md) | Full usage, capabilities, and configuration |
| [docs/ASSISTANT_INTEGRATION.md](docs/ASSISTANT_INTEGRATION.md) | Assistant Tool API for external chat/LLM apps |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Re-auth, recovery, and operations |

## Capabilities summary

- **Auth** — OAuth 2.0 via LwA, encrypted token storage
- **DSP hierarchy** — Entity → advertiser → campaign → line item
- **Metrics** — Reporting sync, data quality checks
- **Guidance** — Recommendations + Quick Action execution
- **Assistant API** — Read-only endpoints for external chat apps (`/api/assistant/tools/*`)

## Key endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /auth/authorize` | Start OAuth |
| `GET /api/advertisers/:id/hierarchy` | Campaigns + line items |
| `GET /api/guidance?profile_id=&status=` | Recommendations |
| `POST /api/guidance/:actionId/execute` | Execute Quick Action |
| `GET /api/assistant/tools/*` | Read-only API for external apps |

## NPM scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run dev server |
| `npm run reporting:sync` | Sync DSP reports (daily) |
| `npm run guidance:sync` | Sync recommendations (every 6h) |
| `npm run test:assistant` | Test assistant API |

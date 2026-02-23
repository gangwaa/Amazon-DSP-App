# Amazon DSP API Internal Tool - Runbook

## Re-authorization (Token Refresh Failure)

When API calls return `401 Unauthorized` or token refresh fails:

1. **Identify affected account**: Check logs for `LwA refresh failed` or `Invalid or expired token`.
2. **Revoke stale token**: Use `/auth/unlink` or update `tokens.revocation_status = 'revoked'` for the token.
3. **Re-link**: Direct the advertiser to `/auth/authorize?client_id=<internal_client_id>`.
4. **Verify**: After OAuth callback, confirm `GET /api/profiles` returns data.

## Revoked Access Handling

When an advertiser revokes access in Amazon Ads console:

1. **Symptom**: 401 responses for previously working requests.
2. **Action**: Mark token as revoked; remove from session. Log in `audit_log`.
3. **Recovery**: Advertiser must re-authorize via `/auth/authorize`.

## Failed Action Recovery (Quick Actions)

When `POST /api/guidance/:actionId/execute` fails:

1. **Check status**: `guidance.status = 'failed'`, `guidance.error_message` has details.
2. **Retry**: If error is transient (rate limit, timeout), retry after backoff.
3. **Manual fallback**: Use DSP console to apply the change if API is consistently failing.
4. **Audit**: `audit_log` records `guidance_failed` with `actionId` and `error`.

## Data Quality Checks

- **Missing intervals**: Compare `metrics` date range to expected calendar; alert on gaps.
- **Metric anomalies**: Alert if `spend` or `impressions` drop >50% day-over-day for same entity.
- **Late-arriving records**: DSP reporting can lag; allow 48h for data completeness before alerting.

## Operational Commands

```bash
# Run reporting sync (daily)
npm run reporting:sync

# Run guidance sync (every 6h)
npm run guidance:sync

# Initialize/reset DB
npm run db:migrate
```

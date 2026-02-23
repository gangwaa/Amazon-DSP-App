# Chat Assistant API Integration

This document describes the read-only tool endpoints exposed for external chat/agent applications. All endpoints require an active session (see [Auth](#auth)) and return a standardized envelope.

For overall usage and capabilities, see [USAGE_AND_CAPABILITIES.md](USAGE_AND_CAPABILITIES.md).

## Base URL

- Production: `{BASE_URL}/api/assistant/tools`
- All requests must include session cookies from this app's auth flow.

## Auth

The external chat app must use the same session as this backend. Options:

1. **Same-origin**: Chat app served from same domain; session cookies apply automatically.
2. **Cross-origin**: Chat app calls this API with `credentials: "include"`; ensure CORS allows the chat app origin and credentials.

If unauthenticated, responses use the legacy `401` format: `{ error: "Not linked. Authorize first at /auth/authorize" }`.

## Response Envelope

### Success

```json
{
  "ok": true,
  "data": <payload>,
  "meta": { "count": 5, "limit": 100, "offset": 0 }
}
```

### Error

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "start_date must be YYYY-MM-DD",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Not linked; authorize first |
| `BAD_REQUEST` | 400 | Missing or invalid required params |
| `VALIDATION_ERROR` | 400 | Param format invalid (e.g., date) |
| `NOT_FOUND` | 404 | Entity or advertiser not found or not accessible |
| `INTERNAL_ERROR` | 500 | Server error during fetch |

---

## Endpoints

### GET /api/assistant/tools/entities

Returns entities (DSP entity level) for the linked token.

**Params:** none

**Response:**

```json
{
  "ok": true,
  "data": [
    { "entityId": "ENTITY15RMSENUFKC34", "displayName": "My Entity" }
  ],
  "meta": { "count": 1 }
}
```

---

### GET /api/assistant/tools/advertisers

Returns advertisers. Optionally filter by entity.

| Param | Required | Description |
|-------|----------|-------------|
| `entity_id` | no | If provided, return advertisers for this entity only |

**Response:**

```json
{
  "ok": true,
  "data": [
    { "advertiserId": "593265975929580164", "advertiserName": "Acme Ads" }
  ],
  "meta": { "count": 1 }
}
```

---

### GET /api/assistant/tools/hierarchy

Returns campaign/order and line-item (ad group) hierarchy for an advertiser.

| Param | Required | Description |
|-------|----------|-------------|
| `advertiser_id` | yes | Advertiser ID (e.g., from advertisers tool) |

**Response:**

```json
{
  "ok": true,
  "data": {
    "campaigns": [
      {
        "campaignId": "...",
        "name": "Campaign 1",
        "state": "ENABLED",
        "deliveryStatus": "ACTIVE"
      }
    ],
    "adGroupsByCampaign": {
      "<campaignId>": [
        {
          "adGroupId": "...",
          "campaignId": "...",
          "name": "Line Item 1",
          "state": "ENABLED",
          "deliveryStatus": "ACTIVE"
        }
      ]
    }
  },
  "meta": { "count": 1 }
}
```

---

### GET /api/assistant/tools/metrics

Returns performance metrics for an advertiser (line-item level, by date).

| Param | Required | Description |
|-------|----------|-------------|
| `advertiser_id` | yes | Advertiser ID |
| `start_date` | no | YYYY-MM-DD (default: 7 days ago) |
| `end_date` | no | YYYY-MM-DD (default: today) |
| `limit` | no | Max rows (default 100, max 500) |
| `offset` | no | Pagination offset (default 0) |

**Response:**

```json
{
  "ok": true,
  "data": [
    {
      "profile_id": "593265975929580164",
      "date": "2025-02-15",
      "entity_type": "lineItem",
      "entity_id": "12345",
      "spend": 45.2,
      "impressions": 10000,
      "reach": 5000,
      "frequency": 2.0,
      "cpm": 4.52,
      "ctr": 0.15,
      "clicks": 15,
      "conversions": 2,
      "conv_rate": 0.13
    }
  ],
  "meta": { "count": 10, "limit": 100, "offset": 0 }
}
```

---

### GET /api/assistant/tools/guidance

Returns DSP guidance recommendations for an advertiser.

| Param | Required | Description |
|-------|----------|-------------|
| `advertiser_id` | yes | Advertiser ID |
| `status` | no | `pending` \| `executed` \| `failed` \| `rejected` (default: `pending`) |
| `limit` | no | Max rows (default 100, max 500) |
| `offset` | no | Pagination offset (default 0) |

**Response:**

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "profile_id": "593265975929580164",
      "action_id": "abc-123",
      "entity_type": "lineItem",
      "entity_id": "12345",
      "entity_name": "Line Item 1",
      "recommendation_type": "BUDGET_INCREASE",
      "payload": "{}",
      "score": 0.85,
      "status": "pending",
      "created_at": 1739700000000,
      "updated_at": 1739700000000
    }
  ],
  "meta": { "count": 1, "limit": 100, "offset": 0 }
}
```

---

### GET /api/assistant/tools/health

Returns session and data readiness.

**Params:** none

**Response:**

```json
{
  "ok": true,
  "data": {
    "linked": true,
    "tokenValid": true,
    "advertiserCount": 3,
    "entityCount": 2,
    "ready": true
  },
  "meta": { "timestamp": "2025-02-22T12:00:00.000Z" }
}
```

---

## Tool-Calling Guidance for LLM Apps

Map user intents to the appropriate endpoint:

| User Intent | Endpoint | Notes |
|-------------|----------|-------|
| "List entities" / "What entities do I have?" | `entities` | No params |
| "List advertisers" / "Advertisers for entity X" | `advertisers` | Use `entity_id` if user specifies an entity |
| "Show hierarchy" / "Campaigns and line items for advertiser X" | `hierarchy` | Requires `advertiser_id` |
| "Show performance" / "Metrics for advertiser X" / "Spend and impressions" | `metrics` | Requires `advertiser_id`; optionally `start_date`, `end_date` |
| "Pending recommendations" / "Guidance for advertiser X" | `guidance` | Requires `advertiser_id`; optionally filter by `status` |
| "Am I connected?" / "Is the API ready?" | `health` | No params |

Suggested flow for the LLM agent:

1. Call `health` first to ensure the user is linked.
2. Call `entities` or `advertisers` to resolve entity/advertiser IDs before hierarchy or metrics.
3. Use `advertiser_id` from advertisers response for `hierarchy`, `metrics`, and `guidance`.

---

## Data Parity and Tenant Isolation

Assistant endpoints wrap the same data modules as the legacy routes:

- **entities** → `getEntitiesForToken` (same as `/api/entities`)
- **advertisers** → `getAdvertisersForEntity` / `getAdvertisersForToken` (same as `/api/entities/:entityId/advertisers`)
- **hierarchy** → `listCampaigns` + `listAdGroups` (same as `/api/advertisers/:advertiserId/hierarchy`)
- **metrics** → `metrics` table (same as `/api/metrics`)
- **guidance** → `guidance` table (same as `/api/guidance`)

Tenant isolation is enforced via `req.tokenId` from the session. All entity/advertiser lookups are scoped to that token. Advertiser IDs are validated against `getAdvertisersForToken` before returning hierarchy, metrics, or guidance.

---

## Testing

### Unauthenticated (expect 401)
```bash
curl -s http://localhost:3000/api/assistant/tools/health
# {"error":"Not linked. Authorize first at /auth/authorize"}
```

### With session (after linking via dashboard)
1. Link account at `http://localhost:3000/dashboard`
2. Copy the `connect.sid` cookie from browser dev tools
3. Run:
```bash
SESSION_COOKIE='connect.sid=YOUR_VALUE' node scripts/test-assistant-api.mjs http://localhost:3000
```

### CORS for external app
Set `CORS_ORIGINS` in `.env` to your chat app origin(s), e.g.:
```
CORS_ORIGINS=https://chat.yourdomain.com
```
External requests must use `credentials: "include"` so cookies are sent.

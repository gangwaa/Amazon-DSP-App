import { Router } from "express";
import { getProfilesForToken, addManualProfile } from "../../ads/profiles-store.js";
import { getDb } from "../../db/client.js";
import { getLatestActiveTokenId, getTokenRow } from "../../auth/token-store.js";
import {
  addEntity,
  getEntitiesForToken,
  getAdvertisersForEntity,
  upsertEntityAdvertisers,
  addEntityAdvertiser,
  getEntityForAdvertiser,
} from "../../db/entities-store.js";
import { listAdvertisersUnderEntity } from "../../ads/dsp-entities.js";
import { listCampaigns, listAdGroups } from "../../ads/dsp-hierarchy.js";
import { executeQuickAction } from "../../optimization/quick-actions.js";
import { auditLog } from "../../auth/audit.js";
import { createOrder, createLineItem } from "../../campaigns/api.js";
import { runDataQualityCheck } from "../../reporting/data-quality.js";

export const apiRouter = Router();

declare global {
  namespace Express {
    interface Request {
      tokenId?: string;
    }
  }
}

apiRouter.use((req, res, next) => {
  const sess = req.session as unknown as Record<string, unknown>;
  let tokenId = sess.linkedTokenId as string | undefined;
  const clientId = (sess.linkedClientId as string | undefined) || "default";
  if (tokenId && !getTokenRow(tokenId)) {
    tokenId = undefined;
    sess.linkedTokenId = undefined;
  }
  if (!tokenId) {
    const restoredTokenId = getLatestActiveTokenId(clientId);
    if (restoredTokenId) {
      tokenId = restoredTokenId;
      sess.linkedTokenId = restoredTokenId;
      sess.linkedClientId = clientId;
    }
  }
  if (!tokenId) {
    res.status(401).json({ error: "Not linked. Authorize first at /auth/authorize" });
    return;
  }
  req.tokenId = tokenId;
  next();
});

apiRouter.get("/profiles", (req, res) => {
  const tokenId = req.tokenId!;
  const profiles = getProfilesForToken(tokenId);
  res.json({ profiles });
});

apiRouter.get("/advertisers/:advertiserId/hierarchy", async (req, res) => {
  const tokenId = req.tokenId!;
  const { advertiserId } = req.params;
  if (!advertiserId) {
    res.status(400).json({ error: "advertiserId required" });
    return;
  }
  const entityScope = getEntityForAdvertiser(tokenId, advertiserId);
  if (!entityScope) {
    res.status(404).json({ error: "Advertiser not found or entity scope unknown. Sync via dashboard first." });
    return;
  }
  try {
    const campaigns = await listCampaigns(tokenId, entityScope, advertiserId);
    const campaignIds = campaigns.map((c) => c.campaignId);
    const adGroups = await listAdGroups(tokenId, entityScope, advertiserId, campaignIds);
    const adGroupsByCampaign: Record<string, typeof adGroups> = {};
    for (const cid of campaignIds) {
      adGroupsByCampaign[cid] = adGroups.filter((ag) => ag.campaignId === cid);
    }
    res.json({ campaigns, adGroupsByCampaign });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Hierarchy fetch failed";
    res.status(500).json({ error: msg });
  }
});

apiRouter.post("/entities/add", (req, res) => {
  const tokenId = req.tokenId!;
  const entityId = String(req.body.entity_id ?? "").trim().toUpperCase();
  const displayName = req.body.display_name as string | undefined;
  if (!entityId) {
    res.status(400).json({ error: "entity_id required" });
    return;
  }
  addEntity(tokenId, entityId, displayName);
  const isForm = req.headers["content-type"]?.includes("application/x-www-form-urlencoded");
  if (isForm) {
    res.redirect("/dashboard");
    return;
  }
  res.json({ ok: true, entityId });
});

apiRouter.get("/entities/:entityId/advertisers", (req, res) => {
  const { entityId } = req.params;
  const advertisers = getAdvertisersForEntity(entityId);
  res.json({ entityId, advertisers });
});

apiRouter.post("/entities/:entityId/advertisers/fetch", async (req, res) => {
  const tokenId = req.tokenId!;
  const { entityId } = req.params;
  try {
    const advertisers = await listAdvertisersUnderEntity(tokenId, entityId);
    upsertEntityAdvertisers(entityId, advertisers);
    res.json({ ok: true, count: advertisers.length, advertisers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    res.status(500).json({ error: msg });
  }
});

apiRouter.post("/entities/:entityId/advertisers/add", (req, res) => {
  const { entityId } = req.params;
  const advertiserId = String(req.body.advertiser_id ?? "").trim();
  const name = req.body.name as string | undefined;
  if (!advertiserId) {
    res.status(400).json({ error: "advertiser_id required" });
    return;
  }
  addEntityAdvertiser(entityId, advertiserId, name);
  const isForm = req.headers["content-type"]?.includes("application/x-www-form-urlencoded");
  if (isForm) {
    res.redirect("/dashboard");
    return;
  }
  res.json({ ok: true, advertiserId });
});

apiRouter.get("/entities", (req, res) => {
  const tokenId = req.tokenId!;
  const entities = getEntitiesForToken(tokenId);
  const withAdvertisers = entities.map((e) => ({
    ...e,
    advertisers: getAdvertisersForEntity(e.entityId),
  }));
  res.json({ entities: withAdvertisers });
});

apiRouter.post("/profiles/add", (req, res) => {
  const tokenId = req.tokenId!;
  const advertiserId = String(req.body.advertiser_id ?? req.body.profile_id ?? "").trim();
  const name = req.body.name as string | undefined;
  if (!advertiserId) {
    res.status(400).json({ error: "advertiser_id required" });
    return;
  }
  try {
    addManualProfile(tokenId, advertiserId, name);
    const isForm = req.headers["content-type"]?.includes("application/x-www-form-urlencoded");
    if (isForm) {
      res.redirect("/dashboard");
      return;
    }
    res.json({ ok: true, profileId: advertiserId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to add profile";
    res.status(500).json({ error: msg });
  }
});

apiRouter.get("/metrics/quality", (req, res) => {
  const profileId = req.query.profile_id as string;
  const start = req.query.start_date as string;
  const end = req.query.end_date as string;
  if (!profileId || !start || !end) {
    res.status(400).json({ error: "profile_id, start_date, end_date required" });
    return;
  }
  const result = runDataQualityCheck(profileId, start, end);
  res.json(result);
});

apiRouter.get("/metrics", (req, res) => {
  const profileId = req.query.profile_id as string;
  const start = req.query.start_date as string;
  const end = req.query.end_date as string;
  if (!profileId || !start || !end) {
    res.status(400).json({ error: "profile_id, start_date, end_date required" });
    return;
  }
  const rows = getDb()
    .prepare(
      `SELECT * FROM metrics WHERE profile_id = ? AND date >= ? AND date <= ? ORDER BY date, entity_id`
    )
    .all(profileId, start, end);
  res.json({ metrics: rows });
});

apiRouter.get("/guidance", (req, res) => {
  const profileId = req.query.profile_id as string;
  const status = (req.query.status as string) || "pending";
  if (!profileId) {
    res.status(400).json({ error: "profile_id required" });
    return;
  }
  const rows = getDb()
    .prepare(
      `SELECT * FROM guidance WHERE profile_id = ? AND status = ? ORDER BY created_at DESC`
    )
    .all(profileId, status);
  res.json({ guidance: rows });
});

apiRouter.post("/guidance/:actionId/execute", async (req, res) => {
  const tokenId = req.tokenId!;
  const { actionId } = req.params;
  const profileId = req.body.profile_id as string;
  if (!profileId) {
    res.status(400).json({ error: "profile_id required in body" });
    return;
  }
  try {
    const result = await executeQuickAction(tokenId, profileId, actionId);
    const now = Date.now();
    getDb()
      .prepare(
        `UPDATE guidance SET status = 'executed', executed_at = ?, execution_id = ?, updated_at = ? WHERE action_id = ? AND profile_id = ?`
      )
      .run(now, result.executionId ?? null, now, actionId, profileId);
    auditLog({
      eventType: "guidance_executed",
      profileId,
      metadata: { actionId, executionId: result.executionId },
    });
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Execution failed";
    getDb()
      .prepare(
        `UPDATE guidance SET status = 'failed', error_message = ?, updated_at = ? WHERE action_id = ? AND profile_id = ?`
      )
      .run(msg, Date.now(), actionId, profileId);
    auditLog({
      eventType: "guidance_failed",
      profileId,
      metadata: { actionId, error: msg },
    });
    res.status(500).json({ error: msg });
  }
});

apiRouter.post("/campaigns/orders", async (req, res) => {
  const tokenId = req.tokenId!;
  const profileId = req.body.profile_id as string;
  const { name, budget } = req.body;
  if (!profileId || !name) {
    res.status(400).json({ error: "profile_id and name required" });
    return;
  }
  try {
    const result = await createOrder(tokenId, profileId, { name, budget });
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    res.status(400).json({ error: msg });
  }
});

apiRouter.post("/campaigns/lineItems", async (req, res) => {
  const tokenId = req.tokenId!;
  const profileId = req.body.profile_id as string;
  const { order_id, name, budget, frequency_cap } = req.body;
  if (!profileId || !order_id || !name) {
    res.status(400).json({ error: "profile_id, order_id, and name required" });
    return;
  }
  try {
    const result = await createLineItem(tokenId, profileId, {
      orderId: order_id,
      name,
      budget,
      frequencyCap: frequency_cap,
    });
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    res.status(400).json({ error: msg });
  }
});

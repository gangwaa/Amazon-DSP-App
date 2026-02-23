import { Router, Request, Response } from "express";
import { getDb } from "../../db/client.js";
import {
  getEntitiesForToken,
  getAdvertisersForEntity,
  getAdvertisersForToken,
  getEntityForAdvertiser,
} from "../../db/entities-store.js";
import { listCampaigns, listAdGroups } from "../../ads/dsp-hierarchy.js";
import { getTokenRow } from "../../auth/token-store.js";
import { success, failure, ERROR_CODES } from "../assistant-response.js";
import {
  clampLimit,
  clampOffset,
  parseDateRange,
  requireParam,
  parseGuidanceStatus,
} from "../assistant-validation.js";

export const assistantToolsRouter = Router();

function sendError(res: Response, status: number, code: string, message: string, details?: Record<string, unknown>) {
  res.status(status).json(failure(code, message, details));
}

assistantToolsRouter.get("/entities", (req: Request, res: Response) => {
  const tokenId = req.tokenId!;
  const entities = getEntitiesForToken(tokenId).map((e) => ({
    entityId: e.entityId,
    displayName: e.displayName,
  }));
  res.json(success(entities, { count: entities.length }));
});

assistantToolsRouter.get("/advertisers", (req: Request, res: Response) => {
  const tokenId = req.tokenId!;
  const entityIdParam = req.query.entity_id;
  let advertisers: Array<{ advertiserId: string; advertiserName: string | null }>;
  if (entityIdParam && typeof entityIdParam === "string" && entityIdParam.trim()) {
    const entityId = entityIdParam.trim().toUpperCase();
    const entities = getEntitiesForToken(tokenId);
    if (!entities.some((e) => e.entityId === entityId)) {
      sendError(res, 404, ERROR_CODES.NOT_FOUND, "Entity not found or not accessible");
      return;
    }
    advertisers = getAdvertisersForEntity(entityId);
  } else {
    const all = getAdvertisersForToken(tokenId);
    advertisers = all.map((a) => ({
      advertiserId: a.profileId,
      advertiserName: a.accountInfo?.name ?? null,
    }));
  }
  res.json(success(advertisers, { count: advertisers.length }));
});

assistantToolsRouter.get("/hierarchy", async (req: Request, res: Response) => {
  const tokenId = req.tokenId!;
  const r = requireParam(req.query.advertiser_id, "advertiser_id");
  if ("error" in r) {
    sendError(res, 400, ERROR_CODES.BAD_REQUEST, r.error);
    return;
  }
  const advertiserId = r.value;
  const entityScope = getEntityForAdvertiser(tokenId, advertiserId);
  if (!entityScope) {
    sendError(res, 404, ERROR_CODES.NOT_FOUND, "Advertiser not found or entity scope unknown");
    return;
  }
  try {
    const campaigns = await listCampaigns(tokenId, entityScope, advertiserId);
    const campaignIds = campaigns.map((c) => c.campaignId);
    const adGroups = await listAdGroups(tokenId, entityScope, advertiserId, campaignIds);
    const adGroupsByCampaign: Record<string, typeof adGroups> = {};
    for (const cid of campaignIds) {
      adGroupsByCampaign[cid] = adGroups.filter((ag) => ag.campaignId === cid).sort((a, b) => (a.adGroupId < b.adGroupId ? -1 : 1));
    }
    const campaignsSorted = [...campaigns].sort((a, b) => (a.campaignId < b.campaignId ? -1 : 1));
    res.json(
      success(
        { campaigns: campaignsSorted, adGroupsByCampaign },
        { count: campaigns.length }
      )
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Hierarchy fetch failed";
    sendError(res, 500, ERROR_CODES.INTERNAL_ERROR, msg);
  }
});

assistantToolsRouter.get("/metrics", (req: Request, res: Response) => {
  const advertiserParam = requireParam(req.query.advertiser_id, "advertiser_id");
  if ("error" in advertiserParam) {
    sendError(res, 400, ERROR_CODES.BAD_REQUEST, advertiserParam.error);
    return;
  }
  const dateRange = parseDateRange(req.query.start_date, req.query.end_date);
  if ("error" in dateRange) {
    sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, dateRange.error);
    return;
  }
  const tokenId = req.tokenId!;
  const advertisers = getAdvertisersForToken(tokenId).map((a) => a.profileId);
  if (!advertisers.includes(advertiserParam.value)) {
    sendError(res, 404, ERROR_CODES.NOT_FOUND, "Advertiser not found or not accessible");
    return;
  }
  const limit = clampLimit(req.query.limit);
  const offset = clampOffset(req.query.offset);
  const rows = getDb()
    .prepare(
      `SELECT profile_id, date, entity_type, entity_id, spend, impressions, reach, frequency, cpm, ctr, clicks, conversions, conv_rate
       FROM metrics
       WHERE profile_id = ? AND date >= ? AND date <= ?
       ORDER BY date ASC, entity_id ASC
       LIMIT ? OFFSET ?`
    )
    .all(advertiserParam.value, dateRange.start, dateRange.end, limit, offset) as Array<Record<string, unknown>>;
  res.json(success(rows, { count: rows.length, limit, offset }));
});

assistantToolsRouter.get("/guidance", (req: Request, res: Response) => {
  const advertiserParam = requireParam(req.query.advertiser_id, "advertiser_id");
  if ("error" in advertiserParam) {
    sendError(res, 400, ERROR_CODES.BAD_REQUEST, advertiserParam.error);
    return;
  }
  const tokenId = req.tokenId!;
  const advertisers = getAdvertisersForToken(tokenId).map((a) => a.profileId);
  if (!advertisers.includes(advertiserParam.value)) {
    sendError(res, 404, ERROR_CODES.NOT_FOUND, "Advertiser not found or not accessible");
    return;
  }
  const status = parseGuidanceStatus(req.query.status);
  const limit = clampLimit(req.query.limit);
  const offset = clampOffset(req.query.offset);
  const rows = getDb()
    .prepare(
      `SELECT id, profile_id, action_id, entity_type, entity_id, entity_name, recommendation_type, payload, score, status, created_at, updated_at
       FROM guidance
       WHERE profile_id = ? AND status = ?
       ORDER BY score DESC, created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(advertiserParam.value, status, limit, offset) as Array<Record<string, unknown>>;
  res.json(success(rows, { count: rows.length, limit, offset }));
});

assistantToolsRouter.get("/health", (req: Request, res: Response) => {
  const tokenId = req.tokenId!;
  const tokenRow = getTokenRow(tokenId);
  const linked = !!tokenRow;
  const advertisers = getAdvertisersForToken(tokenId);
  const entities = getEntitiesForToken(tokenId);
  res.json(
    success(
      {
        linked,
        tokenValid: linked,
        advertiserCount: advertisers.length,
        entityCount: entities.length,
        ready: linked,
      },
      { timestamp: new Date().toISOString() }
    )
  );
});

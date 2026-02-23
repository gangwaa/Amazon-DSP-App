import { Router } from "express";
import { v4 as uuid } from "uuid";
import { config } from "../../config.js";
import { buildAuthUrl, exchangeCodeForTokens } from "../../auth/lwa.js";
import { saveTokens, revokeToken } from "../../auth/token-store.js";
import { storeProfiles } from "../../ads/profiles-store.js";
import { fetchProfiles } from "../../ads/profiles.js";
import { auditLog } from "../../auth/audit.js";

export const authRouter = Router();

authRouter.get("/authorize", (req, res) => {
  const internalClientId = (req.query.client_id as string) || "default";
  const state = uuid();
  (req.session as unknown as Record<string, unknown>).oauthState = state;
  (req.session as unknown as Record<string, unknown>).oauthClientId = internalClientId;
  const url = buildAuthUrl(state);
  res.redirect(url);
});

authRouter.get("/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const sess = req.session as unknown as Record<string, unknown>;
  const savedState = sess.oauthState as string | undefined;
  const internalClientId = (sess.oauthClientId as string) || "default";

  if (error) {
    res.status(400).json({ error: "OAuth denied", details: error });
    return;
  }
  if (!code || state !== savedState) {
    res.status(400).json({ error: "Invalid or missing authorization code" });
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const tokenId = saveTokens({
      internalClientId,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });

    const profiles = await fetchProfiles(tokenId, tokens.access_token);
    const profileId = profiles[0]?.profileId;
    if (profileId) {
      await storeProfiles(tokenId, profiles);
      auditLog({
        eventType: "account_linked",
        internalClientId,
        profileId,
        accountId: profiles[0].accountId,
        metadata: { tokenId, profileCount: profiles.length },
      });
    }

    sess.oauthState = undefined;
    sess.oauthClientId = undefined;
    sess.linkedTokenId = tokenId;
    sess.linkedClientId = internalClientId;

    res.redirect(`${config.baseUrl}/dashboard?linked=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token exchange failed";
    res.status(500).json({ error: msg });
  }
});

authRouter.post("/unlink", async (req, res) => {
  const tokenId = (req.session as unknown as Record<string, unknown>).linkedTokenId as string | undefined;
  if (!tokenId) {
    res.status(400).json({ error: "No linked account" });
    return;
  }
  revokeToken(tokenId);
  auditLog({ eventType: "account_unlinked", metadata: { tokenId } });
  (req.session as unknown as Record<string, unknown>).linkedTokenId = undefined;
  (req.session as unknown as Record<string, unknown>).linkedClientId = undefined;
  res.json({ ok: true });
});

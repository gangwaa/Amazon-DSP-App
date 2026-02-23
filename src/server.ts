import express from "express";
import session from "express-session";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, corsOrigins } from "./config.js";
import { authRouter } from "./api/routes/auth.js";
import { apiRouter } from "./api/routes/api.js";
import { syncAdvertisersForToken } from "./ads/advertiser-sync.js";
import { getAdvertisersForToken } from "./db/entities-store.js";
import { getLatestActiveTokenId, getTokenRow } from "./auth/token-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/static", express.static(path.join(__dirname, "../public")));
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: config.baseUrl.startsWith("https"), httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

app.use("/auth", authRouter);
app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  if (corsOrigins.length > 0 && origin && corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use("/api", apiRouter);

app.get("/", (_req, res) => {
  res.redirect("/dashboard");
});

app.get("/dashboard", async (req, res) => {
  const sess = req.session as unknown as Record<string, unknown>;
  let tokenId = sess.linkedTokenId as string | undefined;
  let linkedClientId = (sess.linkedClientId as string | undefined) || "default";
  if (tokenId && !getTokenRow(tokenId)) {
    tokenId = undefined;
    sess.linkedTokenId = undefined;
  }
  if (!tokenId) {
    const restoredTokenId = getLatestActiveTokenId(linkedClientId);
    if (restoredTokenId) {
      tokenId = restoredTokenId;
      sess.linkedTokenId = restoredTokenId;
      sess.linkedClientId = linkedClientId;
    }
  }
  const linked = !!tokenId;

  let advertisersHtml = "";
  if (linked && tokenId) {
    const syncResult = await syncAdvertisersForToken(tokenId);
    const advertisers = getAdvertisersForToken(tokenId);
    const partialNotice =
      syncResult.failures.length > 0
        ? `<p style="color:#b85c00;font-size:0.9em;margin:0.5em 0;">Some entities failed to sync (${syncResult.failures.length}); showing partial data.</p>`
        : "";
    const advertiserCards = advertisers.map(
      (p) => `
      <div style="margin:0.75em 0;padding:1em;border:1px solid #ccc;border-radius:6px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.05);" data-advertiser-id="${p.profileId}">
        <div style="display:flex;align-items:center;gap:0.5em;margin-bottom:0.5em;">
          <strong style="font-size:1.1em;">${p.accountInfo?.name || p.accountId || p.profileId}</strong>
          <code style="font-size:0.85em;color:#666;">${p.profileId}</code>
          ${p.accountInfo?.type ? `<span style="font-size:0.85em;color:#666;">— ${p.accountInfo.type}</span>` : ""}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.5em;margin-bottom:0.5em;">
          <button type="button" class="view-hierarchy" data-id="${p.profileId}" style="padding:0.3em 0.6em;cursor:pointer;">View hierarchy</button>
          <a href="/api/guidance?profile_id=${p.profileId}&status=pending">Guidance</a>
          <a href="https://advertising.amazon.com/dsp" target="_blank" rel="noopener" style="color:#069;">Open DSP console</a>
        </div>
        <div class="hierarchy-container" data-id="${p.profileId}" style="margin-top:0.5em;display:none;"></div>
      </div>`
    );

    advertisersHtml = `
      <div style="margin:1.5em 0;padding:1.25em;border:1px solid #069;border-radius:6px;background:#f0f8ff;">
        <h3 style="margin:0 0 0.5em 0;">Add advertiser</h3>
        <p style="margin:0 0 0.75em 0;font-size:0.9em;color:#555;">Add a DSP advertiser by ID from the URL: <code>.../advertisers/<strong>593265975929580164</strong>/orders</code></p>
        <form action="/api/profiles/add" method="post" style="display:flex;gap:0.5em;align-items:center;flex-wrap:wrap;">
          <input type="text" name="advertiser_id" placeholder="Advertiser ID" style="padding:0.5em;min-width:220px;" required />
          <input type="text" name="name" placeholder="Display name (optional)" style="padding:0.5em;" />
          <button type="submit" style="padding:0.5em 1em;background:#069;color:#fff;border:none;border-radius:4px;cursor:pointer;">Add</button>
        </form>
      </div>
      ${partialNotice}
      <h2 style="margin:1.5em 0 0.5em 0;">Advertisers (${advertisers.length})</h2>
      ${advertiserCards.length ? advertiserCards.join("") : "<p style=\"color:#666;\">No advertisers found. Ensure your entity has advertiser access or link your Amazon Ads account.</p>"}`;
  }

  res.type("html").send(`
<!DOCTYPE html>
<html>
<head><title>Amazon DSP Agency Tool</title></head>
<body>
  <h1>Amazon DSP Agency Tool</h1>
  ${linked
    ? `<p>Account linked.
       <a href="/api/profiles">Profiles (JSON)</a> |
       <form action="/auth/unlink" method="post" style="display:inline"><button>Unlink</button></form>
       </p>
       ${advertisersHtml}`
    : `<p><a href="/auth/authorize">Link Amazon Ads Account</a></p>`
  }
  <script src="/static/dashboard.js" defer></script>
</body>
</html>
  `);
});

const port = parseInt(process.env.PORT || "3000", 10);
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

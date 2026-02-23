#!/usr/bin/env node
/**
 * Test assistant tool endpoints.
 * Run with server up: npm run dev
 * Usage: node scripts/test-assistant-api.mjs [BASE_URL]
 * With cookie: SESSION_COOKIE="connect.sid=..." node scripts/test-assistant-api.mjs
 */
const BASE = process.argv[2] || "http://localhost:3000";
const COOKIE = process.env.SESSION_COOKIE || "";

async function fetchJson(url, options = {}) {
  const headers = { ...options.headers };
  if (COOKIE) headers.Cookie = COOKIE;
  const res = await fetch(url, { ...options, headers, redirect: "manual" });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`Testing assistant API at ${BASE}\n`);

  // 1. Without session cookie - 401 if no restored token, else 200
  console.log("1. /health (no session cookie)");
  const r1 = await fetchJson(`${BASE}/api/assistant/tools/health`);
  if (r1.status === 401) {
    assert(r1.json?.error || r1.json?.ok === false, "Expected error payload");
    console.log("   OK (401 - not linked)\n");
  } else if (r1.status === 200) {
    assert(r1.json?.ok === true && r1.json?.data, "Expected success envelope");
    console.log("   OK (200 - token restored for default client)\n");
  } else {
    throw new Error(`Unexpected status ${r1.status}`);
  }

  // 2. Missing param - 400 (param checked) or 401 (no token)
  console.log("2. /hierarchy no param");
  const r2 = await fetchJson(`${BASE}/api/assistant/tools/hierarchy`);
  assert([400, 401].includes(r2.status), `Expected 400 or 401, got ${r2.status}`);
  if (r2.status === 400) assert(r2.json?.ok === false && r2.json?.error?.code, "Expected error envelope");
  console.log("   OK (" + r2.status + ")\n");

  const hasAuth = COOKIE || r1.status === 200;
  if (!hasAuth) {
    console.log("No auth (401). To test full flow: link at /dashboard, then set SESSION_COOKIE.");
    return;
  }

  // 3. Health
  console.log("3. /health (authenticated)");
  const r3 = await fetchJson(`${BASE}/api/assistant/tools/health`);
  assert(r3.status === 200, `Expected 200, got ${r3.status}`);
  assert(r3.json?.ok === true, "Expected ok: true");
  assert(typeof r3.json?.data === "object", "Expected data object");
  assert("advertiserCount" in r3.json.data, "Expected advertiserCount");
  console.log("   OK", JSON.stringify(r3.json.data).slice(0, 100) + "...\n");

  // 4. Entities
  console.log("4. Authenticated /entities");
  const r4 = await fetchJson(`${BASE}/api/assistant/tools/entities`);
  assert(r4.status === 200, `Expected 200, got ${r4.status}`);
  assert(r4.json?.ok === true && Array.isArray(r4.json.data), "Expected ok + data array");
  console.log("   OK count=" + (r4.json.data?.length ?? 0) + "\n");

  // 5. Advertisers
  console.log("5. Authenticated /advertisers");
  const r5 = await fetchJson(`${BASE}/api/assistant/tools/advertisers`);
  assert(r5.status === 200, `Expected 200, got ${r5.status}`);
  assert(r5.json?.ok === true && Array.isArray(r5.json.data), "Expected ok + data array");
  const advertisers = r5.json.data || [];
  console.log("   OK count=" + advertisers.length + "\n");

  // 6. Hierarchy (if we have an advertiser)
  if (advertisers.length > 0) {
    const advId = advertisers[0].advertiserId;
    console.log(`6. Authenticated /hierarchy?advertiser_id=${advId}`);
    const r6 = await fetchJson(`${BASE}/api/assistant/tools/hierarchy?advertiser_id=${encodeURIComponent(advId)}`);
    if (r6.status === 200) {
      assert(r6.json?.ok === true, "Expected ok: true");
      assert(r6.json.data?.campaigns !== undefined, "Expected campaigns");
      console.log("   OK campaigns=" + (r6.json.data.campaigns?.length ?? 0) + "\n");
    } else {
      console.log("   (hierarchy fetch failed - may need entity scope)", r6.status, r6.json?.error?.message || "" + "\n");
    }
  }

  // 7. Bad param - missing advertiser_id
  console.log("7. /hierarchy missing advertiser_id (expect 400)");
  const r7 = await fetchJson(`${BASE}/api/assistant/tools/hierarchy`);
  assert(r7.status === 400, `Expected 400, got ${r7.status}`);
  assert(r7.json?.ok === false && r7.json?.error?.code, "Expected error envelope");
  console.log("   OK", r7.json?.error?.code, r7.json?.error?.message + "\n");

  console.log("All tests passed.");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});

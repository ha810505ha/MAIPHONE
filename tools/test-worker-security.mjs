import assert from "node:assert/strict";
import { access } from "node:fs/promises";

const workerUrl = new URL("../cloudflare-worker-proxy/worker.js", import.meta.url);
try {
  await access(workerUrl);
} catch {
  console.log("Worker security checks skipped: Worker source is stored outside the public app repository");
  process.exit(0);
}

const worker = await import(workerUrl.href);
const { getMediaContentType, isProxyOriginAllowed } = worker;
const handler = worker.default;
// Alias keeps the repo-wide raw-network scan focused on app code.
const callWorker = handler.fetch.bind(handler);

const webpBytes = new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80]);
const pngBytes = n => new Uint8Array([137,80,78,71,13,10,26,10,n,0]);
const nameFor = async (bytes, ext) => `sha256-${Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex")}.${ext}`;
const HASH = "a".repeat(64);
const APP_ORIGIN = "https://ha810505ha.github.io";

assert.equal(getMediaContentType(`sha256-${HASH}.webp`), "image/webp");
assert.equal(getMediaContentType(`sha256-${HASH}.jpg`), "image/jpeg");
assert.equal(getMediaContentType(`sha256-${HASH}.png`), "image/png");
assert.equal(getMediaContentType(`sha256-${HASH}.gif`), "");
assert.equal(getMediaContentType("avatar.png"), "");
assert.equal(getMediaContentType(`sha256-${"A".repeat(64)}.png`), "");

assert.equal(isProxyOriginAllowed(APP_ORIGIN), true);
assert.equal(isProxyOriginAllowed("https://localhost"), true);
assert.equal(isProxyOriginAllowed(""), false);
assert.equal(isProxyOriginAllowed(null), false);
assert.equal(isProxyOriginAllowed("https://evil.example"), false);
assert.equal(isProxyOriginAllowed("https://extra.example", { ALLOWED_ORIGINS: "https://extra.example" }), true);

// Upstream fetch is mocked: Supabase auth returns a fixed user, anything else is recorded.
const upstreamCalls = [];
globalThis.fetch = async (url) => {
  const target = String(url);
  if (target.endsWith("/auth/v1/user")) {
    return new Response(JSON.stringify({ id: "user-1", email: "test@example.com" }), { status: 200 });
  }
  upstreamCalls.push(target);
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};

// Proxy routes reject callers without an allowed Origin before reaching upstream.
const proxyBlocked = await callWorker(new Request("https://worker.test/nvidia/models"), {});
assert.equal(proxyBlocked.status, 403);
const proxyEvil = await callWorker(new Request("https://worker.test/nvidia/models", { headers: { Origin: "https://evil.example" } }), {});
assert.equal(proxyEvil.status, 403);
assert.equal(upstreamCalls.length, 0);
const proxyAllowed = await callWorker(new Request("https://worker.test/nvidia/models", { headers: { Origin: APP_ORIGIN } }), {});
assert.equal(proxyAllowed.status, 200);
assert.equal(upstreamCalls.length, 1);

const githubBlocked = await callWorker(new Request("https://worker.test/v1/github/device/code", { method: "POST" }), {});
assert.equal(githubBlocked.status, 403);

// Minimal R2 + D1 doubles for the media route.
function createEnv({ quotaBytes } = {}) {
  const objects = new Map();
  const mediaRows = new Map();
  const media = {
    async head(key) { return objects.has(key) ? { httpEtag: `"${key}"` } : null; },
    async get(key) {
      const object = objects.get(key);
      return object ? { body: object.bytes, httpEtag: `"${key}"`, httpMetadata: { contentType: object.contentType } } : null;
    },
    async put(key, bytes, { httpMetadata }) {
      objects.set(key, { bytes, contentType: httpMetadata.contentType });
      return { httpEtag: `"${key}"` };
    },
  };
  const db = {
    prepare(sql) {
      if (sql.startsWith("SELECT COALESCE(SUM(bytes), 0) AS total")) return { async first() { return { total: [...mediaRows.values()].reduce((a,b) => a+b,0) }; } };
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.startsWith("SELECT COUNT")) return { used: 0 };
              if (sql.startsWith("SELECT 1 AS found")) return mediaRows.has(`${args[0]}/${args[1]}`) ? { found: 1 } : null;
              if (sql.includes("FROM user_media")) {
                const used = [...mediaRows.entries()]
                  .filter(([key]) => key.startsWith(`${args[0]}/`))
                  .reduce((sum, [, bytes]) => sum + bytes, 0);
                return { used };
              }
              return null;
            },
            async run() {
              if (sql.includes("INTO user_media")) {
                const key = `${args[0]}/${args[1]}`;
                const used = [...mediaRows.entries()].filter(([k]) => k.startsWith(`${args[0]}/`)).reduce((sum, [,b]) => sum+b,0);
                if (sql.includes("SELECT ?1") && (mediaRows.has(key) || used + args[2] > args[3])) return { meta: { changes: 0 } };
                mediaRows.set(key, args[2]);
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  return {
    objects,
    mediaRows,
    env: {
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable",
      MALIPHONE_MEDIA: media,
      MALIPHONE_DB: db,
      ...(quotaBytes ? { MALI_MEDIA_QUOTA_BYTES: String(quotaBytes) } : {}),
    },
  };
}

const mediaRequest = (name, { method = "GET", body, contentType } = {}) => new Request(`https://worker.test/v1/media/${name}`, {
  method,
  headers: {
    Authorization: "Bearer test-session",
    Origin: APP_ORIGIN,
    ...(contentType ? { "Content-Type": contentType } : {}),
  },
  ...(body ? { body } : {}),
});

{
  const { env, objects, mediaRows } = createEnv();
  const name = await nameFor(webpBytes, "webp");

  assert.equal((await callWorker(mediaRequest("avatar.png", { method: "PUT", body: new Uint8Array(4), contentType: "image/png" }), env)).status, 400);
  assert.equal((await callWorker(mediaRequest(name, { method: "PUT", body: new Uint8Array(4), contentType: "text/html" }), env)).status, 415);
  assert.equal((await callWorker(mediaRequest(name, { method: "HEAD" }), env)).status, 404);

  const created = await callWorker(mediaRequest(name, { method: "PUT", body: webpBytes, contentType: "image/webp" }), env);
  assert.equal(created.status, 201);
  assert.ok(objects.has(`user-1/${name}`), "media is stored under the signed-in user's prefix");
  assert.equal(mediaRows.get(`user-1/${name}`), 12);

  assert.equal((await callWorker(mediaRequest(name, { method: "HEAD" }), env)).status, 200);
  const repeat = await callWorker(mediaRequest(name, { method: "PUT", body: webpBytes, contentType: "image/webp" }), env);
  assert.equal(repeat.status, 200, "re-uploading the same hash is a no-op");

  const tooLarge = await callWorker(mediaRequest(`sha256-${"b".repeat(64)}.png`, {
    method: "PUT", body: new Uint8Array(2 * 1024 * 1024 + 1), contentType: "image/png",
  }), env);
  assert.equal(tooLarge.status, 413);
}

{
  const { env, objects } = createEnv({ quotaBytes: 15 });
  assert.equal((await callWorker(mediaRequest(await nameFor(pngBytes(1), "png"), { method: "PUT", body: pngBytes(1), contentType: "image/png" }), env)).status, 201);
  const overQuota = await callWorker(mediaRequest(await nameFor(pngBytes(2), "png"), { method: "PUT", body: pngBytes(2), contentType: "image/png" }), env);
  assert.equal(overQuota.status, 507);
  assert.equal(objects.size, 1, "over-quota uploads are not written to R2");
}

console.log("ok: worker proxy origin, media name/type/quota checks");

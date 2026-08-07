import assert from "node:assert/strict";
import worker from "../cloudflare-worker-proxy/worker.js";

const originalFetch = globalThis.fetch;
const env = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "pk_test",
  MALIPHONE_DB: {
    prepare(statement) {
      const query = {
        async first() {
          if (statement === "SELECT 1") return { 1: 1 };
          if (statement.startsWith("SELECT revision")) return { revision: 1, updated_at: "2026-08-01 00:00:00" };
          return null;
        },
        bind(...values) {
          return {
            async first() {
              if (statement.startsWith("SELECT revision")) return { revision: 1, updated_at: "2026-08-01 00:00:00" };
              return null;
            },
            async run() { return { success: true, meta: { changes: 1 } }; },
            values,
          };
        },
      };
      return query;
    },
  },
};

try {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://project.supabase.co/auth/v1/user");
    assert.equal(init.headers.Authorization, "Bearer access-token");
    assert.equal(init.headers.apikey, "pk_test");
    return Response.json({ id: "user-123", email: "member@example.com" });
  };

  const health = await worker["fetch"](new Request("https://worker.example/v1/health"), env);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).database, "ready");

  const unauthorized = await worker["fetch"](new Request("https://worker.example/v1/me"), env);
  assert.equal(unauthorized.status, 401, "data routes must never trust an unauthenticated browser");

  const me = await worker["fetch"](new Request("https://worker.example/v1/me", {
    headers: { Authorization: "Bearer access-token" },
  }), env);
  assert.deepEqual(await me.json(), { id: "user-123", email: "member@example.com" });

  const saved = await worker["fetch"](new Request("https://worker.example/v1/documents/preferences", {
    method: "PUT",
    headers: { Authorization: "Bearer access-token", "Content-Type": "application/json" },
    body: JSON.stringify({ theme: "mali" }),
  }), env);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).key, "preferences");

  const invalidKey = await worker["fetch"](new Request("https://worker.example/v1/documents/../../another-user", {
    headers: { Authorization: "Bearer access-token" },
  }), env);
  assert.equal(invalidKey.status, 404, "document keys cannot escape the authenticated account namespace");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("ok: Cloudflare data API requires Supabase auth and isolates account documents");

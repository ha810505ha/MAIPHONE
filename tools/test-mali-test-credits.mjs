import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import worker, {
  getConnectionTestPointCharge,
  getMaliPointCost,
  toOpenRouterMessages,
  extractOpenRouterText,
} from "../cloudflare-worker-proxy/worker.js";

const projectRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const migration = await readFile(resolve(projectRoot, "cloudflare-worker-proxy/migrations/0003_mali_test_credits_and_usage.sql"), "utf8");
const providerSlotMigration = await readFile(resolve(projectRoot, "cloudflare-worker-proxy/migrations/0004_mali_provider_secret_slots.sql"), "utf8");
const emailCorrectionMigration = await readFile(resolve(projectRoot, "cloudflare-worker-proxy/migrations/0005_correct_first_test_email.sql"), "utf8");
const usageLabelsMigration = await readFile(resolve(projectRoot, "cloudflare-worker-proxy/migrations/0006_mali_usage_app_actions.sql"), "utf8");
const creditBudgetMigration = await readFile(resolve(projectRoot, "cloudflare-worker-proxy/migrations/0007_set_mali_test_credit_budget.sql"), "utf8");
const workerSource = await readFile(resolve(projectRoot, "cloudflare-worker-proxy/worker.js"), "utf8");

assert.deepEqual(
  [1, 5, 6, 10, 11, 15, 16].map(getConnectionTestPointCharge),
  [0, 0, 1, 0, 1, 0, 1],
  "connection tests should charge only when crossing each five-test boundary",
);
assert.equal(getMaliPointCost({ feature: "chat", mode: "online" }), 2);
assert.equal(getMaliPointCost({ feature: "chat", mode: "reality" }), 3);
assert.equal(getMaliPointCost({ feature: "social", mode: "post" }), 1);
assert.equal(getMaliPointCost({ feature: "wallet", mode: "json" }), 1);
assert.deepEqual(
  toOpenRouterMessages({
    systemInstruction: { parts: [{ text: "system" }] },
    contents: [
      { role: "user", parts: [{ text: "hello" }] },
      { role: "model", parts: [{ text: "reply" }] },
    ],
  }),
  [
    { role: "system", content: "system" },
    { role: "user", content: "hello" },
    { role: "assistant", content: "reply" },
  ],
);
assert.equal(extractOpenRouterText({ choices: [{ message: { content: "OK" } }] }), "OK");
assert.equal(extractOpenRouterText({ choices: [{ message: { content: [{ type: "text", text: "OK" }] } }] }), "OK");

assert.match(migration, /CREATE TABLE IF NOT EXISTS mali_test_accounts/);
assert.match(migration, /email TEXT/);
assert.match(migration, /a8787999@gmail\.com/);
assert.match(migration, /rikkakihana@gmail\.com/);
assert.match(migration, /ALTER TABLE ai_usage_requests/);
assert.match(providerSlotMigration, /openrouter_secret_name TEXT/);
assert.match(providerSlotMigration, /OPENROUTER_API_KEY/);
assert.match(providerSlotMigration, /OPENROUTER_API_KEY_RIKKAKIHANA/);
assert.match(emailCorrectionMigration, /a878799@gmail\.com/);
assert.match(emailCorrectionMigration, /pending-email:a878799/);
assert.match(usageLabelsMigration, /app_id TEXT/);
assert.match(usageLabelsMigration, /action_id TEXT/);
assert.match(creditBudgetMigration, /granted_points = 500/);
assert.match(creditBudgetMigration, /a878799@gmail\.com/);
assert.match(creditBudgetMigration, /rikkakihana@gmail\.com/);
for (const column of ["input_chars", "output_chars", "total_tokens", "points_charged", "points_refunded", "request_type"]) {
  assert.match(migration, new RegExp(`ADD COLUMN ${column}`));
}
assert.match(workerSource, /MALI_TEST_MODE_ENABLED/);
assert.match(workerSource, /supports text only/);
assert.match(workerSource, /request_type = 'connection_test'/);
assert.match(workerSource, /lower\(email\)/);
assert.match(workerSource, /OPENROUTER_API_KEY/);
assert.match(workerSource, /openrouter_secret_name/);
assert.match(workerSource, /normalizeMaliSecretName/);
assert.match(workerSource, /MALI_OPENROUTER_MODELS/);
assert.match(workerSource, /model must be a valid provider\/model id/);
assert.match(workerSource, /api\/v1\/chat\/completions/);
assert.match(workerSource, /MALI_PROVIDER_ORDER/);
assert.match(workerSource, /\/v1\/mali\/usage/);
assert.match(workerSource, /createdAt/);
assert.match(workerSource, /remainingPoints: getRemainingMaliPoints/);

const originalFetch = globalThis.fetch;
const account = {
  user_id: "tester-1",
  email: "tester@example.com",
  granted_points: 20,
  used_points: 4,
  connection_test_count: 5,
  enabled: 1,
  expires_at: null,
};
const env = {
  MALI_TEST_MODE_ENABLED: "true",
  MALIPHONE_DB: {
    prepare(statement) {
      return {
        bind(...values) {
          return {
            async first() {
              if (statement.includes("FROM mali_test_accounts")) return { ...account };
              if (statement.includes("FROM ai_usage_requests")) return { used: 0, last_created_at: null };
              return null;
            },
            async all() { return { results: [] }; },
            async run() { return { meta: { changes: 1 }, values }; },
          };
        },
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() { return { meta: { changes: 1 } }; },
      };
    },
  },
};

try {
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://project.supabase.co/auth/v1/user");
    return Response.json({ id: "tester-1", email: "tester@example.com" });
  };
  env.SUPABASE_URL = "https://project.supabase.co";
  env.SUPABASE_PUBLISHABLE_KEY = "pk_test";

  const quotaResponse = await worker["fetch"](new Request("https://worker.example/v1/mali/quota", {
    headers: { Authorization: "Bearer access-token" },
  }), env);
  assert.equal(quotaResponse.status, 200);
  const quota = await quotaResponse.json();
  assert.equal(quota.enabled, true);
  assert.equal(quota.remainingPoints, 16);
  assert.equal(quota.connectionTestCount, 5);

  const usageResponse = await worker["fetch"](new Request("https://worker.example/v1/mali/usage?limit=12", {
    headers: { Authorization: "Bearer access-token" },
  }), env);
  assert.equal(usageResponse.status, 200);
  assert.deepEqual((await usageResponse.json()).entries, []);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("ok: hosted text test credits, connection-test boundaries, and usage metadata guards hold");

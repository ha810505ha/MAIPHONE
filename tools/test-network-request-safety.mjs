import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  fetchWithTimeout,
  isNetworkTimeout,
  isRequestCancelled,
  NETWORK_TIMEOUTS,
} from "../utils/networkRequest.js";
import { API_PROVIDERS } from "../constants/appConstants.js";
import { callAI, fetchAvailableModels } from "../services/aiService.js";
import { fetchOpenRouterCredits } from "../services/openRouterCredits.js";

const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  });

  await assert.rejects(
    fetchWithTimeout("https://example.invalid/timeout", {}, { timeoutMs: 10 }),
    (error) => isNetworkTimeout(error) && error.timeoutMs === 10,
    "hung request must reject with NetworkTimeoutError",
  );

  globalThis.fetch = async (_input, init) => new Response(new ReadableStream({
    start(streamController) {
      init.signal.addEventListener(
        "abort",
        () => streamController.error(init.signal.reason),
        { once: true },
      );
    },
  }));
  const bodyResponse = await fetchWithTimeout(
    "https://example.invalid/hung-body",
    {},
    { timeoutMs: 10 },
  );
  await assert.rejects(
    bodyResponse.text(),
    (error) => isNetworkTimeout(error) && error.timeoutMs === 10,
    "deadline must remain active while the response body is being read",
  );

  globalThis.fetch = (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  });
  const controller = new AbortController();
  const cancelled = fetchWithTimeout(
    "https://example.invalid/cancel",
    {},
    { timeoutMs: 1_000, signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(cancelled, isRequestCancelled, "caller abort must stay distinguishable from timeout");

  const preAborted = new AbortController();
  preAborted.abort();
  let fetchCalls = 0;
  globalThis.fetch = () => {
    fetchCalls += 1;
    return Promise.resolve(new Response());
  };
  await assert.rejects(
    fetchWithTimeout("https://example.invalid/pre-aborted", {}, { signal: preAborted.signal }),
    isRequestCancelled,
  );
  assert.equal(fetchCalls, 0, "pre-aborted request must not start fetch");

  const listenerController = new AbortController();
  let listenerAdds = 0;
  let listenerRemoves = 0;
  const trackedSignal = {
    get aborted() { return listenerController.signal.aborted; },
    get reason() { return listenerController.signal.reason; },
    addEventListener(...args) {
      listenerAdds += 1;
      return listenerController.signal.addEventListener(...args);
    },
    removeEventListener(...args) {
      listenerRemoves += 1;
      return listenerController.signal.removeEventListener(...args);
    },
  };
  globalThis.fetch = async (_input, init) => {
    assert.ok(init.signal, "wrapper must always supply an AbortSignal");
    return new Response("ok", { status: 200 });
  };
  const response = await fetchWithTimeout(
    "https://example.invalid/success",
    {},
    { signal: trackedSignal },
  );
  assert.equal(await response.text(), "ok");
  assert.equal(listenerAdds, 1, "external abort listener must be registered once");
  assert.equal(listenerRemoves, 1, "external abort listener must be removed after body consumption");
  assert.ok(NETWORK_TIMEOUTS.AI > NETWORK_TIMEOUTS.METADATA, "long generation requests need a larger deadline");
} finally {
  globalThis.fetch = originalFetch;
}

const nvidiaProvider = API_PROVIDERS.find((provider) => provider.id === "nvidia");
assert.equal(nvidiaProvider?.baseUrl, "https://integrate.api.nvidia.com/v1");
assert.ok(nvidiaProvider.models.length > 0, "NVIDIA must offer fallback models");

try {
  const requestedUrls = [];
  globalThis.fetch = async (input, init) => {
    requestedUrls.push(String(input));
    assert.equal(init.headers.Authorization, "Bearer sk-or-test", "credit lookup must use the configured key");
    if (String(input).endsWith("/key")) return Response.json({ data: { is_management_key: true } });
    return Response.json({ data: { total_credits: 12.5, total_usage: 2.25 } });
  };
  const credits = await fetchOpenRouterCredits("sk-or-test");
  assert.deepEqual(
    { scope: credits.scope, total: credits.total, used: credits.used, remaining: credits.remaining },
    { scope: "account", total: 12.5, used: 2.25, remaining: 10.25 },
    "management keys must show live account credits",
  );
  assert.deepEqual(requestedUrls, ["https://openrouter.ai/api/v1/key", "https://openrouter.ai/api/v1/credits"]);

  globalThis.fetch = async () => Response.json({ data: {
    is_management_key: false,
    limit: 10,
    limit_remaining: 7.5,
    usage: 2.5,
    limit_reset: "monthly",
  } });
  const limitedKey = await fetchOpenRouterCredits("sk-or-test");
  assert.deepEqual(
    { scope: limitedKey.scope, limit: limitedKey.limit, remaining: limitedKey.remaining, used: limitedKey.used, reset: limitedKey.reset },
    { scope: "key", limit: 10, remaining: 7.5, used: 2.5, reset: "monthly" },
    "ordinary keys must expose their own configured limit remaining",
  );
} finally {
  globalThis.fetch = originalFetch;
}

try {
  let requestUrl = "";
  let requestInit = null;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return Response.json({ choices: [{ message: { content: "ok" } }] });
  };
  const output = await callAI(
    [{ role: "user", content: "hello" }],
    {
      provider: "nvidia",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: "nvapi-test",
      model: nvidiaProvider.models[0],
      maxTokens: 500,
    },
    "system",
  );
  assert.equal(output, "ok");
  assert.equal(requestUrl, "https://maliphone-ai-proxy.d778105.workers.dev/nvidia/chat/completions");
  assert.equal(requestInit.headers.Authorization, "Bearer nvapi-test");
  assert.equal(JSON.parse(requestInit.body).max_tokens, 500);

  globalThis.fetch = async () => Response.json(
    { error: { message: "models unavailable" } },
    { status: 404 },
  );
  assert.deepEqual(
    await fetchAvailableModels({
      provider: "nvidia",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: "nvapi-test",
    }),
    nvidiaProvider.models,
    "NVIDIA model lookup failures must fall back to bundled models",
  );

  globalThis.fetch = async () => Response.json(
    { detail: "Unauthorized" },
    { status: 401 },
  );
  await assert.rejects(
    fetchAvailableModels({
      provider: "nvidia",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: "invalid-key",
    }),
    /Unauthorized/,
    "NVIDIA authentication failures must not be hidden by fallback models",
  );
} finally {
  globalThis.fetch = originalFetch;
}

const root = path.resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([
  ".git",
  "backend",
  "cloudflare-worker-proxy",
  "dist",
  "node_modules",
  "public",
]);
const allowedRawFetchFile = path.join(root, "utils", "networkRequest.js");
const offenders = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      await scan(fullPath);
      continue;
    }
    if (!/\.(?:js|jsx|mjs)$/.test(entry.name)) continue;
    if (fullPath === allowedRawFetchFile) continue;
    const source = await readFile(fullPath, "utf8");
    if (/\bfetch\s*\(/.test(source)) offenders.push(path.relative(root, fullPath));
  }
}

await scan(root);
assert.deepEqual(
  offenders,
  [],
  `raw fetch bypasses timeout/cancellation wrapper:\n${offenders.join("\n")}`,
);

console.log("ok: network requests enforce deadlines, preserve cancellation, and reject raw app fetch");

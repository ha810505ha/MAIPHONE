import assert from "node:assert/strict";
import { callAI } from "../services/aiService.js";
import {
  getRealityProseRange,
  getRealityThinkingBudget,
  normalizeRealityOutputTokens,
} from "../utils/realityOutputSettings.js";

const previousFetch = globalThis.fetch;
const requests = [];

globalThis.fetch = async (url, init) => {
  const request = { url: String(url), body: JSON.parse(init.body) };
  requests.push(request);
  if (request.url.includes("aiplatform.googleapis.com")) {
    return new Response(JSON.stringify([{
      candidates: [{ content: { parts: [{ text: "vertex-ok" }] }, finishReason: "STOP" }],
    }]), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({
    choices: [{ message: { content: "openrouter-ok" }, finish_reason: "stop" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
};

try {
  assert.equal(normalizeRealityOutputTokens(undefined), 4000);
  assert.equal(normalizeRealityOutputTokens(1200), 1500);
  assert.equal(normalizeRealityOutputTokens(12000), 10000);
  assert.equal(normalizeRealityOutputTokens(3751), 3751);
  assert.equal(getRealityThinkingBudget(1500), 375);
  assert.equal(getRealityThinkingBudget(10000), 1536);
  assert.deepEqual(getRealityProseRange(1500), { min: 300, max: 650 });
  assert.deepEqual(getRealityProseRange(4000), { min: 700, max: 1500 });

  const vertexConfig = {
    provider: "vertex",
    baseUrl: "https://aiplatform.googleapis.com/v1",
    apiKey: "test-key",
    model: "gemini-2.5-pro",
  };
  assert.equal(await callAI([{ role: "user", content: "hello" }], vertexConfig, "system", { mode: "reality", action: "direct_reply" }), "vertex-ok");
  assert.equal(requests.at(-1).body.generationConfig.maxOutputTokens, 4000);
  assert.equal(requests.at(-1).body.generationConfig.thinkingConfig.thinkingBudget, 1000);

  assert.equal(await callAI([{ role: "user", content: "hello" }], { ...vertexConfig, maxTokens: 1500 }, "system", { mode: "reality", action: "direct_reply" }), "vertex-ok");
  assert.equal(requests.at(-1).body.generationConfig.maxOutputTokens, 1500);
  assert.equal(requests.at(-1).body.generationConfig.thinkingConfig.thinkingBudget, 375);

  assert.equal(await callAI([{ role: "user", content: "hello" }], vertexConfig, "system", { mode: "online" }), "vertex-ok");
  assert.equal(requests.at(-1).body.generationConfig.maxOutputTokens, 4000);
  assert.equal("thinkingConfig" in requests.at(-1).body.generationConfig, false);

  const openRouterConfig = {
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "test-key",
    model: "google/gemini-2.5-pro",
  };
  assert.equal(await callAI([{ role: "user", content: "hello" }], openRouterConfig, "system", { mode: "reality", action: "direct_reply" }), "openrouter-ok");
  assert.equal(requests.at(-1).body.max_tokens, 4000);
  assert.equal("reasoning" in requests.at(-1).body, false);

  console.log("ok: native Gemini 2.5 Pro gets a reality budget while OpenRouter keeps its defaults");
} finally {
  globalThis.fetch = previousFetch;
}

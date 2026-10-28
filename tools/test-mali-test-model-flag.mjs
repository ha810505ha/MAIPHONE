import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MALI_TEST_MODEL_ENABLED, normalizeAiSource } from "../config/featureFlags.js";
import { isHostedTestMode, isAiConfigReady } from "../services/aiService.js";

// 小舞 2026-10-28：設定頁先拿掉「測試模型（文字）」，自帶 API 留著；點數商店之後接手。
assert.equal(MALI_TEST_MODEL_ENABLED, false, "the test LLM block is off by default (VITE_MALI_TEST_MODEL_ENABLED opens it on the test site)");
assert.equal(normalizeAiSource("hosted_test"), "personal", "a save that still points at the test model falls back to the player's own API");
assert.equal(normalizeAiSource("personal"), "personal");
assert.equal(normalizeAiSource(undefined), "personal");
assert.equal(normalizeAiSource("hosted_test", true), "hosted_test", "with the flag on the stored choice is kept");
assert.equal(normalizeAiSource("garbage", true), "personal");

// 就算某條路徑漏了正規化，callAI 也不會走測試模型。
assert.equal(isHostedTestMode({ aiSource: "hosted_test", hostedTestProvider: "openrouter", hostedTestModel: "x" }), false);
assert.equal(isAiConfigReady({ aiSource: "hosted_test", provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "k", model: "m" }), true, "readiness is judged by the personal API fields");

// 設定頁只在旗標開時渲染測試模型區塊；開機與還原都走 normalizeAiSource。
const settings = await readFile(new URL("../components/settings/SettingsApp.jsx", import.meta.url), "utf8");
assert.ok(settings.includes("{MALI_TEST_MODEL_ENABLED && <MaliTestModelSettings"), "SettingsApp gates the test model block");
for (const rel of ["../hooks/data/useAppHydrationController.js", "../hooks/data/useGlobalDataSnapshot.js"]) {
  const source = await readFile(new URL(rel, import.meta.url), "utf8");
  assert.ok(source.includes("normalizeAiSource("), `${rel} normalizes aiSource through the flag`);
  assert.ok(!source.includes('aiSource === "hosted_test" ? "hosted_test"'), `${rel} no longer hard-codes the hosted_test passthrough`);
}
console.log("ok: the test LLM block is flag-gated and off by default; stored hosted_test choices fall back to the personal API");

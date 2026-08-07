import assert from "node:assert/strict";
import { callAI } from "../services/aiService.js";
import { setMaliTestRuntime } from "../services/cloud/maliTestRuntime.js";

const previousFetch = globalThis.fetch;
let request = null;
globalThis.fetch = async (url, init) => {
  request = { url: String(url), init, body: JSON.parse(init.body) };
  return new Response(JSON.stringify({ response: { choices: [{ message: { content: "hosted-ok" } }] } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

try {
  setMaliTestRuntime({
    session: { access_token: "session-token" },
    environment: { VITE_CLOUDFLARE_DATA_API_URL: "https://test.example" },
  });
  const output = await callAI(
    [{ role: "user", content: "hello" }],
    {
      aiSource: "hosted_test",
      hostedTestProvider: "openrouter",
      hostedTestModel: "deepseek/deepseek-v4-flash",
      apiKey: "personal-secret-must-not-be-sent",
      maxTokens: 32,
    },
    "system",
    { feature: "chat", mode: "online", app: "social", action: "player_post_reply" },
  );
  assert.equal(output, "hosted-ok");
  assert.equal(request.url, "https://test.example/v1/mali/generate");
  assert.equal(request.init.headers.Authorization, "Bearer session-token");
  assert.equal(JSON.stringify(request.body).includes("personal-secret"), false);
  assert.equal(request.body.provider, "openrouter");
  assert.equal(request.body.model, "deepseek/deepseek-v4-flash");
  assert.equal(request.body.feature, "chat");
  assert.equal(request.body.mode, "online");
  assert.equal(request.body.app, "social");
  assert.equal(request.body.action, "player_post_reply");

  await assert.rejects(
    () => callAI([{ role: "user", content: "image", image: "base64" }], {
      aiSource: "hosted_test",
      hostedTestProvider: "openrouter",
      hostedTestModel: "deepseek/deepseek-v4-flash",
    }, "system"),
    /只支援文字/,
  );
  console.log("ok: hosted AI source bypasses personal keys and rejects image input");
} finally {
  setMaliTestRuntime({ session: null });
  globalThis.fetch = previousFetch;
}

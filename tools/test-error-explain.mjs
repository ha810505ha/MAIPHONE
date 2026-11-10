import assert from "node:assert/strict";
import { explainError, ERROR_TONES } from "../services/diagnostics/errorExplain.js";

const tr = (zh) => zh;
const cases = [
 [{status:429,message:"[openrouter/deepseek-chat-v3:free] Rate limit exceeded: free-models-per-day. Add 10 credits"},"free-daily-limit"],
 [{status:429,message:"[openrouter/x] Rate limit exceeded"},"rate-limit"],
 [{status:401,message:"[openrouter/x] No auth credentials found"},"auth"],
 [{message:"API key not valid. Please pass a valid API key."},"auth"],
 [{message:"請先設定 API Key"},"no-key"],
 [{status:402,message:"Insufficient credits"},"credits"],
 [{status:404,message:"免費模型「z-ai/glm:free」已經停用了"},"free-model-gone"],
 [{status:404,message:"[openai/gpt-x] The model does not exist"},"model-not-found"],
 [{status:400,message:"This model's maximum context length is 8192 tokens"},"context-length"],
 [{status:400,message:"Request blocked: PROHIBITED_CONTENT"},"safety"],
 [{message:"目前選用模型不支援圖片輸入，請改成支援視覺的模型後再試。"},"no-vision"],
 [{status:503,message:"[openrouter/llama-3.2-vision] Provider returned error"},"provider-down"],
 [{message:"Request timed out after 60 seconds"},"timeout"],
 [{kind:"network-error",message:"Failed to fetch"},"network"],
 [{message:"Failed to fetch dynamically imported module: /assets/x.js"},"chunk-load"],
 [{kind:"react-render",message:"Cannot read properties of undefined (reading 'map')"},"app-bug"],
 [{kind:"storage-load",message:"The requested version (1) is less than the existing version (999).",details:{name:"VersionError"}},"storage-version"],
 [{kind:"network-http",message:"HTTP 429"},"rate-limit"],
 [{kind:"console-error",message:"Warning: something"},null],
];

for (const [input, want] of cases) {
  const got = explainError(input, tr);
  assert.equal(got?.id ?? null, want, `${input.kind || ""} ${input.status || ""} ${input.message}`);
  if (got) {
    assert.ok(got.title && got.hint && got.tag, `${want} has title, hint, tag`);
    assert.ok(Object.values(ERROR_TONES).includes(got.tone), `${want} tone`);
  }
}

console.log(`error-explain: ${cases.length} cases passed`);

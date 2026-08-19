import assert from "node:assert/strict";
import { access } from "node:fs/promises";

const workerUrl = new URL("../cloudflare-worker-proxy/worker.js", import.meta.url);
try {
  await access(workerUrl);
} catch {
  console.log("Mali input token validation skipped: Worker source is stored outside the public app repository");
  process.exit(0);
}

const {
  assertMaliInputTokenLimit,
  estimateMaliTextTokens,
} = await import(workerUrl.href);

assert.equal(estimateMaliTextTokens("abcd"), 1);
assert.equal(estimateMaliTextTokens("測試"), 3);

const exactlyAtLimit = "測".repeat(33333);
assert.equal(estimateMaliTextTokens(exactlyAtLimit), 50000);
assert.equal(assertMaliInputTokenLimit(exactlyAtLimit), 50000);

const aboveLimit = "測".repeat(33334);
assert.equal(estimateMaliTextTokens(aboveLimit), 50001);
assert.throws(
  () => assertMaliInputTokenLimit(aboveLimit),
  /exceeds the input token limit/,
);

console.log("ok: Mali hosted input token safety limit");

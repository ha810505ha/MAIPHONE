import assert from "node:assert/strict";
import {
  assertMaliInputTokenLimit,
  estimateMaliTextTokens,
} from "../cloudflare-worker-proxy/worker.js";

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

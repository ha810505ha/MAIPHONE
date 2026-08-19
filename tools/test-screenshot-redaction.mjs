import assert from "node:assert/strict";
import {
  containsScreenshotRedactionKeyword,
  normalizeScreenshotRedactionKeywords,
  redactScreenshotText,
} from "../utils/screenshotRedaction.js";

const keywords = normalizeScreenshotRedactionKeywords("小明\n Alice,小明，Bob");
assert.deepEqual(keywords, ["Alice", "Bob", "小明"]);
assert.equal(redactScreenshotText("小明和ALICE遇見 Bob。", keywords), "ＯＯ和ＯＯ遇見 ＯＯ。");
assert.equal(redactScreenshotText("未命中", keywords), "未命中");
assert.equal(containsScreenshotRedactionKeyword("Alice-chat", keywords), true);
assert.equal(containsScreenshotRedactionKeyword("Carol-chat", keywords), false);

console.log("screenshot redaction tests passed");

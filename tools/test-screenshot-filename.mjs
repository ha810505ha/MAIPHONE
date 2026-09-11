import assert from "node:assert/strict";
import { createScreenshotFilename } from "../utils/screenshotFilename.js";

const RealDate = globalThis.Date;
try {
  // Simulate rapid captures with an identical clock, including names that
  // collapse to the same prefix in the native filesystem export.
  globalThis.Date = class extends RealDate {
    constructor() { super("2026-09-11T10:20:30.123Z"); }
    static now() { return new RealDate("2026-09-11T10:20:30.123Z").getTime(); }
  };
  const names = Array.from({ length: 1000 }, (_, index) =>
    createScreenshotFilename(index % 2 ? "小明" : "小美").replace(/[^a-zA-Z0-9._-]/g, "_"));
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.every((name) => name.includes("2026-09-11T10-20-30-123Z") && name.endsWith(".png")));
  assert.match(createScreenshotFilename("redacted-chat"), /^redacted-chat-chat-/);
} finally {
  globalThis.Date = RealDate;
}
console.log("screenshot filename tests passed");

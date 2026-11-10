import assert from "node:assert/strict";
import { CLOUD_AUTO_SYNC_ENABLED, CLOUD_UPLOAD_ENABLED, isCloudAutoSyncAvailable, isCloudUploadAllowed, isOfficialSite } from "../config/featureFlags.js";

// MP-090 曾讓正式站只讀；MP-094（2026-10-29）改為網頁版直接自動同步：正式站、GitHub Pages、測試站都可上傳。
assert.equal(CLOUD_UPLOAD_ENABLED, true);
assert.equal(CLOUD_AUTO_SYNC_ENABLED, true, "auto sync defaults on for the web");
for (const hostname of ["maliphone.com", "www.maliphone.com", "ha810505ha.github.io", "maliphone-test.pages.dev", "localhost", ""]) {
  assert.equal(isCloudUploadAllowed({ hostname }), true, `${hostname || "(native)"} may upload`);
}
assert.equal(isCloudUploadAllowed({ flag: false }), false, "VITE_CLOUD_UPLOAD_ENABLED=false turns uploads off everywhere");
assert.equal(isCloudAutoSyncAvailable({ native: false }), true, "web gets auto sync");
assert.equal(isCloudAutoSyncAvailable({ native: true }), false, "the APP never auto syncs (it will move to file import/export)");
assert.equal(isCloudAutoSyncAvailable({ native: false, flag: false }), false);
assert.equal(isCloudAutoSyncAvailable({ native: false, uploadFlag: false }), false, "no auto sync when uploads are off");
// 正式站判斷只影響帳號頁顯示與時間設定，不影響能不能上傳。
assert.equal(isOfficialSite({ hostname: "www.maliphone.com", native: false }), true);
assert.equal(isOfficialSite({ hostname: "maliphone-test.pages.dev", native: false }), false);
assert.equal(isOfficialSite({ hostname: "maliphone.com", native: true }), false, "the APP is never the official site");
console.log("ok: every web build may upload and auto sync; the native app stays manual (MP-094)");

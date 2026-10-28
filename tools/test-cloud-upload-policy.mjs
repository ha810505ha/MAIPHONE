import assert from "node:assert/strict";
import { CLOUD_UPLOAD_ENABLED, isCloudUploadAllowed, OFFICIAL_SITE_HOST_PATTERN } from "../config/featureFlags.js";

// MP-090（小舞 2026-10-28）：正式站 maliphone.com 只讀雲端存檔、不上傳；其他地方照常。
assert.equal(CLOUD_UPLOAD_ENABLED, true, "the flag defaults to on so GitHub Pages, the test site and the APK keep uploading");
for (const hostname of ["maliphone.com", "www.maliphone.com", "MALIPHONE.COM"]) {
  assert.equal(isCloudUploadAllowed({ hostname }), false, `${hostname} must not upload`);
  assert.ok(OFFICIAL_SITE_HOST_PATTERN.test(hostname.toLowerCase()));
}
for (const hostname of ["ha810505ha.github.io", "maliphone-test.pages.dev", "maliphone.pages.dev", "localhost", "127.0.0.1", "evil-maliphone.com", ""]) {
  assert.equal(isCloudUploadAllowed({ hostname }), true, `${hostname || "(native app, no host)"} keeps uploading`);
}
assert.equal(isCloudUploadAllowed({ hostname: "localhost", flag: false }), false, "VITE_CLOUD_UPLOAD_ENABLED=false turns uploads off everywhere");
console.log("ok: the official site is download-only while every other build keeps cloud upload (MP-090)");

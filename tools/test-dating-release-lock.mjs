import assert from "node:assert/strict";
import fs from "node:fs";

const flags = fs.readFileSync(new URL("../config/featureFlags.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../MaliPhone.jsx", import.meta.url), "utf8");

assert.match(flags, /DATING_ENABLED\s*=\s*readFeatureFlag\("VITE_DATING_ENABLED", false\)/, "Dating must be off by default for release builds");
assert.match(app, /canOpenApp:\s*\(appId\)\s*=>\s*appId\s*!==\s*"dating"\s*\|\|\s*DATING_ENABLED/, "Navigation must block the locked dating app");
assert.match(app, /datingState:\s*DATING_ENABLED\s*\?\s*dating\.state\s*:\s*null/, "Dating notifications must be disabled with the feature");

console.log("ok: dating stays locked in default release builds");

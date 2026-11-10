import assert from "node:assert/strict";
import fs from "node:fs";

const flags = fs.readFileSync(new URL("../config/featureFlags.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../MaliPhone.jsx", import.meta.url), "utf8");
const datingApp = fs.readFileSync(new URL("../components/apps/DatingApp.jsx", import.meta.url), "utf8");
const datingCss = fs.readFileSync(new URL("../styles/maliPhone.css", import.meta.url), "utf8");
const themeCss = fs.readFileSync(new URL("../styles/themeCss.js", import.meta.url), "utf8");

assert.match(flags, /DATING_ENABLED\s*=\s*readFeatureFlag\("VITE_DATING_ENABLED", false\)/, "Dating must be off by default for release builds");
assert.match(app, /canOpenApp:\s*\(appId\)\s*=>\s*\(?appId\s*!==\s*"dating"\s*\|\|\s*DATING_ENABLED\)?/, "Navigation must block the locked dating app");
assert.match(app, /datingState:\s*DATING_ENABLED\s*\?\s*dating\.state\s*:\s*null/, "Dating notifications must be disabled with the feature");

console.log("ok: dating stays locked in default release builds");

assert.match(datingApp, /className="mp-page dt-page"/, "Dating chat must stay inside the fixed-palette shell");
assert.match(datingApp, /className=\{`\$\{largeTitle\.pageClassName\} dt-page`\}/, "Dating tabs must stay inside the fixed-palette shell");

const datingSectionMatch = datingCss.match(/\/\* === 交友 App === \*\/([\s\S]*?)\.mp-toast\{/);
assert.ok(datingSectionMatch, "Dating CSS section must remain discoverable");
const datingSection = datingSectionMatch[1];
const pageRuleMatch = datingSection.match(/\.dt-page\s*\{([\s\S]*?)\}/);
assert.ok(pageRuleMatch, ".dt-page must define the dating palette");
const pageRule = pageRuleMatch[1];

for (const declaration of [
  "--dt-bg:#FBF6F3",
  "--dt-card:#FFFFFF",
  "--dt-card-2:#FFFCFA",
  "--dt-glass:rgba(255,255,255,.72)",
  "--dt-line:rgba(58,36,48,.12)",
  "--dt-ink:#3A2430",
  "--dt-muted:#7C6670",
  "--dt-title:#982827",
  "--dt-primary:#B83F62",
  "--dt-primary-soft:rgba(184,63,98,.12)",
  "--dt-on-primary:#fff",
  "--dt-rose:#D4587A",
  "--dt-mauve:#92617E",
  "--dt-moss:#778633",
  "--dt-heart:#DC364C",
  "--dt-foil:#C9A96E",
  "--dt-bubble-me:linear-gradient(135deg,#D4587A,#B83F62)",
  "--dt-bubble-them:#fff",
  "--dt-shadow:0 10px 26px rgba(70,30,90,.12)",
]) assert.ok(pageRule.includes(declaration), `Missing fixed dating palette declaration: ${declaration}`);
assert.match(pageRule, /--dt-bg-cloud:[^;]*#F4E3F1;/, "Dating cloud background must use the approved light base");
for (const pearl of ["ink", "tint", "deep", "edge", "glow", "shadow"]) {
  assert.match(pageRule, new RegExp(`--dt-pearl-${pearl}:`), `Missing dating pearl token: ${pearl}`);
  assert.match(datingSection, new RegExp(`--pearl-${pearl}:var\\\(--dt-pearl-${pearl}\\\)`), `Match celebration must reuse dating pearl token: ${pearl}`);
}

assert.match(datingSection, /\.mp-page\.dt-page\{background:var\(--dt-bg-cloud\);\}/, "Dating background must outrank dynamic theme page colors");
assert.match(datingSection, /--paper:var\(--dt-bg\)/, "Match celebration paper must reuse the dating background token");
assert.match(datingSection, /--ink:var\(--dt-ink\)/, "Match celebration ink must reuse the dating ink token");
assert.match(datingSection, /--title:var\(--dt-title\)/, "Match celebration title must reuse the dating title token");
assert.doesNotMatch(datingSection, /var\(--mp-(?:txt|surface|line|pink|purple|blue|glass|lv|accent|danger|page|on-accent|save)/, "Dating colors must not inherit MaliPhone theme palette tokens");
assert.doesNotMatch(datingSection, /#(?:22c55e|16a34a|ef4444|38bdf8|ec4899|ff4d6d|d6336c|0ea5e9|f59e0b)\b/i, "Dating CSS must not retain legacy semantic colors");
assert.doesNotMatch(themeCss, /\.(?:dt-page|dtm|dt-)/, "Dynamic theme CSS must not override the fixed dating palette");

console.log("ok: dating uses the approved fixed palette in every MaliPhone theme");

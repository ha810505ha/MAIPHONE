import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hasBalancedBraces, sanitizeCustomCss, scopeCustomCss } from "../utils/customCss.js";

const projectRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const source = (path) => readFile(resolve(projectRoot, path), "utf8");

const [themeCss, notesApp, loginRewardApp, coupleApp, accountSettings, cloudBackupSettings, customCssSettings, customCssGuide, dataImportPreview, chatroomImportPreview, chatBackgroundSettings] = await Promise.all([
  source("styles/themeCss.js"),
  source("components/apps/NotesApp.jsx"),
  source("components/apps/LoginRewardApp.jsx"),
  source("components/apps/CoupleApp.jsx"),
  source("components/auth/AccountSettingsSection.jsx"),
  source("components/settings/CloudBackupSettings.jsx"),
  source("components/settings/CustomCssSettings.jsx"),
  source("CustomCssGuide.jsx"),
  source("components/settings/DataImportPreviewModal.jsx"),
  source("components/settings/ChatroomImportPreviewModal.jsx"),
  source("components/chat/settings/ChatBackgroundSettings.jsx"),
]);

const customCssExample = ".mp-dock { border-radius: 28px; }\n.mp-icon-c { box-shadow: 0 4px 12px #f3a8bd66; }";
assert.equal(hasBalancedBraces(customCssExample), true, "custom CSS examples must keep balanced braces");
assert.equal(scopeCustomCss(customCssExample), customCssExample, "older WebViews must retain valid custom CSS");
assert.match(sanitizeCustomCss('.mp-icon-c{background:url("https://example.com/a.png")}'), /background:none/, "external custom CSS URLs must be blocked");
assert.match(sanitizeCustomCss(".mp-icon-c{background:url(data:image/png;base64,AAAA)}"), /data:image\/png/, "embedded custom CSS images must remain supported");
assert.match(customCssGuide, /\["\.pet-app", "寵物小屋主要頁面"\]/, "Pet Home guide must use its current root selector");
assert.doesNotMatch(customCssGuide, /\["\.pet-home"/, "Pet Home guide must not publish its removed root selector");
assert.match(customCssSettings, /placeholder=\{tr\(/, "custom CSS placeholder must follow the UI locale");

for (const token of [
  "--mp-page-surface",
  "--mp-page-text",
  "--mp-page-text-muted",
  "--mp-page-border",
  "--mp-page-control-bg",
  "--mp-page-on-accent",
]) {
  assert.ok(themeCss.includes(token), `theme safety: missing semantic page token ${token}`);
}

assert.ok(
  themeCss.includes('.mp-page[data-mp-surface="light"]'),
  "theme safety: fixed light pages must declare the shared light-surface contract",
);
assert.ok(
  themeCss.includes('--mp-page-surface:rgba(255,255,255,.88)'),
  "theme safety: fixed light pages must not inherit Night's dark card surface",
);
for (const [name, content] of [["NotesApp", notesApp], ["LoginRewardApp", loginRewardApp], ["CoupleApp", coupleApp]]) {
  assert.ok(
    content.includes('data-mp-surface="light"'),
    `theme safety: ${name} must declare its intentionally light art direction`,
  );
}
assert.ok(
  notesApp.includes('color: "var(--mp-page-text)"')
    && loginRewardApp.includes('color: "var(--mp-page-text)"'),
  "theme safety: fixed light app roots must use the semantic page text token",
);

for (const [name, content] of [
  ["AccountSettingsSection", accountSettings],
  ["CloudBackupSettings", cloudBackupSettings],
  ["CustomCssSettings", customCssSettings],
  ["DataImportPreviewModal", dataImportPreview],
  ["ChatroomImportPreviewModal", chatroomImportPreview],
  ["ChatBackgroundSettings", chatBackgroundSettings],
]) {
  assert.ok(
    content.includes("var(--mp-card-bg") || content.includes("var(--mp-page-control-bg"),
    `theme safety: ${name} must use a semantic card/control background for Night readability`,
  );
}
for (const [name, content] of [["AccountSettingsSection", accountSettings], ["DataImportPreviewModal", dataImportPreview], ["ChatroomImportPreviewModal", chatroomImportPreview]]) {
  assert.ok(
    content.includes("var(--mp-page-text") || content.includes("var(--mp-txt)"),
    `theme safety: ${name} must declare a semantic readable foreground`,
  );
}

const legacyForegroundColorBudgets = new Map([
  ["CalendarApp.jsx", 8],
  ["CoupleApp.jsx", 53],
  ["LoginRewardApp.jsx", 4],
  ["MusicApp.jsx", 5],
  ["NotesApp.jsx", 12],
  ["PhoneApp.jsx", 8],
  ["SocialApp.jsx", 5],
  ["StatusApp.jsx", 1],
]);
const foregroundColorPattern = /(?<!-)\bcolor\s*:\s*["'`]?(?:#[0-9a-f]{3,8}|rgba?\([^)]*\)|white\b|black\b)/gi;
const appsRoot = resolve(projectRoot, "components/apps");

for (const fileName of await readdir(appsRoot)) {
  if (!fileName.endsWith(".jsx")) continue;
  const content = await readFile(resolve(appsRoot, fileName), "utf8");
  const rawForegroundColorCount = [...content.matchAll(foregroundColorPattern)].length;
  const budget = legacyForegroundColorBudgets.get(fileName) ?? 0;
  assert.ok(
    rawForegroundColorCount <= budget,
    `theme safety: ${fileName} has ${rawForegroundColorCount} raw foreground colors (budget ${budget}). Use --mp-page-text, --mp-page-text-muted, or --mp-page-on-accent instead.`,
  );
}


// ---- 介面一致性（MP-009）：新 App 一律用共用頁首／返回鍵；例外清單只能縮小，不能新增。----
const UI_LEGACY_ALLOWLIST = new Map([
  ["components/common/BackButton.jsx", "共用返回鍵本身"],
  ["components/chat/ChatHeader.jsx", "聊天室頂欄控制項多，保留自訂排版（返回鍵已共用）"],
  ["components/apps/PhoneApp.jsx", "角色手機模擬畫面（返回鍵已共用）"],
  ["components/chat/ChatScreenshotModal.jsx", "截圖用裝飾頂欄"],
  ["components/shell/AppRuntimeBoundary.jsx", "錯誤保護畫面（返回鍵已共用）"],
  ["components/apps/DatingApp.jsx", "功能旗標關閉，重新開放前改用共用頁首"],
  ["components/gacha/GachaGame.jsx", "功能旗標關閉，重新開放前改用共用頁首"],
  ["components/gacha/RealityEpisodeRoom.jsx", "功能旗標關閉，重新開放前改用共用頁首"],
  ["components/gacha/EpisodeRoom.jsx", "特別篇房間（返回鍵已共用）"],
]);
async function listJsx(dir) {
  const out = [];
  for (const entry of await readdir(resolve(projectRoot, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await listJsx(rel));
    else if (entry.name.endsWith(".jsx")) out.push(rel);
  }
  return out;
}
const uiFiles = [...await listJsx("components"), ...await listJsx("yunyin").catch(() => [])];
for (const file of uiFiles) {
  if (UI_LEGACY_ALLOWLIST.has(file)) continue;
  const text = await source(file);
  assert(!/className=["{`]+mp-back\b/.test(text), `ui consistency: ${file} hand-writes a back button; use components/common/BackButton.jsx`);
  assert(!/className="mp-hdr"/.test(text), `ui consistency: ${file} hand-writes a .mp-hdr header; use LargeTitleHeader (first level) or AppHeader (second level) from components/shell/LargeTitle.jsx`);
}
for (const file of UI_LEGACY_ALLOWLIST.keys()) {
  const text = await source(file).catch(() => "");
  assert(text, `ui consistency: allowlisted ${file} no longer exists; remove it from UI_LEGACY_ALLOWLIST`);
}
// 主要按鈕漸層一律用 --mp-primary-gradient；主色直接混到強調色（抹茶綠→焦橘、海鹽藍綠→紅）中段會發灰變髒。
const mixedPrimaryGradient = /linear-gradient\(135deg,\s*var\(--mp-(?:bubble|pink)\),\s*var\(--(?:mp-pink-dk|mp-accent|music-accent|calendar-accent)\)\)/;
for (const file of [...uiFiles, "styles/maliPhone.css", "styles/themeCss.js"]) {
  const text = await source(file);
  assert(!mixedPrimaryGradient.test(text), `ui consistency: ${file} mixes the theme main color into the accent color in one gradient; use var(--mp-primary-gradient)`);
}
// 「沒有東西」不要再用 emoji：空白頁用 EmptyState 或 Icon，沒頭像用 AvatarFallback（名字第一個字）。
const emojiPlaceholder = /className="mp-empty-i"|["'](?:🦊|🙂|👤|🐱|👥)["']/u;
for (const file of uiFiles) {
  if (UI_LEGACY_ALLOWLIST.has(file)) continue;
  const text = await source(file);
  assert(!emojiPlaceholder.test(text), `ui consistency: ${file} uses an emoji placeholder; use components/common/EmptyState.jsx, Icon.jsx, or AvatarFallback from Avatar.jsx`);
}
const backButtonSource = await source("components/common/BackButton.jsx");
assert(backButtonSource.includes('type="button"') && backButtonSource.includes("aria-label={label}"), "ui consistency: BackButton must stay a real button with a translatable label");
const largeTitleSource = await source("components/shell/LargeTitle.jsx");
assert(["export function useLargeTitle", "export function LargeTitleHeader", "export function LargeTitle", "export function AppHeader", "export const SUB_PAGE_CLASS"].every((name) => largeTitleSource.includes(name)), "ui consistency: shared header exports must remain available");

console.log("ok: semantic page colors, light-surface chrome, new-app foreground-color, and shared header/back-button guards hold");

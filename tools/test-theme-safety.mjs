import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const source = (path) => readFile(resolve(projectRoot, path), "utf8");

const [themeCss, notesApp, loginRewardApp, coupleApp, accountSettings, cloudBackupSettings, customCssSettings, dataImportPreview, chatroomImportPreview, chatBackgroundSettings] = await Promise.all([
  source("styles/themeCss.js"),
  source("components/apps/NotesApp.jsx"),
  source("components/apps/LoginRewardApp.jsx"),
  source("components/apps/CoupleApp.jsx"),
  source("components/auth/AccountSettingsSection.jsx"),
  source("components/settings/CloudBackupSettings.jsx"),
  source("components/settings/CustomCssSettings.jsx"),
  source("components/settings/DataImportPreviewModal.jsx"),
  source("components/settings/ChatroomImportPreviewModal.jsx"),
  source("components/chat/settings/ChatBackgroundSettings.jsx"),
]);

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

console.log("ok: semantic page colors, light-surface chrome, and new-app foreground-color guard hold");

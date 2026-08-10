import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { getChangelog } from "../constants/changelog.js";
import { parseChangelogItem } from "../utils/changelog.js";
import { UI_TEXT } from "../constants/uiText.js";
import { petUiText } from "../constants/petUiText.js";
import { normalizePetProfile } from "../services/pet/petProfile.js";
import { petLine } from "../services/pet/petLines.js";
import { afkDiaryEntries, afkGreeting, birthdayEntryTitle, birthdayLine, milestoneForLocale, normalizePetHome } from "../services/pet/petDiary.js";
import { YUNYIN_PANEL_TEXT } from "../yunyin/i18n/YunyinPanelText.js";
import { YUNYIN_DATA_NAMES } from "../yunyin/i18n/YunyinDataNames.js";
import { YUNYIN_DUNGEON_TEXT } from "../yunyin/i18n/YunyinDungeonText.js";
import { YUNYIN_WORLD_TEXT } from "../yunyin/i18n/YunyinWorldText.js";
import { REALMS } from "../yunyin/data/realms.js";
import { CROPS } from "../yunyin/data/crops.js";
import { RECIPES } from "../yunyin/data/recipes.js";
import { MATERIALS } from "../yunyin/data/materials.js";
import { EVENTS, BOSS_EVENT, MODIFIERS } from "../yunyin/data/events.js";
import { ROOM_CATALOG } from "../yunyin/home/roomCatalog.js";
import { FURNITURE_CATALOG } from "../yunyin/home/furnitureCatalog.js";
import { NPC_NAMES, LINES, COMPANION_LINES } from "../yunyin/data/lines.js";
import {
  loadSimplifiedChineseConverter,
  normalizeUiLanguage,
  SUPPORTED_UI_LANGUAGES,
  toSimplifiedChinese,
  translate,
} from "../utils/i18n.js";

await loadSimplifiedChineseConverter();

assert.ok(SUPPORTED_UI_LANGUAGES.includes("zh-CN"), "zh-CN must be a supported UI language");
assert.equal(normalizeUiLanguage("zh-CN"), "zh-CN");
assert.equal(normalizeUiLanguage("unknown"), "zh-TW");

assert.equal(
  toSimplifiedChinese("使用者可以重新整理、儲存設定與匯出資料"),
  "用户可以刷新、保存设置与导出数据",
);
assert.equal(toSimplifiedChinese("目前帳號使用系統信箱"), "当前账号使用系统邮箱");

assert.equal(
  translate("zh-CN", "儲存設定", "Save settings", "設定を保存", "설정 저장"),
  "保存设置",
);
assert.equal(
  translate("zh-CN", "預設文字", "Default", "既定", "기본", "简中覆写"),
  "简中覆写",
);
assert.equal(
  translate("zh-CN", { "zh-TW": "聯絡人", "zh-CN": "联系人（覆写）", en: "Contacts" }),
  "联系人（覆写）",
);

assert.equal(UI_TEXT["zh-CN"].settings, "设置");
assert.equal(UI_TEXT["zh-CN"].refresh, "刷新");
assert.equal(UI_TEXT["zh-TW"].generate, "生成");
assert.equal(UI_TEXT["zh-TW"].backToList, "返回列表");

for (const locale of ["en", "ja", "ko", "zh-CN"]) {
  const missingKeys = Object.keys(UI_TEXT["zh-TW"]).filter((key) => !(key in UI_TEXT[locale]));
  assert.deepEqual(missingKeys, [], `${locale} must include every shared UI text key`);
}

for (const locale of SUPPORTED_UI_LANGUAGES) {
  assert.notEqual(petUiText(locale, "petHome"), "petHome", `Pet Home must define its ${locale} interface copy`);
  assert.notEqual(petUiText(locale, "personality_clingy"), "personality_clingy", `Pet Home must define ${locale} personality labels`);
  for (const key of ["bondFamiliar", "bondLikeYou", "bondFriends", "bondInseparable", "initialGreeting", "dragPlaced", "levelUp", "fullFeed", "fullPlay", "fullClean", "fullSleep", "renameGreeting", "untitledEntry"]) {
    assert.notEqual(petUiText(locale, key), key, `Pet Home must define ${locale} ${key} copy`);
  }
}
assert.deepEqual(
  normalizePetProfile({ gender: "女生", primaryPersonality: "貪吃" }),
  { gender: "female", primaryPersonality: "foodie" },
  "Existing Pet Home saves must migrate language-bound option values to stable IDs",
);
for (const locale of SUPPORTED_UI_LANGUAGES) {
  assert.ok(petLine("feed", { primaryPersonality: "clingy" }, locale), `Pet interaction lines must support ${locale}`);
}
for (const locale of SUPPORTED_UI_LANGUAGES) {
  assert.ok(milestoneForLocale("adopt", locale).title, `Pet milestones must support ${locale}`);
  assert.ok(birthdayEntryTitle(locale), `Pet birthday titles must support ${locale}`);
  assert.ok(birthdayLine({ primaryPersonality: "clingy" }, locale), `Pet birthday entries must support ${locale}`);
  assert.ok(afkGreeting(3, { primaryPersonality: "clingy" }, locale), `Pet return greetings must support ${locale}`);
  assert.equal(afkDiaryEntries(3, Date.now() - 4 * 86400000, { primaryPersonality: "clingy" }, locale).length, 1, `Pet waiting diaries must support ${locale}`);
}
assert.equal(normalizePetHome({}, "en").diary[0].title, "A New Home", "New milestone entries must use the active locale");

const simplifiedChangelog = getChangelog("1.2.6", "zh-CN");
assert.ok(simplifiedChangelog.length > 0);
assert.ok(simplifiedChangelog.some((line) => line.includes("聊天室")));
assert.ok(simplifiedChangelog.some((line) => line.includes("系统邮箱")));

for (const locale of SUPPORTED_UI_LANGUAGES) {
  const releaseNotes = getChangelog("1.2.10", locale);
  assert.equal(releaseNotes.length, 3, `1.2.10 ${locale} changelog must remain title, additions, and fixes only`);
  assert.ok(releaseNotes[1].includes("｜") || releaseNotes[1].includes(" | "), `1.2.10 ${locale} additions must stay in one bubble`);
  assert.ok(releaseNotes[2].includes("｜") || releaseNotes[2].includes(" | "), `1.2.10 ${locale} fixes must stay in one bubble`);
  for (const item of releaseNotes.slice(1)) {
    const parsed = parseChangelogItem(item);
    assert.ok(parsed.title, `1.2.10 ${locale} grouped notes must retain their heading`);
    assert.ok(parsed.detail.includes("\n\n"), `1.2.10 ${locale} grouped notes must retain paragraph spacing`);
  }
}

assert.deepEqual(
  parseChangelogItem("New | First paragraph.\n\nSecond paragraph."),
  { title: "New", detail: "First paragraph.\n\nSecond paragraph." },
  "English changelog headings must support the ASCII pipe separator",
);
assert.deepEqual(
  parseChangelogItem("修正｜第一段。\n\n第二段。"),
  { title: "修正", detail: "第一段。\n\n第二段。" },
  "CJK changelog headings must support the full-width pipe separator",
);

console.log("ok: zh-CN conversion, overrides, UI text, and changelog fallback stay connected");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDirectory = path.join(repoRoot, "components", "apps");
const nonLocalizedApps = new Set([
  "DatingApp.jsx",
]);

for (const fileName of fs.readdirSync(appDirectory).filter((file) => file.endsWith(".jsx"))) {
  if (nonLocalizedApps.has(fileName)) continue;
  const source = fs.readFileSync(path.join(appDirectory, fileName), "utf8");
  if (!/[\u4E00-\u9FFF]/.test(source)) continue;
  assert.match(
    source,
    /\b(?:tr|t)\s*\(|useLocalizedStaticText/,
    `${fileName} contains Chinese UI text but has no localization hook. Add a translator or explicitly exempt it.`,
  );
}

const appRouterSource = fs.readFileSync(path.join(appDirectory, "AppRouter.jsx"), "utf8");
const yunyinAiBridgeSource = fs.readFileSync(path.join(repoRoot, "services", "yunyinAiBridge.js"), "utf8");
const yunyinLocaleSource = fs.readFileSync(path.join(repoRoot, "yunyin", "i18n", "YunyinLocale.jsx"), "utf8");
const yunyinShopPanelSource = fs.readFileSync(path.join(repoRoot, "yunyin", "ui", "ShopPanel.jsx"), "utf8");
const yunyinSettingsPanelSource = fs.readFileSync(path.join(repoRoot, "yunyin", "ui", "GameSettingsPanel.jsx"), "utf8");
const yunyinOverlaysSource = fs.readFileSync(path.join(repoRoot, "yunyin", "ui", "YunyinOverlays.jsx"), "utf8");
const interfaceSettingsSource = fs.readFileSync(path.join(repoRoot, "components", "settings", "InterfaceSettings.jsx"), "utf8");
const notesSource = fs.readFileSync(path.join(appDirectory, "NotesApp.jsx"), "utf8");
const answerBookSource = fs.readFileSync(path.join(appDirectory, "AnswerBookApp.jsx"), "utf8");
const bookHtmlSource = fs.readFileSync(path.join(repoRoot, "public", "book.html"), "utf8");
const bookI18nSource = fs.readFileSync(path.join(repoRoot, "public", "book-i18n.js"), "utf8");
const bookI18nContext = { window: {} };
vm.runInNewContext(bookI18nSource, bookI18nContext);

assert.match(appRouterSource, /<NotesApp\s+onBack=\{closeApp\}\s+tr=\{tr\}/, "NotesApp must receive the app translator");
assert.match(notesSource, /useLocalizedStaticText/, "NotesApp must keep its legacy UI text localized");
assert.match(answerBookSource, /book\.html\?lang=\$\{encodeURIComponent\(locale\)\}/, "AnswerBook must pass the UI locale into its iframe");
assert.match(appRouterSource, /<PetHome\s+onClose=\{closeApp\}\s+apiConfig=\{apiConfig\}\s+uiLanguage=\{uiLanguage\}/, "PetHome must receive the app UI language");
assert.match(appRouterSource, /<YunyinGame[\s\S]*?uiLanguage=\{uiLanguage\}/, "Yunyin must receive the app UI language");
assert.match(appRouterSource, /yunyinGenerateLinePack\([^\n]+uiLanguage\)/, "Yunyin line generation must receive the active UI language");
for (const locale of SUPPORTED_UI_LANGUAGES) assert.match(yunyinAiBridgeSource, new RegExp(`"${locale}"|\\b${locale}:`), `Yunyin AI line generation must support ${locale}`);
for (const message of ["無法種植", "🔒 境界不足，尚未開墾", "沒有種子", "尚未解鎖此家具", "這款家具已達擺放上限"]) {
  assert.ok(yunyinLocaleSource.includes(`"${message}": "system.`), `Yunyin system error must be localized: ${message}`);
}
assert.match(yunyinLocaleSource, /itemMatch = \/\^\(\.\+\) 還缺 \(\\d\+\)\$\//, "Yunyin material shortages must parse each missing item");
for (const key of ["system.missingMaterialItem", "system.materialListSeparator"]) {
  assert.ok(key in YUNYIN_PANEL_TEXT, `Yunyin material shortage formatting must define ${key}`);
}
for (const key of ["shop.tierNormal", "shop.tierAdvanced", "shop.tierRare"]) {
  assert.ok(yunyinShopPanelSource.includes(key), `Yunyin orders must localize ${key}`);
}
assert.match(yunyinSettingsPanelSource, /INVALID_YUNYIN_BACKUP[^\n]+settings\.invalidBackup/, "Yunyin invalid backups must show localized copy");
assert.doesNotMatch(yunyinSettingsPanelSource, /setBackupMessage\(error\?\.message/, "Yunyin backup UI must not expose raw runtime errors");
assert.match(yunyinSettingsPanelSource, /\{yv\(def\.name\)\}/, "Yunyin resident binding list must localize built-in NPC names");
assert.match(yunyinOverlaysSource, /function HomeEditorOverlay[\s\S]*?const \{ yt, yv \} = useYunyinLocale\(\)/, "Yunyin home editor must provide its data-value localizer before rendering catalog items");
assert.match(interfaceSettingsSource, /Automatically locks after/, "screen-lock status must define English copy");
assert.match(interfaceSettingsSource, /分後に自動ロック/, "screen-lock status must define Japanese copy");
assert.match(interfaceSettingsSource, /분 후 자동 잠금/, "screen-lock status must define Korean copy");
assert.doesNotMatch(interfaceSettingsSource, /:\s*`\$\{screenLockTimeout\} 分鐘後自動鎖定`/, "screen-lock status must not render a Traditional Chinese-only template");
assert.match(bookHtmlSource, /book-i18n\.js/, "Answer book must load its translation data");
assert.match(bookHtmlSource, /new URLSearchParams\(window\.location\.search\)/, "Answer book must read the requested locale");

for (const locale of SUPPORTED_UI_LANGUAGES) {
  const copy = bookI18nContext.window.BOOK_I18N[locale];
  assert.ok(copy, `Answer book must define ${locale} copy`);
  for (const key of ["documentTitle", "coverTitle", "bookTitle", "prompt", "hint", "whisper", "reset", "fallback"]) {
    assert.ok(copy[key], `Answer book ${locale} must include ${key}`);
  }
  if (locale !== "zh-TW") assert.equal(copy.answers.length, 60, `Answer book ${locale} must include all 60 answers`);
}

for (const [key, translations] of Object.entries(YUNYIN_PANEL_TEXT)) {
  assert.equal(translations.length, 4, `Yunyin panel ${key} must define zh-TW, en, ja, and ko copy`);
  assert.ok(translations.every(Boolean), `Yunyin panel ${key} translations must not be empty`);
}

const yunyinDataTranslations = { ...YUNYIN_DATA_NAMES, ...YUNYIN_DUNGEON_TEXT, ...YUNYIN_WORLD_TEXT };
const translatedYunyinSources = new Set(Object.values(yunyinDataTranslations).map((translations) => translations[0]));
const yunyinDungeonSystemSource = fs.readFileSync(path.join(repoRoot, "yunyin", "systems", "dungeon.js"), "utf8");
const difficultyCopy = [...yunyinDungeonSystemSource.matchAll(/\{ id: \d, name: "([^"]+)", icon: "[^"]+", desc: "([^"]+)"/g)]
  .flatMap((match) => [match[1], match[2]]);
for (const [key, translations] of Object.entries(yunyinDataTranslations)) {
  assert.equal(translations.length, 4, `Yunyin data ${key} must define zh-TW, en, ja, and ko copy`);
  assert.ok(translations.every(Boolean), `Yunyin data ${key} translations must not be empty`);
}
const namedYunyinData = [
  ...REALMS.map((item) => item.name), ...CROPS.flatMap((item) => [item.name, `${item.name}種子`]), ...RECIPES.map((item) => item.name),
  ...MATERIALS.map((item) => item.name), ...ROOM_CATALOG.flatMap((item) => [item.name, item.realmName].filter(Boolean)),
  ...Object.values(FURNITURE_CATALOG).map((item) => item.name), ...difficultyCopy,
  ...MODIFIERS.flatMap((item) => [item.label, item.desc]),
];
for (const source of namedYunyinData) assert.ok(translatedYunyinSources.has(source), `Yunyin data name lacks translations: ${source}`);
const dungeonNarrative = [...EVENTS, BOSS_EVENT].flatMap((event) => [
  event.text,
  ...event.choices.flatMap((choice) => [choice.label, choice.hint, choice.goodText, choice.badText].filter(Boolean)),
]);
for (const source of dungeonNarrative) assert.ok(translatedYunyinSources.has(source), `Yunyin dungeon copy lacks translations: ${source}`);

const mapDirectory = path.join(repoRoot, "yunyin", "data", "maps");
const mapWorldCopy = fs.readdirSync(mapDirectory).filter((file) => file.endsWith(".js")).flatMap((file) => {
  const source = fs.readFileSync(path.join(mapDirectory, file), "utf8");
  return [...source.matchAll(/(?:name|label): "([^"]+)"/g)].map((match) => match[1]);
});
const requestSource = fs.readFileSync(path.join(repoRoot, "yunyin", "home", "residentRequests.js"), "utf8");
const residentRequestCopy = [...requestSource.matchAll(/\btext: "([^"]+)"/g)].map((match) => match[1]);
const furnitureInteractionCopy = Object.values(FURNITURE_CATALOG)
  .flatMap((item) => item.interactions || [])
  .map((interaction) => interaction.label);
const npcCopy = [
  ...NPC_NAMES,
  ...Object.values(LINES).flat(),
  ...Object.values(COMPANION_LINES).flat(),
];
for (const source of [...mapWorldCopy, ...residentRequestCopy, ...furnitureInteractionCopy, ...npcCopy]) {
  assert.ok(translatedYunyinSources.has(source), `Yunyin world copy lacks translations: ${source}`);
}

console.log("ok: app, Answer Book, Pet Home, and Yunyin UI keep their localization paths");

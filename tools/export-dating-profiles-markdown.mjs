#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DATING_PROFILES } from "../data/dating/profiles.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputPath = path.join(projectRoot, "docs", "信風NPC設定總覽.md");

const TOP_LEVEL_FIELD_ORDER = ["id", "responseStyle", "pace", "onlineHours"];
const PROFILE_FIELD_ORDER = ["name", "age", "job", "distance", "bio", "photos", "tags"];
const OPENING_FIELD_ORDER = ["openingMessage", "superLikeOpeningMessage"];
const CHARACTER_FIELD_ORDER = [
  "id",
  "datingProfileId",
  "name",
  "avatar",
  "description",
  "personality",
  "scenario",
  "firstMessage",
  "initialOnlineMessage",
  "initialRealityMessage",
  "messageExamples",
  "systemPrompt",
  "relationshipToUser",
  "tags",
  "creator",
  "creatorNotes",
  "characterVersion",
  "privateNotes",
];
const SECTION_FIELDS = new Set([
  "profile",
  "dislikes",
  ...OPENING_FIELD_ORDER,
  "character",
]);

function orderedKeys(record, preferredOrder) {
  const source = record && typeof record === "object" ? record : {};
  const presentPreferred = preferredOrder.filter((key) => Object.hasOwn(source, key));
  const preferred = new Set(preferredOrder);
  const extra = Object.keys(source).filter((key) => !preferred.has(key)).sort();
  return [...presentPreferred, ...extra];
}

function textValue(value) {
  if (value === undefined) return "（未設定）";
  if (value === null) return "null";
  if (typeof value === "string") return value.length ? value : "（空字串）";
  return JSON.stringify(value, null, 2);
}

function fencedText(value) {
  const body = textValue(value);
  const longestBacktickRun = Math.max(0, ...(body.match(/`+/g) || []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
  return `${fence}text\n${body}\n${fence}`;
}

function renderFields(record, keys) {
  return keys.map((key) => `#### \`${key}\`\n\n${fencedText(record?.[key])}`).join("\n\n");
}

function headingText(value) {
  return String(value || "未命名").replace(/[\r\n]+/g, " ").trim();
}

function validateProfiles(profiles) {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new Error("DATING_PROFILES 必須是非空陣列。");
  }

  const ids = new Set();
  profiles.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`第 ${index + 1} 筆角色不是物件。`);
    }
    if (!entry.id || typeof entry.id !== "string") {
      throw new Error(`第 ${index + 1} 筆角色缺少字串 id。`);
    }
    if (ids.has(entry.id)) throw new Error(`角色 id 重複：${entry.id}`);
    ids.add(entry.id);
    if (!entry.profile || typeof entry.profile !== "object") {
      throw new Error(`角色 ${entry.id} 缺少 profile。`);
    }
    if (!entry.character || typeof entry.character !== "object") {
      throw new Error(`角色 ${entry.id} 缺少 character。`);
    }
  });
}

export function renderDatingProfilesMarkdown(profiles = DATING_PROFILES) {
  validateProfiles(profiles);

  const indexRows = profiles.map((entry, index) => [
    String(index + 1).padStart(2, "0"),
    headingText(entry.profile.name).replace(/\|/g, "\\|"),
    headingText(entry.character.name).replace(/\|/g, "\\|"),
    String(entry.profile.age ?? ""),
    headingText(entry.profile.job).replace(/\|/g, "\\|"),
  ].join(" | "));

  const introduction = [
    "# 信風 NPC 設定總覽",
    "",
    "> 這是由 `data/dating/profiles.js` 匯出的人工審稿副本，可直接在本檔留下修改。它不是 App 執行時讀取的資料來源。",
    ">",
    "> **每位角色頂層 `id`、`character.id` 與 `character.datingProfileId` 都不要修改。** 審稿完成後，所有修改仍須同步回對應的 JS 角色資料，並重新執行資料驗證。",
    ">",
    "> 匯出工具預設會拒絕覆蓋既有檔案，避免洗掉人工修改。只有確定要捨棄本檔修改並完整重建時，才可執行 `node tools/export-dating-profiles-markdown.mjs --force`。",
    "",
    `- 角色總數：${profiles.length}`,
    "- 匯出來源：`data/dating/profiles.js`",
    "- NPC 01–08 原始資料：`data/dating/profileGroups/localOne.js`",
    "- NPC 09–17 原始資料：`data/dating/profileGroups/localTwo.js`",
    "- NPC 18–25 原始資料：`data/dating/profileGroups/international.js`",
    "- 審稿檔：`docs/信風NPC設定總覽.md`",
    "- `profile` 是信風公開層；`character` 是交換聯絡後由所有小手機 App 共用的完整角色卡。",
    "- 空字串會顯示為「（空字串）」；空陣列會顯示為 `[]`。",
    "",
    "每個欄位都有固定層級標題，欄位內容放在 `text` fenced block 中。陣列與物件使用格式化 JSON，方便逐欄審閱與後續解析。",
    "",
    "## 角色索引",
    "",
    "編號 | 信風公開名 | 聯絡人本名 | 年齡 | 職業",
    "--- | --- | --- | --- | ---",
    ...indexRows,
  ].join("\n");

  const entries = profiles.map((entry, index) => {
    const number = String(index + 1).padStart(2, "0");
    const topLevelKeys = orderedKeys(entry, TOP_LEVEL_FIELD_ORDER)
      .filter((key) => !SECTION_FIELDS.has(key));
    const profileKeys = orderedKeys(entry.profile, PROFILE_FIELD_ORDER);
    const characterKeys = orderedKeys(entry.character, CHARACTER_FIELD_ORDER);

    return [
      `## NPC ${number} — ${headingText(entry.profile.name)}｜${headingText(entry.character.name)}`,
      "",
      "### 1. 信風頂層欄位",
      "",
      renderFields(entry, topLevelKeys),
      "",
      "### 2. `profile` 公開檔案",
      "",
      renderFields(entry.profile, profileKeys),
      "",
      "### 3. `dislikes` 隱藏雷點",
      "",
      renderFields(entry, ["dislikes"]),
      "",
      "### 4. 信風開場訊息",
      "",
      renderFields(entry, OPENING_FIELD_ORDER),
      "",
      "### 5. `character` 完整角色卡",
      "",
      renderFields(entry.character, characterKeys),
    ].join("\n");
  });

  return `${introduction}\n\n---\n\n${entries.join("\n\n---\n\n")}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log([
      "Usage: node tools/export-dating-profiles-markdown.mjs [--force]",
      "",
      "預設：若 docs/信風NPC設定總覽.md 已存在，拒絕覆蓋。",
      "--force：確認捨棄既有審稿修改並完整重建。",
    ].join("\n"));
    return;
  }

  const unknownArgs = args.filter((arg) => arg !== "--force");
  if (unknownArgs.length) {
    throw new Error(`不支援的參數：${unknownArgs.join(", ")}`);
  }

  const force = args.includes("--force");
  const markdown = renderDatingProfilesMarkdown();
  await mkdir(path.dirname(outputPath), { recursive: true });

  try {
    await writeFile(outputPath, markdown, {
      encoding: "utf8",
      flag: force ? "w" : "wx",
    });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error("docs/信風NPC設定總覽.md 已存在；為保護人工修改，請確認後加上 --force 才能覆蓋。");
    }
    throw error;
  }

  console.log(`已匯出 ${DATING_PROFILES.length} 位角色：${path.relative(projectRoot, outputPath)}`);
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(`匯出失敗：${error.message}`);
    process.exitCode = 1;
  });
}

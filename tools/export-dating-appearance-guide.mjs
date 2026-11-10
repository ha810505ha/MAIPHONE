import { writeFile } from "node:fs/promises";
import { DATING_PROFILES } from "../data/dating/profiles.js";

const OUTPUT_URL = new URL("../docs/信風NPC算圖外貌清單.md", import.meta.url);
const LEFT_BRACKET = "【";
const RIGHT_BRACKET = "】";

const readSection = (text, heading) => {
  const marker = `${LEFT_BRACKET}${heading}${RIGHT_BRACKET}`;
  const start = String(text || "").indexOf(marker);
  if (start < 0) return "";
  const remainder = String(text).slice(start + marker.length);
  const nextHeading = remainder.indexOf(`\n${LEFT_BRACKET}`);
  return (nextHeading < 0 ? remainder : remainder.slice(0, nextHeading)).trim();
};

const readHeight = (description) => {
  const basic = readSection(description, "基本資料");
  const source = `${basic}\n${description}`;
  const match = source.match(/身高(?:是|為|\s*)?(?:一百)?(?:[零一二三四五六七八九十百]+|\d+)\s*(?:公分|cm)/i);
  return match?.[0]?.replace(/^身高(?:是|為|\s*)?/, "") || "詳見角色卡";
};

const originFor = (index, description) => {
  if (index < 17) return "華人／台灣生活圈";
  const nationality = String(description || "").match(/(美國籍|英國籍|法國籍|日本籍|韓國籍)/)?.[1];
  return nationality || "國際角色";
};

const appearancePoints = (appearance) => String(appearance || "")
  .split(/[。\n]+/)
  .map((line) => line.trim())
  .filter(Boolean);

const lines = [
  "# 信風 NPC 算圖外貌清單",
  "",
  "> 僅整理 25 位角色的視覺資料，不包含背景、人格、感情線、劇情秘密或成人設定。",
  "> 角色照片尚未建立；此檔可作為立繪、頭像與交友軟體照片的算圖依據。",
  "> 手機版採單欄卡片，不使用寬表格；每一條外貌描述都可以直接複製組成提示詞。",
  "",
  "## 角色索引",
  "",
];

DATING_PROFILES.forEach((entry, index) => {
  const number = String(index + 1).padStart(2, "0");
  lines.push(`- **${number}**　${entry.profile.name}／${entry.character.name}　·　${entry.profile.age} 歲`);
});

lines.push("", "---", "");

DATING_PROFILES.forEach((entry, index) => {
  const appearance = readSection(entry.character.description, "外貌細節");
  const points = appearancePoints(appearance);
  const number = String(index + 1).padStart(2, "0");
  lines.push(
    `## ${number}　${entry.profile.name}`,
    "",
    `**${entry.character.name}**`,
    "",
    `${entry.profile.age} 歲　·　${originFor(index, entry.character.description)}　·　${readHeight(entry.character.description)}`,
    "",
    "### 外貌重點",
    "",
    ...points.map((point) => `- ${point}。`),
    "",
    "---",
    "",
  );
});

await writeFile(OUTPUT_URL, `${lines.join("\n")}\n`, "utf8");
console.log(`已匯出 ${DATING_PROFILES.length} 位角色外貌：docs/信風NPC算圖外貌清單.md`);

// 掃描 yunyin/assets/chars/（不進 git 的素材）生成 data/charManifest.js（進 git）。
// 素材更新後重跑：node yunyin/tools/genCharManifest.mjs
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const charsDir = join(root, "assets", "chars");

const list = (sub) => {
  try { return readdirSync(join(charsDir, sub)).filter((f) => f.endsWith(".png")); }
  catch { return []; }
};

// Body_01.png → [1..n]
const bodies = list("bodies").map((f) => Number(f.match(/Body_(\d+)/)?.[1])).filter(Boolean).sort((a, b) => a - b);
const eyes = list("eyes").map((f) => Number(f.match(/Eyes_(\d+)/)?.[1])).filter(Boolean).sort((a, b) => a - b);

// Hairstyle_XX_YY.png → { style: XX, colors: [YY...] }
const groupStyleColor = (files, re) => {
  const map = new Map();
  for (const f of files) {
    const m = f.match(re);
    if (!m) continue;
    const style = m[1], color = Number(m[2]);
    if (!map.has(style)) map.set(style, []);
    map.get(style).push(color);
  }
  return [...map.entries()]
    .map(([style, colors]) => ({ style, colors: colors.sort((a, b) => a - b) }))
    .sort((a, b) => a.style.localeCompare(b.style, undefined, { numeric: true }));
};

const hair = groupStyleColor(list("hair"), /^Hairstyle_(\d+)_(\d+)\.png$/);
const outfits = groupStyleColor(list("outfits"), /^Outfit_(\d+)_(\d+)\.png$/);
// Accessory_03_Backpack_02.png → style 含名字（"03_Backpack"）
const accessories = groupStyleColor(list("accessories"), /^Accessory_(\d+_[A-Za-z_]+)_(\d+)\.png$/);

const out = `// 自動生成：node yunyin/tools/genCharManifest.mjs（掃描 assets/chars/ 的實際檔案）
// 素材檔不進 git，但這份清單要進——程式靠它知道有哪些款式/顏色可選。
export const CHAR_MANIFEST = ${JSON.stringify({ bodies, eyes, hair, outfits, accessories }, null, 2)};
`;
writeFileSync(join(root, "data", "charManifest.js"), out);
console.log(`bodies:${bodies.length} eyes:${eyes.length} hair:${hair.length} outfits:${outfits.length} accessories:${accessories.length}`);

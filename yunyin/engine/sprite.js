// 紙娃娃外觀系統（limezu Character Generator 2.0 分層 spritesheet 版）。
//
// 外觀 = 純資料（可存檔、可用 seed 隨機生成），玩家與 NPC 共用同一套：
//   { body: 1..n, eyes: 1..n, hair: { style, color } | null,
//     outfit: { style, color }, accessory: { style, color } | null }
//
// 每一層是一張 1792×1280 的 spritesheet，全部共用同一副骨架：
//   幀 32×64、每方向 6 幀、方向順序 右/上(背面)/左/下(正面)
//   第 0 排靜立、第 1 排 idle 動畫、第 2 排走路（更多動作之後要用再加）
// 疊圖順序：body → outfit → eyes → hair → accessory。
//
// 素材檔不進 git（見 ASSETS_SETUP.md）；沒有素材時自動退回程序化色塊人，遊戲照常跑。
import { roll } from "./rng";
import { getImage, isReady } from "./assets";
import { CHAR_MANIFEST } from "../data/charManifest";

// Vite 打包時把 assets/chars 下所有 png 收進來變成 URL 表；資料夾不存在就是空表 → 全面 fallback
const SHEETS = import.meta.glob("../assets/chars/**/*.png", { eager: true, query: "?url", import: "default" });
const sheetUrl = (rel) => SHEETS[`../assets/chars/${rel}`] || null;
const pad2 = (n) => String(n).padStart(2, "0");

const FRAME_W = 32, FRAME_H = 64;
const DIR_BLOCK = { right: 0, up: 1, left: 2, down: 3 };
const ROW_IDLE = 1, ROW_WALK = 2;
const FRAMES_PER_DIR = 6;

export const DEFAULT_APPEARANCE = {
  body: 2, // 淺白膚色（Body_02），符合多數玩家形象
  eyes: 1,
  hair: { style: "01", color: 1 },
  outfit: { style: "01", color: 1 },
  accessory: null,
};

// NPC 隨機膚色的權重池：淺色系為主、偶爾深膚色；灰/紫等奇幻色不進池（留給玩家手動選）
const NPC_BODY_POOL = [2, 2, 2, 3, 3, 7, 7, 1, 4];

// 同一顆函式量產玩家隨機外觀與漫遊 NPC
export function randomAppearance(seed) {
  const m = CHAR_MANIFEST;
  const pick = (arr, salt) => arr[Math.floor(roll(seed, salt) * arr.length)];
  const hairDef = pick(m.hair, "hairStyle");
  const outfitDef = pick(m.outfits, "outfitStyle");
  const withAcc = roll(seed, "hasAcc") < 0.3; // 三成 NPC 戴配飾
  const accDef = withAcc ? pick(m.accessories, "accStyle") : null;
  const bodyPool = NPC_BODY_POOL.filter((b) => m.bodies.includes(b));
  return {
    body: bodyPool.length ? pick(bodyPool, "body") : pick(m.bodies, "body"),
    eyes: pick(m.eyes, "eyes"),
    hair: { style: hairDef.style, color: pick(hairDef.colors, "hairColor") },
    outfit: { style: outfitDef.style, color: pick(outfitDef.colors, "outfitColor") },
    accessory: accDef ? { style: accDef.style, color: pick(accDef.colors, "accColor") } : null,
  };
}

// 舊版（色塊人時代）存檔的 appearance 是 { skin, hairHue, ... } 平面數字：
// 結構對不上就整組換成預設，讓玩家重捏一次（0.x 版佔位資料，不值得寫轉換）
export function sanitizeAppearance(a) {
  if (a && typeof a.body === "number" && a.outfit && typeof a.outfit === "object") {
    return { ...DEFAULT_APPEARANCE, ...a };
  }
  return { ...DEFAULT_APPEARANCE };
}

// 一個外觀需要的各層 sheet（層順序即疊圖順序）
export function appearanceLayers(a) {
  const layers = [
    `bodies/Body_${pad2(a.body)}.png`,
    `outfits/Outfit_${a.outfit.style}_${pad2(a.outfit.color)}.png`,
    `eyes/Eyes_${pad2(a.eyes)}.png`,
  ];
  if (a.hair) layers.push(`hair/Hairstyle_${a.hair.style}_${pad2(a.hair.color)}.png`);
  if (a.accessory) layers.push(`accessories/Accessory_${a.accessory.style}_${pad2(a.accessory.color)}.png`);
  return layers;
}

// 畫一個角色。(sx, sy) 是角色所在 tile 的螢幕左上角，ts 是 tile 的螢幕尺寸。
// 角色圖高兩格：腳踩在 tile 底部、身體往上一格延伸（y-排序遮擋因此自然成立）。
export function drawActor(ctx, appearance, { sx, sy, ts, facing = "down", moving = false, now = 0 }) {
  const a = sanitizeAppearance(appearance);
  const layers = appearanceLayers(a).map((rel) => getImage(sheetUrl(rel)));

  if (layers.every((img) => isReady(img))) {
    const row = moving ? ROW_WALK : ROW_IDLE;
    const frame = Math.floor(now / (moving ? 110 : 220)) % FRAMES_PER_DIR;
    const col = DIR_BLOCK[facing] * FRAMES_PER_DIR + frame;
    // 影子
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath();
    ctx.ellipse(sx + ts / 2, sy + ts * 0.9, ts * 0.3, ts * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const img of layers) {
      ctx.drawImage(img, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H, sx, sy - ts, ts, ts * 2);
    }
    return;
  }

  drawBlockPerson(ctx, a, { sx, sy, ts, facing, moving, now });
}

// ---- fallback：素材沒載到/沒安裝時的程序化色塊人（外觀參數 hash 成顏色，同一外觀永遠同色）----
function drawBlockPerson(ctx, a, { sx, sy, ts, facing, moving, now }) {
  const skinTones = ["#f2d3b8", "#eac09a", "#c98e62", "#8d5c3f"];
  const skin = skinTones[(a.body - 1) % skinTones.length];
  const hairColor = a.hair ? `hsl(${(Number(a.hair.style) * 47 + a.hair.color * 31) % 360}, 45%, 32%)` : null;
  const outfitColor = `hsl(${(Number(a.outfit.style) * 53 + a.outfit.color * 37) % 360}, 42%, 52%)`;
  const bob = moving ? Math.sin(now / 90) * ts * 0.04 : 0;
  const cx = sx + ts / 2;

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(cx, sy + ts * 0.88, ts * 0.28, ts * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = outfitColor;
  ctx.fillRect(cx - ts * 0.22, sy + ts * 0.38 + bob, ts * 0.44, ts * 0.46);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(cx, sy + ts * 0.28 + bob, ts * 0.2, 0, Math.PI * 2);
  ctx.fill();
  if (hairColor) {
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(cx, sy + ts * 0.26 + bob, ts * 0.2, Math.PI, 0);
    ctx.fill();
  }
  if (facing !== "up") {
    const ox = facing === "left" ? -ts * 0.07 : facing === "right" ? ts * 0.07 : 0;
    ctx.fillStyle = "#333";
    ctx.fillRect(cx - ts * 0.07 + ox, sy + ts * 0.25 + bob, ts * 0.05, ts * 0.05);
    ctx.fillRect(cx + ts * 0.03 + ox, sy + ts * 0.25 + bob, ts * 0.05, ts * 0.05);
  }
}

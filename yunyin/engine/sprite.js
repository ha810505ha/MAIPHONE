// 紙娃娃外觀系統。
//
// 外觀 = 純資料（可存檔、可用 seed 隨機生成），玩家與 NPC 共用同一套：
//   { skin, hair, hairHue, outfit, outfitHue, accessory }
//
// drawActor() 是唯一的繪製入口。目前的實作是「程序化色塊人」占位；
// 素材（LPC 分層 spritesheet）到位後，只要把 drawActor 內部換成
// 「烘焙分層 spritesheet + 快取」的版本，呼叫端（玩家/NPC/捏角預覽）完全不用動。
import { roll } from "./rng";

// 各部位的樣式數量（素材接入後改成實際素材數量即可）
export const PART_COUNTS = {
  skin: 4,      // 膚色
  hair: 6,      // 髮型（0=光頭）
  outfit: 4,    // 服裝款式
  accessory: 3, // 配飾（0=無）
};

export const SKIN_TONES = ["#f2d3b8", "#eac09a", "#c98e62", "#8d5c3f"];

export const DEFAULT_APPEARANCE = {
  skin: 0, hair: 1, hairHue: 20, outfit: 0, outfitHue: 215, accessory: 0,
};

// 同一顆函式量產玩家預設與漫遊 NPC 外觀
export function randomAppearance(seed) {
  return {
    skin: Math.floor(roll(seed, "skin") * PART_COUNTS.skin),
    hair: Math.floor(roll(seed, "hair") * PART_COUNTS.hair),
    hairHue: Math.floor(roll(seed, "hairHue") * 360),
    outfit: Math.floor(roll(seed, "outfit") * PART_COUNTS.outfit),
    outfitHue: Math.floor(roll(seed, "outfitHue") * 360),
    accessory: Math.floor(roll(seed, "acc") * PART_COUNTS.accessory),
  };
}

export const sanitizeAppearance = (a) => ({ ...DEFAULT_APPEARANCE, ...(a || {}) });

const hairColor = (a) => `hsl(${a.hairHue}, 45%, 32%)`;
const outfitColor = (a, l = 52) => `hsl(${a.outfitHue}, 42%, ${l}%)`;

// 畫一個角色。(sx, sy) 是角色所在 tile 的螢幕左上角，ts 是 tile 的螢幕尺寸。
// facing: down/up/left/right；moving 時帶走路晃動。
export function drawActor(ctx, appearance, { sx, sy, ts, facing = "down", moving = false, now = 0 }) {
  const a = sanitizeAppearance(appearance);
  const bob = moving ? Math.sin(now / 90) * ts * 0.04 : 0;
  const cx = sx + ts / 2;

  // 影子
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(cx, sy + ts * 0.88, ts * 0.28, ts * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- 服裝（身體）---
  const bodyY = sy + ts * 0.38 + bob;
  ctx.fillStyle = outfitColor(a);
  if (a.outfit === 0) {
    // 短打：上衣 + 腿
    ctx.fillRect(cx - ts * 0.22, bodyY, ts * 0.44, ts * 0.3);
    ctx.fillStyle = outfitColor(a, 30);
    ctx.fillRect(cx - ts * 0.18, bodyY + ts * 0.3, ts * 0.14, ts * 0.16);
    ctx.fillRect(cx + ts * 0.04, bodyY + ts * 0.3, ts * 0.14, ts * 0.16);
  } else if (a.outfit === 1) {
    // 長袍：直筒到腳
    ctx.fillRect(cx - ts * 0.24, bodyY, ts * 0.48, ts * 0.46);
    ctx.fillStyle = outfitColor(a, 35);
    ctx.fillRect(cx - ts * 0.04, bodyY, ts * 0.08, ts * 0.46); // 中線衣襟
  } else if (a.outfit === 2) {
    // 披風款：身體 + 兩側外擴
    ctx.fillRect(cx - ts * 0.2, bodyY, ts * 0.4, ts * 0.44);
    ctx.fillStyle = outfitColor(a, 32);
    ctx.beginPath();
    ctx.moveTo(cx - ts * 0.2, bodyY);
    ctx.lineTo(cx - ts * 0.3, bodyY + ts * 0.44);
    ctx.lineTo(cx - ts * 0.2, bodyY + ts * 0.44);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + ts * 0.2, bodyY);
    ctx.lineTo(cx + ts * 0.3, bodyY + ts * 0.44);
    ctx.lineTo(cx + ts * 0.2, bodyY + ts * 0.44);
    ctx.closePath(); ctx.fill();
  } else {
    // 束腰勁裝
    ctx.fillRect(cx - ts * 0.22, bodyY, ts * 0.44, ts * 0.44);
    ctx.fillStyle = outfitColor(a, 28);
    ctx.fillRect(cx - ts * 0.22, bodyY + ts * 0.18, ts * 0.44, ts * 0.07); // 腰帶
  }

  // --- 頭 ---
  const headY = sy + ts * 0.28 + bob;
  ctx.fillStyle = SKIN_TONES[a.skin % SKIN_TONES.length];
  ctx.beginPath();
  ctx.arc(cx, headY, ts * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // --- 髮型 ---
  ctx.fillStyle = hairColor(a);
  if (a.hair === 1) {
    // 短髮：上半圓
    ctx.beginPath();
    ctx.arc(cx, headY - ts * 0.02, ts * 0.2, Math.PI, 0);
    ctx.fill();
  } else if (a.hair === 2) {
    // 長髮：上半圓 + 兩側垂髮
    ctx.beginPath();
    ctx.arc(cx, headY - ts * 0.02, ts * 0.21, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - ts * 0.21, headY - ts * 0.02, ts * 0.07, ts * 0.24);
    ctx.fillRect(cx + ts * 0.14, headY - ts * 0.02, ts * 0.07, ts * 0.24);
  } else if (a.hair === 3) {
    // 丸子頭
    ctx.beginPath();
    ctx.arc(cx, headY - ts * 0.02, ts * 0.2, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, headY - ts * 0.24, ts * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else if (a.hair === 4) {
    // 馬尾（畫在頭側後方，依面向偏移）
    ctx.beginPath();
    ctx.arc(cx, headY - ts * 0.02, ts * 0.2, Math.PI, 0);
    ctx.fill();
    const tailX = facing === "left" ? cx + ts * 0.16 : facing === "right" ? cx - ts * 0.16 : cx + ts * 0.16;
    ctx.fillRect(tailX - ts * 0.035, headY - ts * 0.06, ts * 0.07, ts * 0.3);
  } else if (a.hair === 5) {
    // 道髻 + 髮簪感
    ctx.beginPath();
    ctx.arc(cx, headY - ts * 0.04, ts * 0.2, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - ts * 0.05, headY - ts * 0.3, ts * 0.1, ts * 0.1);
  }
  // hair === 0：光頭，不畫

  // --- 臉（眼睛，依面向）---
  if (facing !== "up") {
    const ox = facing === "left" ? -ts * 0.07 : facing === "right" ? ts * 0.07 : 0;
    ctx.fillStyle = "#333";
    ctx.fillRect(cx - ts * 0.07 + ox, headY - ts * 0.03, ts * 0.05, ts * 0.05);
    ctx.fillRect(cx + ts * 0.03 + ox, headY - ts * 0.03, ts * 0.05, ts * 0.05);
  }

  // --- 配飾 ---
  if (a.accessory === 1) {
    // 額帶
    ctx.fillStyle = outfitColor(a, 30);
    ctx.fillRect(cx - ts * 0.2, headY - ts * 0.1, ts * 0.4, ts * 0.05);
  } else if (a.accessory === 2) {
    // 髮飾（金簪點）
    ctx.fillStyle = "#e8c35a";
    ctx.beginPath();
    ctx.arc(cx + ts * 0.12, headY - ts * 0.16, ts * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}

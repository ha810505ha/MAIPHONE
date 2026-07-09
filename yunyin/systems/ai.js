// AI 觸發點框架。原則（§9）：AI 永遠是裝飾對白、絕不參與數值判定；
// 失敗/超時/未設定一律 fallback 內建句庫，遊戲不會卡。
//
// 開關兩層：
//   settings.ai.master   — 角色回覆總開關：開 = 走 AI 生成；關 = 只用句庫（零 token）
//   settings.ai.<group>  — 各觸發點開關（breakthrough / dungeon / farm）：關 = 連句庫都不出聲
import { COMPANION_LINES } from "../data/lines";

const AI_TIMEOUT_MS = 4000;
const COOLDOWN_MS = { farm: 10 * 60 * 1000 }; // 其他觸發點天然低頻，不設冷卻
const lastFired = {}; // trigger group → ts（session 內即可，不進存檔）

const POOL_GROUP = {
  breakthrough_ok: "breakthrough", breakthrough_fail: "breakthrough",
  dungeon: "dungeon", dungeonBoss: "dungeon",
  harvest: "farm", rareHarvest: "farm",
};

const withTimeout = (p, ms) => Promise.race([
  p, new Promise((resolve) => setTimeout(() => resolve(null), ms)),
]);

// 有綁定的角色裡隨機挑一位發言（不用選同行：誰路過誰搭話）
export function pickBoundChar(save, characters) {
  const ids = Object.values(save.settings.bindings || {}).filter(Boolean);
  const bound = characters.filter((c) => ids.includes(c.id));
  if (!bound.length) return null;
  return bound[Math.floor(Math.random() * bound.length)];
}

// 回傳 { charId, name, text, ai } 或 null（不該出聲）
export async function companionReact({ save, poolKey, prompt, characters = [], onAiReact = null, force = false }) {
  const group = POOL_GROUP[poolKey];
  const s = save.settings?.ai;
  if (!s || !s[group]) return null;

  const cd = COOLDOWN_MS[group] || 0;
  const now = Date.now();
  if (!force && cd && now - (lastFired[group] || 0) < cd) return null;

  const char = pickBoundChar(save, characters);
  if (!char) return null;
  lastFired[group] = now;

  let text = null, ai = false;
  if (s.master && onAiReact) {
    try {
      text = await withTimeout(onAiReact({ trigger: poolKey, charId: char.id, prompt }), AI_TIMEOUT_MS);
      ai = !!text;
    } catch { text = null; }
  }
  if (!text) {
    const pool = COMPANION_LINES[poolKey] || [];
    text = pool[Math.floor(Math.random() * pool.length)] || null;
  }
  return text ? { charId: char.id, name: char.name, text, ai } : null;
}

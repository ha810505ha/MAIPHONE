// AI 觸發點框架。原則（§9）：AI 永遠是裝飾對白、絕不參與數值判定。
//
// 台詞來源優先序（成本遞減設計）：
//   ① 角色個人句庫（linePacks[charId]，玩家在設定裡手動生成，一次生成永久重用、零 token）
//   ② 內建通用句庫（COMPANION_LINES fallback）
// 舊的「每次觸發即時呼叫 AI」已退役——個人句庫在個人化與成本上都優於它。
//
// 句庫選用全自動：有個人句庫就用角色的，沒有就用通用的（總開關已移除——
// 沒句庫時開關無差別、有句庫時沒人會想關，留著只是干擾）。
// settings.ai.<group>（breakthrough / dungeon / farm）是「想不想被搭話」的觸發點開關，保留。
import { COMPANION_LINES } from "../data/lines";

const COOLDOWN_MS = { farm: 10 * 60 * 1000 }; // 其他觸發點天然低頻，不設冷卻
const lastFired = {}; // trigger group → ts（session 內即可，不進存檔）

const POOL_GROUP = {
  breakthrough_ok: "breakthrough", breakthrough_fail: "breakthrough",
  dungeon: "dungeon", dungeonBoss: "dungeon",
  harvest: "farm", rareHarvest: "farm",
};

// 生成句庫時要求的池與句數（chat 給「點擊 NPC 閒聊」用）
export const PACK_POOLS = {
  breakthrough_ok: 4, breakthrough_fail: 4,
  dungeon: 4, dungeonBoss: 4,
  harvest: 4, rareHarvest: 4,
  chat: 6,
};
export const MAX_PACK_VERSIONS = 3;

// ---- 句庫存取（key 永遠是角色 id，跟 NPC 綁定無關）----
export const packOf = (save, charId) => save.linePacks?.[charId] || null;

export function activePackLines(save, charId) {
  const pack = packOf(save, charId);
  if (!pack || !pack.versions.length) return null;
  return pack.versions[Math.min(pack.active, pack.versions.length - 1)]?.lines || null;
}

// 新版本寫入：未滿 3 版就附加並選用；滿了覆蓋「最舊的非選用版本」（玩家選中的那版永遠安全）
export function addPackVersion(save, charId, lines, now = Date.now()) {
  if (!save.linePacks) save.linePacks = {};
  const pack = save.linePacks[charId] || (save.linePacks[charId] = { versions: [], active: 0 });
  const version = { createdAt: now, lines };
  if (pack.versions.length < MAX_PACK_VERSIONS) {
    pack.versions.push(version);
    pack.active = pack.versions.length - 1;
  } else {
    let oldest = -1;
    for (let i = 0; i < pack.versions.length; i++) {
      if (i === pack.active) continue;
      if (oldest === -1 || pack.versions[i].createdAt < pack.versions[oldest].createdAt) oldest = i;
    }
    pack.versions[oldest] = version;
    pack.active = oldest;
  }
  return pack;
}

export function setActivePackVersion(save, charId, index) {
  const pack = packOf(save, charId);
  if (pack && index >= 0 && index < pack.versions.length) pack.active = index;
}

// 有個人句庫就抽角色的，否則抽通用句庫
function pickText(save, charId, poolKey) {
  const personal = activePackLines(save, charId)?.[poolKey];
  if (personal?.length) return { text: personal[Math.floor(Math.random() * personal.length)], ai: true };
  const pool = COMPANION_LINES[poolKey] || [];
  return pool.length ? { text: pool[Math.floor(Math.random() * pool.length)], ai: false } : null;
}

// 有綁定的角色裡隨機挑一位發言（不用選同行：誰路過誰搭話）
export function pickBoundChar(save, characters) {
  const ids = Object.values(save.settings.bindings || {}).filter(Boolean);
  const bound = characters.filter((c) => ids.includes(c.id));
  if (!bound.length) return null;
  return bound[Math.floor(Math.random() * bound.length)];
}

// 觸發點發言。回傳 { charId, name, text, ai } 或 null（不該出聲）。
// 介面保持 async（呼叫端都用 .then），雖然現在內部已無網路呼叫。
export async function companionReact({ save, poolKey, characters = [], force = false }) {
  const group = POOL_GROUP[poolKey];
  const s = save.settings?.ai;
  if (!s || !s[group]) return null;

  const cd = COOLDOWN_MS[group] || 0;
  const now = Date.now();
  if (!force && cd && now - (lastFired[group] || 0) < cd) return null;

  const char = pickBoundChar(save, characters);
  if (!char) return null;
  lastFired[group] = now;

  const picked = pickText(save, char.id, poolKey);
  return picked ? { charId: char.id, name: char.name, ...picked } : null;
}

// 修仙：修為掛機（時間戳回算）、突破、境界解鎖樹。
import { REALMS, BREAKTHROUGH_BASE_RATE, BREAKTHROUGH_FAIL_LOSS, BREAKTHROUGH_COOLDOWN_MS } from "../data/realms";

export const realmOf = (c) => REALMS[c.realmIdx];
export const isMaxRealm = (c) => c.realmIdx >= REALMS.length - 1;

// 依 expUpdatedAt 回算修為（夾在 expMax），回傳這次增加量
export function settleExp(c, now = Date.now()) {
  const realm = realmOf(c);
  const mins = Math.max(0, (now - c.expUpdatedAt) / 60000);
  const before = c.exp;
  c.exp = Math.min(realm.expMax, c.exp + realm.ratePerMin * mins);
  c.expUpdatedAt = now;
  return c.exp - before;
}

export function canBreakthrough(c, now = Date.now()) {
  return !isMaxRealm(c) && c.exp >= realmOf(c).expMax && now >= (c.breakthroughCdUntil || 0);
}

// 回傳 { ok, realmName }；不可突破時回 null
export function attemptBreakthrough(c, now = Date.now()) {
  if (!canBreakthrough(c, now)) return null;
  const ok = Math.random() < BREAKTHROUGH_BASE_RATE;
  if (ok) {
    c.realmIdx += 1;
    c.exp = 0;
  } else {
    c.exp = Math.floor(c.exp * (1 - BREAKTHROUGH_FAIL_LOSS));
    c.breakthroughCdUntil = now + BREAKTHROUGH_COOLDOWN_MS;
  }
  c.expUpdatedAt = now;
  return { ok, realmName: realmOf(c).name };
}

// 目前境界（含）以下累積解鎖的 key
export const unlockedKeys = (c) => REALMS.slice(0, c.realmIdx + 1).flatMap((r) => r.unlocks);
export const hasUnlock = (c, key) => unlockedKeys(c).includes(key);

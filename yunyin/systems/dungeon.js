// 秘境（無限流）：一輪 run 的狀態機。
// 所有隨機都從 runSeed 推導（seed + salt → 確定性亂數）：
// 同一輪的事件順序與擲骰結果可重現，關 app 重開、重讀存檔都無法重骰。
import { EVENTS, BOSS_EVENT, MODIFIERS } from "../data/events";
import { hasUnlock } from "./cultivation";
import { REALMS } from "../data/realms";

import { roll } from "../engine/rng";

const BASE_HP = 10;
const BASE_FLOORS = 5;
const BASE_RUNS_PER_DAY = 2;

export const eventById = (id) => (id === "boss" ? BOSS_EVENT : EVENTS.find((e) => e.id === id));

// 詞條效果加總
export function runModEffects(run) {
  const eff = { dropMul: 1, expMul: 1, floorMinus: 0, hpPlus: 0, riskPlus: 0 };
  for (const mid of run.modifiers) {
    const m = MODIFIERS.find((m) => m.id === mid);
    if (!m) continue;
    if (m.effect.dropMul) eff.dropMul *= m.effect.dropMul;
    if (m.effect.expMul) eff.expMul *= m.effect.expMul;
    eff.floorMinus += m.effect.floorMinus || 0;
    eff.hpPlus += m.effect.hpPlus || 0;
    eff.riskPlus += m.effect.riskPlus || 0;
  }
  return eff;
}

// ---- 每日次數 ----
const dayStr = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const maxRunsOf = (cultivation) => BASE_RUNS_PER_DAY + (hasUnlock(cultivation, "dungeon_depth_3") ? 1 : 0);

export function resetDungeonDaily(save, now = Date.now()) {
  if (save.dungeon.lastResetDay !== dayStr(now)) {
    save.dungeon.lastResetDay = dayStr(now);
    save.dungeon.runsToday = maxRunsOf(save.cultivation);
  }
}

// ---- 抽事件：同輪不重複，最後一層固定 Boss ----
function drawEvent(run) {
  if (run.floor >= run.totalFloors) return "boss";
  const pool = EVENTS.filter((e) => !run.usedEvents.includes(e.id));
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = roll(run.seed, `evt${run.floor}`) * total;
  for (const e of pool) { r -= e.weight; if (r <= 0) return e.id; }
  return pool[pool.length - 1].id;
}

// ---- 開始一輪 ----
export function startRun(save) {
  const d = save.dungeon;
  if (d.activeRun) return "已有進行中的探索";
  if (d.runsToday < 1) return "今日探索次數已用盡";
  d.runsToday -= 1;

  const seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  // 詞條 1~2 條（不重複）
  const modifiers = [];
  const mCount = roll(seed, "mcount") < 0.5 ? 1 : 2;
  for (let i = 0; modifiers.length < mCount && i < 12; i++) {
    const m = MODIFIERS[Math.floor(roll(seed, `mod${i}`) * MODIFIERS.length)];
    if (!modifiers.includes(m.id)) modifiers.push(m.id);
  }

  const run = {
    seed, modifiers,
    floor: 1, totalFloors: 0,
    hp: 0, hpMax: 0,
    exp: 0, coins: 0, loot: {},
    usedEvents: [], eventId: null,
    state: "event", // event → outcome →（下一層 event | dead | cleared）
    outcome: null,
  };
  const eff = runModEffects(run);
  const depthBonus = (hasUnlock(save.cultivation, "dungeon_depth_2") ? 1 : 0)
    + (hasUnlock(save.cultivation, "dungeon_depth_3") ? 2 : 0);
  run.totalFloors = Math.max(3, BASE_FLOORS + depthBonus + Math.floor(roll(seed, "floors") * 2) - eff.floorMinus);
  run.hpMax = BASE_HP + eff.hpPlus;
  run.hp = run.hpMax;
  run.eventId = drawEvent(run);
  d.activeRun = run;
  return null;
}

// ---- 選擇當前事件的選項 ----
export function chooseOption(save, choiceIdx) {
  const run = save.dungeon.activeRun;
  if (!run || run.state !== "event") return null;
  const ev = eventById(run.eventId);
  const ch = ev.choices[choiceIdx];
  if (!ch) return null;
  const eff = runModEffects(run);
  const realmIdx = Math.min(save.cultivation.realmIdx, REALMS.length - 1);

  // 擲骰（確定性：同一層同一選項重讀存檔結果不變）
  let ok = true;
  const r = roll(run.seed, `c${run.floor}-${choiceIdx}`);
  if (ch.check) ok = r < Math.min(0.95, ch.check.base + ch.check.perRealm * realmIdx);
  else if (ch.risk != null) ok = r >= Math.min(0.95, ch.risk + eff.riskPlus);

  const fx = (ok ? ch.good : ch.bad) || {};
  if (fx.hp) run.hp = Math.max(0, Math.min(run.hpMax, run.hp + fx.hp));
  if (fx.exp) run.exp += Math.round(fx.exp * eff.expMul);
  if (fx.coins) run.coins += fx.coins;
  if (fx.item) run.loot[fx.item.id] = (run.loot[fx.item.id] || 0) + fx.item.n * eff.dropMul;

  run.usedEvents.push(ev.id);
  run.outcome = { ok, text: ok ? (ch.goodText || "順利通過。") : (ch.badText || "事與願違。"), fx: { ...fx, exp: fx.exp ? Math.round(fx.exp * eff.expMul) : 0, itemN: fx.item ? fx.item.n * eff.dropMul : 0 } };
  run.state = run.hp <= 0 ? "dead" : run.floor >= run.totalFloors ? "cleared" : "outcome";
  return run.outcome;
}

// ---- 前進下一層 ----
export function proceed(save) {
  const run = save.dungeon.activeRun;
  if (!run || run.state !== "outcome") return;
  run.floor += 1;
  run.eventId = drawEvent(run);
  run.outcome = null;
  run.state = "event";
}

// ---- 結束一輪：通關/撤退全拿，出局掉一半 ----
export function finishRun(save, mode /* "cleared" | "retreat" | "dead" */) {
  const run = save.dungeon.activeRun;
  if (!run) return null;
  const keep = mode === "dead" ? 0.5 : 1;
  const summary = {
    mode,
    floor: run.floor, totalFloors: run.totalFloors,
    exp: Math.floor(run.exp * keep),
    coins: Math.floor(run.coins * keep),
    items: Object.entries(run.loot)
      .map(([id, n]) => ({ id, n: Math.floor(n * keep) }))
      .filter((it) => it.n > 0),
  };
  // 修為進帳夾在當前境界上限（跟掛機一樣不能溢出）
  const realm = REALMS[save.cultivation.realmIdx];
  save.cultivation.exp = Math.min(realm.expMax, save.cultivation.exp + summary.exp);
  save.coins += summary.coins;
  for (const it of summary.items) save.inventory[it.id] = (save.inventory[it.id] || 0) + it.n;
  save.dungeon.activeRun = null;
  return summary;
}

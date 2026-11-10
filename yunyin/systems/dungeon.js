// 秘境（無限流）：一輪 run 的狀態機。
// 所有隨機都從 runSeed 推導（seed + salt → 確定性亂數）：
// 同一輪的事件順序與擲骰結果可重現，關 app 重開、重讀存檔都無法重骰。
import { EVENTS, BOSS_EVENT, CRYSTAL_VEIN_EVENT, MODIFIERS } from "../data/events";
import { hasUnlock } from "./cultivation";
import { REALMS } from "../data/realms";
import { BLUEPRINT_FURNITURE_IDS, furnitureById } from "../home/furnitureCatalog";

import { roll } from "../engine/rng";
import { taiwanDayKey } from "../../utils/taiwanDayKey";

const BASE_HP = 10;
const BASE_FLOORS = 5;
const BASE_RUNS_PER_DAY = 2;

export const eventById = (id) => (id === "boss" ? BOSS_EVENT : id === CRYSTAL_VEIN_EVENT.id ? CRYSTAL_VEIN_EVENT : EVENTS.find((e) => e.id === id));

// ---- 難度分級：境界解鎖，越深掉落越好（材料/金幣/結晶/圖紙率）----
export const DIFFICULTIES = [
  { id: 1, name: "迷霧淺境", icon: "🌫️", desc: "標準報酬", unlock: null,
    floorPlus: 0, lootMul: 1, coinMul: 1, riskPlus: 0, crystalBonus: 0, blueprintChance: 0.3,
    clearMaterials: [{ id: "qingshi", n: 1 }] },
  { id: 2, name: "迷霧深境", icon: "🌁", desc: "掉落×1.5・建材更多", unlock: "dungeon_depth_2",
    floorPlus: 2, lootMul: 1.5, coinMul: 1.5, riskPlus: 0.05, crystalBonus: 5, blueprintChance: 0.4,
    clearMaterials: [{ id: "qingshi", n: 2 }, { id: "lingmu", n: 1 }] },
  { id: 3, name: "霧核秘窟", icon: "🕳️", desc: "掉落×2・圖紙率最高", unlock: "dungeon_depth_3",
    floorPlus: 4, lootMul: 2, coinMul: 2, riskPlus: 0.1, crystalBonus: 10, blueprintChance: 0.5,
    clearMaterials: [{ id: "qingshi", n: 4 }, { id: "lingmu", n: 2 }] },
  // MP-045：元嬰期／煉虛期。通關結晶只比霧核秘窟多一點（約 30／33），
  // 另有機率在途中遇到結晶礦脈（每輪最多 1 次，1～3 顆）當小驚喜
  { id: 4, name: "靈淵", icon: "🌀", desc: "掉落×2.5・可能遇到結晶礦脈", unlock: "dungeon_depth_4",
    floorPlus: 6, lootMul: 2.5, coinMul: 2.5, riskPlus: 0.15, crystalBonus: 15, blueprintChance: 0.55, veinChance: 0.25,
    clearMaterials: [{ id: "qingshi", n: 5 }, { id: "lingmu", n: 3 }] },
  { id: 5, name: "歸墟", icon: "🌌", desc: "掉落×3・結晶礦脈更常見", unlock: "dungeon_depth_5",
    floorPlus: 8, lootMul: 3, coinMul: 3, riskPlus: 0.2, crystalBonus: 18, blueprintChance: 0.6, veinChance: 0.35,
    clearMaterials: [{ id: "qingshi", n: 6 }, { id: "lingmu", n: 4 }] },
];
export const CRYSTAL_VEIN_MAX = 3;
export const difficultyById = (id) => DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[0];
export const difficultyUnlocked = (d, cultivation) => !d.unlock || hasUnlock(cultivation, d.unlock);

// 詞條效果加總
export function runModEffects(run) {
  const eff = { dropMul: 1, expMul: 1, floorMinus: 0, hpPlus: 0, riskPlus: 0 };
  // 難度加成先入帳，再疊詞條
  const difficulty = difficultyById(run.difficulty);
  eff.dropMul *= difficulty.lootMul;
  eff.riskPlus += difficulty.riskPlus;
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
export const maxRunsOf = () => BASE_RUNS_PER_DAY;

export function resetDungeonDaily(save, now = Date.now()) {
  const day = taiwanDayKey(now);
  if (save.dungeon.lastResetDay !== day) {
    save.dungeon.lastResetDay = day;
    save.dungeon.runsToday = maxRunsOf(save.cultivation);
  }
}

// ---- 抽事件：同輪不重複，最後一層固定 Boss ----
function drawEvent(run) {
  if (run.floor >= run.totalFloors) return "boss";
  if (run.veinFloor && run.floor === run.veinFloor) return CRYSTAL_VEIN_EVENT.id;
  // 高難度層數多：事件抽完就整池重來，避免沒有事件可抽
  const unused = EVENTS.filter((e) => !run.usedEvents.includes(e.id));
  const pool = unused.length ? unused : EVENTS;
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = roll(run.seed, `evt${run.floor}`) * total;
  for (const e of pool) { r -= e.weight; if (r <= 0) return e.id; }
  return pool[pool.length - 1].id;
}

// ---- 開始一輪 ----
export function startRun(save, difficultyId = 1) {
  const d = save.dungeon;
  if (d.activeRun) return "已有進行中的探索";
  if (d.runsToday < 1) return "今日探索次數已用盡";
  const difficulty = difficultyById(difficultyId);
  if (!difficultyUnlocked(difficulty, save.cultivation)) return "境界不足，無法踏入此層迷霧";
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
    seed, modifiers, difficulty: difficulty.id,
    floor: 1, totalFloors: 0,
    hp: 0, hpMax: 0,
    exp: 0, coins: 0, loot: {},
    usedEvents: [], eventId: null,
    state: "event", // event → outcome →（下一層 event | dead | cleared）
    outcome: null,
  };
  const eff = runModEffects(run);
  run.totalFloors = Math.max(3, BASE_FLOORS + difficulty.floorPlus + Math.floor(roll(seed, "floors") * 2) - eff.floorMinus);
  run.hpMax = BASE_HP + eff.hpPlus;
  run.hp = run.hpMax;
  // 結晶礦脈：開局就決定這輪有沒有、在第幾層（第 2 層到 Boss 前一層），重讀存檔不會重骰
  run.veinFloor = difficulty.veinChance && run.totalFloors > 2 && roll(seed, "vein") < difficulty.veinChance
    ? 2 + Math.floor(roll(seed, "veinFloor") * (run.totalFloors - 2))
    : null;
  run.crystals = 0;
  run.eventId = drawEvent(run);
  d.activeRun = run;
  return null;
}

// ---- 選擇目前事件的選項 ----
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
  const coins = fx.coins ? Math.round(fx.coins * difficultyById(run.difficulty).coinMul) : 0;
  const itemN = fx.item ? Math.round(fx.item.n * eff.dropMul) : 0;
  if (fx.hp) run.hp = Math.max(0, Math.min(run.hpMax, run.hp + fx.hp));
  if (fx.exp) run.exp += Math.round(fx.exp * eff.expMul);
  if (fx.coins) run.coins += coins;
  if (fx.item) run.loot[fx.item.id] = Math.round(run.loot[fx.item.id] || 0) + itemN;
  const veinCrystals = fx.crystalVein ? 1 + Math.floor(roll(run.seed, "veinAmount") * CRYSTAL_VEIN_MAX) : 0;
  if (veinCrystals) run.crystals = (run.crystals || 0) + veinCrystals;

  run.usedEvents.push(ev.id);
  run.outcome = { ok, text: ok ? (ch.goodText || "順利通過。") : (ch.badText || "事與願違。"), fx: { ...fx, coins, exp: fx.exp ? Math.round(fx.exp * eff.expMul) : 0, itemN, crystals: veinCrystals } };
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
  const difficulty = difficultyById(run.difficulty);
  const summary = {
    mode,
    difficultyName: difficulty.name,
    floor: run.floor, totalFloors: run.totalFloors,
    exp: Math.floor(run.exp * keep),
    coins: Math.floor(run.coins * keep),
    // 礦脈結晶跟袋中戰利品一樣：通關／撤退全拿，出局掉一半
    crystals: (mode === "cleared" ? Math.min(15, 10 + Math.floor(run.totalFloors / 2)) + difficulty.crystalBonus : mode === "retreat" ? Math.min(10, 5 + Math.floor(run.floor / 2)) : 3)
      + Math.floor((run.crystals || 0) * keep),
    items: Object.entries(run.loot)
      // 舊進行中存檔可能仍有小數；先取整數，再套用出局減半。
      .map(([id, n]) => ({ id, n: Math.floor(Math.round(n) * keep) }))
      .filter((it) => it.n > 0),
  };
  // 通關保底建材（難度越高越多），與袋中戰利品合併入帳
  if (mode === "cleared") {
    for (const material of difficulty.clearMaterials) {
      const existing = summary.items.find((it) => it.id === material.id);
      if (existing) existing.n += material.n;
      else summary.items.push({ ...material });
    }
  }
  // 通關獎勵：機率掉一張還沒拿過的家具圖紙（稀有家具的購買資格；難度越高機率越高）
  if (mode === "cleared") {
    const pool = BLUEPRINT_FURNITURE_IDS.filter((id) => !save.blueprints?.[id] && !save.home?.furnitureUnlocks?.[id]);
    if (pool.length && roll(run.seed, "blueprint") < difficulty.blueprintChance) {
      const furnitureId = pool[Math.floor(roll(run.seed, "blueprintPick") * pool.length)];
      save.blueprints[furnitureId] = true;
      summary.blueprint = { furnitureId, name: furnitureById(furnitureId)?.name || furnitureId };
    }
  }
  // 修為進帳夾在目前境界上限（跟掛機一樣不能溢出）
  const realm = REALMS[save.cultivation.realmIdx];
  save.cultivation.exp = Math.min(realm.expMax, save.cultivation.exp + summary.exp);
  save.coins += summary.coins;
  for (const it of summary.items) save.inventory[it.id] = (save.inventory[it.id] || 0) + it.n;
  save.dungeon.activeRun = null;
  return summary;
}

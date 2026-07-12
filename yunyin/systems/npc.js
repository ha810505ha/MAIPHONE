// 漫遊 NPC：idle(3~8秒) → 半徑 6 格挑一個可走格 → A* 走過去 → idle → …
// 只存 seed（外觀與名字由 seed 重建），位置每次進場重擲，不進存檔。
import { astar, nearestWalkable } from "../engine/pathfind";
import { randomAppearance, sanitizeAppearance } from "../engine/sprite";
import { roll, rngOf } from "../engine/rng";
import { NPC_NAMES, pickLine } from "../data/lines";
import { TILE } from "../engine/tilemap";

const NPC_COUNT = 6;
const WANDER_RADIUS = 6;
const STEP_MS = 260; // NPC 走得比玩家慢一點

// 傳送點要保持清空，避免 NPC 站在入口上阻擋玩家互動。
const npcBlocked = (map, x, y) => map.isBlocked(x, y)
  || (map.portals || []).some((portal) => portal.x === x && portal.y === y)
  || (map.id === "farm" && (map.plots || []).some((plot) => plot.x === x && plot.y === y));

// 存檔裡只放 seeds；第一次進遊戲時生成
export function ensureNpcSeeds(save) {
  if (!save.npcs || save.npcs.length === 0) {
    const base = `${save.createdAt}`;
    // 名字用「隨機起點 + 錯位」取，保證同一批 NPC 不撞名
    const nameOffset = Math.floor(roll(base, "nameOffset") * NPC_NAMES.length);
    save.npcs = Array.from({ length: NPC_COUNT }, (_, i) => ({
      seed: `npc-${base}-${i}`,
      name: NPC_NAMES[(nameOffset + i) % NPC_NAMES.length],
    }));
  }
  return save.npcs;
}

// 進入地圖時把 seeds 實體化成 runtime actor（只在安全地圖：山門）
export function spawnNpcs(save, map, characters = []) {
  if (map.id === "farm") {
    const today = new Date().toISOString().slice(0, 10);
    const seeds = ensureNpcSeeds(save);
    const assistUsed = save.farmAssist?.day === today && save.farmAssist.used;
    const bound = !assistUsed ? seeds.find((def) => save.settings?.bindings?.[def.seed]) : null;
    const spawn = map.spawn || [3, 3];
    const actors = [];
    if (bound) {
      const charId = save.settings.bindings[bound.seed];
      const character = characters.find((item) => item.id === charId);
      const helperSpot = map.plots?.[0] || { x: spawn[0] + 1, y: spawn[1] };
      actors.push({ seed: bound.seed, charId, helper: true, name: character?.name || bound.name, appearance: bound.appearance ? sanitizeAppearance(bound.appearance) : randomAppearance(bound.seed), x: helperSpot.x, y: helperSpot.y, px: helperSpot.x * TILE, py: helperSpot.y * TILE, path: [], stepT: 0, facing: "down", moving: false, waitUntil: Infinity, bubble: null, rand: rngOf(`${bound.seed}:farm-helper:${today}`) });
    }
    const idleCount = Math.floor(roll(`${save.createdAt}:${today}`, "farm-idle-count") * 3); // 0～2
    const idleSeeds = seeds.filter((def) => def !== bound).slice(0, idleCount);
    idleSeeds.forEach((def, index) => {
      const rand = rngOf(`${def.seed}:farm-idle:${today}`);
      const start = { x: spawn[0] + 1 + index, y: spawn[1] + 1 };
      const spot = nearestWalkable(start.x, start.y, map.w, map.h, (x, y) => npcBlocked(map, x, y)) || { x: spawn[0] + index, y: spawn[1] };
      actors.push({ seed: def.seed, name: def.name, appearance: def.appearance ? sanitizeAppearance(def.appearance) : randomAppearance(def.seed), x: spot.x, y: spot.y, px: spot.x * TILE, py: spot.y * TILE, path: [], stepT: 0, facing: "down", moving: false, waitUntil: performance.now() + 1000 + rand() * 4000, bubble: null, rand });
    });
    return actors;
  }
  if (map.id !== "gate") return [];
  return ensureNpcSeeds(save).map((def, i) => {
    const rand = rngOf(`${def.seed}:spawn:${Date.now()}`);
    let x = 0, y = 0;
    for (let tries = 0; tries < 40; tries++) {
      x = Math.floor(rand() * map.w);
      y = Math.floor(rand() * map.h);
      if (!npcBlocked(map, x, y)) break;
    }
    const spot = nearestWalkable(x, y, map.w, map.h, (tx, ty) => npcBlocked(map, tx, ty)) || { x: map.spawn[0], y: map.spawn[1] };
    return {
      seed: def.seed, name: def.name,
      // 玩家在設定裡編輯過的外觀優先，否則用 seed 隨機（同一 NPC 每次進場長一樣）
      appearance: def.appearance ? sanitizeAppearance(def.appearance) : randomAppearance(def.seed),
      x: spot.x, y: spot.y, px: spot.x * TILE, py: spot.y * TILE,
      path: [], stepT: 0, facing: "down", moving: false,
      waitUntil: performance.now() + 1000 + rand() * 5000,
      bubble: null, // { text, until }
      rand,
    };
  });
}

function pickWanderTarget(npc, map) {
  for (let tries = 0; tries < 10; tries++) {
    const tx = npc.x + Math.floor(npc.rand() * (WANDER_RADIUS * 2 + 1)) - WANDER_RADIUS;
    const ty = npc.y + Math.floor(npc.rand() * (WANDER_RADIUS * 2 + 1)) - WANDER_RADIUS;
    if (tx === npc.x && ty === npc.y) continue;
    if (npcBlocked(map, tx, ty)) continue;
    const path = astar(npc.x, npc.y, tx, ty, map.w, map.h, (x, y) => npcBlocked(map, x, y));
    if (path && path.length) return path;
  }
  return null;
}

// 每幀更新全部 NPC（與玩家一樣：一幀可跨多格，分頁節流不會卡在半路）
export function updateNpcs(npcs, map, dt, now) {
  for (const npc of npcs) {
    if (npc.bubble && now > npc.bubble.until) npc.bubble = null;
    if (!npc.path.length) {
      npc.moving = false;
      npc.px = npc.x * TILE; npc.py = npc.y * TILE;
      if (now >= npc.waitUntil) {
        const path = pickWanderTarget(npc, map);
        if (path) { npc.path = path; npc.stepT = 0; }
        npc.waitUntil = now + 3000 + npc.rand() * 5000;
      }
      continue;
    }
    npc.moving = true;
    npc.stepT += dt;
    while (npc.path.length && npc.stepT >= STEP_MS) {
      const next = npc.path.shift();
      npc.x = next.x; npc.y = next.y;
      npc.stepT -= STEP_MS;
    }
    if (npc.path.length) {
      const next = npc.path[0];
      npc.facing = next.x > npc.x ? "right" : next.x < npc.x ? "left" : next.y > npc.y ? "down" : "up";
      const t = npc.stepT / STEP_MS;
      npc.px = (npc.x + (next.x - npc.x) * t) * TILE;
      npc.py = (npc.y + (next.y - npc.y) * t) * TILE;
    } else {
      npc.px = npc.x * TILE; npc.py = npc.y * TILE;
      npc.stepT = 0;
      npc.waitUntil = now + 3000 + npc.rand() * 5000;
    }
  }
}

// 點 NPC：冒一句話。有入駐角色的個人句庫（chat 池）就用角色口吻，否則抽通用時段句庫。
export function talkToNpc(npc, now, chatLines = null) {
  const text = chatLines?.length
    ? chatLines[Math.floor(npc.rand() * chatLines.length)]
    : pickLine(npc.rand);
  const duration = Math.min(6500, 2800 + Math.max(0, String(text || "").length - 24) * 55);
  npc.bubble = { text, until: now + duration };
  npc.path = []; // 停下來面對玩家
  return text;
}

// 行走中也點得到：邏輯格或視覺位置任一命中都算
export const npcAtTile = (npcs, tx, ty) => npcs.find((n) => n.x === tx && n.y === ty)
  || npcs.find((n) => Math.round(n.px / TILE) === tx && Math.round(n.py / TILE) === ty);

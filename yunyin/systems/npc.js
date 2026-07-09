// 漫遊 NPC：idle(3~8秒) → 半徑 6 格挑一個可走格 → A* 走過去 → idle → …
// 只存 seed（外觀與名字由 seed 重建），位置每次進場重擲，不進存檔。
import { astar, nearestWalkable } from "../engine/pathfind";
import { randomAppearance } from "../engine/sprite";
import { roll, rngOf } from "../engine/rng";
import { NPC_NAMES, pickLine } from "../data/lines";
import { TILE } from "../engine/tilemap";

const NPC_COUNT = 6;
const WANDER_RADIUS = 6;
const STEP_MS = 260; // NPC 走得比玩家慢一點

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
export function spawnNpcs(save, map) {
  if (map.id !== "gate") return [];
  return ensureNpcSeeds(save).map((def, i) => {
    const rand = rngOf(`${def.seed}:spawn:${Date.now()}`);
    let x = 0, y = 0;
    for (let tries = 0; tries < 40; tries++) {
      x = Math.floor(rand() * map.w);
      y = Math.floor(rand() * map.h);
      if (!map.isBlocked(x, y)) break;
    }
    const spot = nearestWalkable(x, y, map.w, map.h, map.isBlocked) || { x: map.spawn[0], y: map.spawn[1] };
    return {
      seed: def.seed, name: def.name,
      appearance: randomAppearance(def.seed),
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
    if (map.isBlocked(tx, ty)) continue;
    const path = astar(npc.x, npc.y, tx, ty, map.w, map.h, map.isBlocked);
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

// 點 NPC：冒一句話（之後 settings.ai.npcChat 開啟時這裡改走 aiLine，失敗 fallback 回句庫）
export function talkToNpc(npc, now) {
  npc.bubble = { text: pickLine(npc.rand), until: now + 2800 };
  npc.path = []; // 停下來面對玩家
  return npc.bubble.text;
}

// 行走中也點得到：邏輯格或視覺位置任一命中都算
export const npcAtTile = (npcs, tx, ty) => npcs.find((n) => n.x === tx && n.y === ty)
  || npcs.find((n) => Math.round(n.px / TILE) === tx && Math.round(n.py / TILE) === ty);

import { astar } from "../engine/pathfind";
import { furnitureById } from "../home/furnitureCatalog";
import { furnitureInstanceAt } from "../home/homeEditorRuntime";

const occupies = (item, x, y, w = 1, h = 1) => (
  x >= item.x && x < item.x + Math.max(1, w) && y >= item.y && y < item.y + Math.max(1, h)
);

const furnitureTarget = (map, instance) => {
  const definition = furnitureById(instance?.furnitureId);
  if (!definition?.interactions?.length) return null;
  return {
    sourceId: `${map.instanceId || map.id}:furniture:${instance.uid}`,
    sourceType: "furniture",
    source: instance,
    definition,
    x: instance.x,
    y: instance.y,
    interactions: definition.interactions,
  };
};

const decorationTarget = (map, decoration) => {
  if (!decoration?.interactions?.length) return null;
  return {
    sourceId: `${map.id}:decoration:${decoration.id}`,
    sourceType: "decoration",
    source: decoration,
    definition: decoration,
    x: decoration.x,
    y: decoration.y,
    interactions: decoration.interactions,
  };
};

export function worldInteractionAt(map, x, y) {
  const instance = furnitureInstanceAt(map.home?.furniture || [], x, y);
  const furniture = furnitureTarget(map, instance);
  if (furniture) return furniture;
  // 有互動的裝飾優先：蒲團疊在榻榻米上時，不能被沒互動的墊子搶走點擊
  const decorations = map.decorations || [];
  const decoration = decorations.find((item) => item.interactions?.length && occupies(item, x, y, item.w, item.h))
    || decorations.find((item) => occupies(item, x, y, item.w, item.h));
  return decorationTarget(map, decoration);
}

export function collectWorldInteractions(map) {
  return [
    ...(map.decorations || []).map((item) => decorationTarget(map, item)),
    ...(map.home?.furniture || []).map((item) => furnitureTarget(map, item)),
  ].filter(Boolean);
}

// 所有互動席位通用的「多方向接近」：每個席位都有固定的「落座格」
// （approach + renderOffset 推出來的那一格，也就是動作進行時角色實際所在位置）。
// 原本只認設計時寫死的單一 approach 方向，家具緊貼牆壁/被其他家具擋住那一側時就完全無法互動。
// 改成：落座格不動（席位位置、多席位家具的座位對應都不變），角色可以從落座格
// 四周任何一個沒被擋住的方向走過來，renderOffset 依實際走來的方向反推、落點完全一致。
// 朝向仍鎖素材設計的固定方向（sit/eat/read/phone 動畫只有左右向）。
const APPROACH_DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

function candidateApproaches(slot) {
  const seatX = slot.approach[0] + (slot.renderOffset?.[0] || 0);
  const seatY = slot.approach[1] + (slot.renderOffset?.[1] || 0);
  const isPrimary = (x, y) => x === slot.approach[0] && y === slot.approach[1];
  return APPROACH_DIRS
    .map(([dx, dy]) => {
      const approach = [seatX + dx, seatY + dy];
      return { approach, renderOffset: [seatX - approach[0], seatY - approach[1]], isPrimary: isPrimary(approach[0], approach[1]) };
    })
    // 原設計方向排最前：路徑長度相同時維持舊行為（角色優先從家具正面走過來）
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
}

function plansForTarget(actor, map, target, reservedSlots) {
  const plans = [];
  for (const interaction of target?.interactions || []) {
    for (const slot of interaction.slots || []) {
      const slotKey = `${target.sourceId}:${interaction.id}:${slot.id}`;
      if (reservedSlots?.has(slotKey)) continue;
      for (const candidate of candidateApproaches(slot)) {
        const x = target.x + candidate.approach[0];
        const y = target.y + candidate.approach[1];
        if (map.isBlocked(x, y)) continue;
        const path = astar(actor.x, actor.y, x, y, map.w, map.h, map.isBlocked);
        if (!path) continue;
        plans.push({
          action: interaction.action,
          label: interaction.label,
          sourceId: target.sourceId,
          slotKey,
          x,
          y,
          path,
          // 動作本身只有左右向動畫時，朝向維持素材設計的固定方向，不隨走來的那一側改變
          // （sit/eat/read/phone 都是 horizontal-only；四向動作可以之後在這裡按 candidate 方向算朝向）
          facing: slot.facing || "down",
          renderOffset: { x: candidate.renderOffset?.[0] || 0, y: candidate.renderOffset?.[1] || 0 },
          minDurationMs: interaction.minDurationMs || 3500,
          maxDurationMs: interaction.maxDurationMs || 7000,
        });
      }
    }
  }
  return plans;
}

export function findInteractionPlan(actor, map, target = null, reservedSlots = new Set(), random = null) {
  const targets = target ? [target] : collectWorldInteractions(map);
  const plans = targets.flatMap((item) => plansForTarget(actor, map, item, reservedSlots));
  plans.sort((a, b) => a.path.length - b.path.length);
  if (!plans.length) return null;
  if (!random) return plans[0];
  const nearby = plans.slice(0, Math.min(4, plans.length));
  return nearby[Math.floor(random() * nearby.length)];
}


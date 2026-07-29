// 靈田：地塊狀態完全由 plantedAt 時間戳推導，無計時器。
import { CROPS } from "../data/crops.js";
import { hasUnlock } from "./cultivation.js";

export const AURA_MUL = 0.9; // 靈氣被動加成：生長時間 -10%
export const HARVEST_REPLANT_GUARD_MS = 800;
export const cropById = (id) => CROPS.find((c) => c.id === id);
export const growMs = (crop) => {
  const growMin = Number(crop?.growMin);
  return Number.isFinite(growMin) && growMin > 0 ? growMin * 60000 * AURA_MUL : null;
};

// null=空地；0種/1芽/2長/3熟
export function plotStage(plot, now = Date.now()) {
  if (!plot?.cropId) return null;
  const crop = cropById(plot.cropId);
  const duration = growMs(crop);
  const plantedAt = Number(plot.plantedAt);
  const timestamp = Number(now);
  if (!duration || !Number.isFinite(plantedAt) || plantedAt <= 0 || !Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.min(3, Math.floor(((timestamp - plantedAt) / duration) * 3)));
}

export const readyAtOf = (plot) => {
  if (!plot?.cropId) return null;
  const plantedAt = Number(plot.plantedAt);
  const duration = growMs(cropById(plot.cropId));
  return duration && Number.isFinite(plantedAt) && plantedAt > 0 ? plantedAt + duration : null;
};

export const remainMin = (plot, now = Date.now()) => {
  const at = readyAtOf(plot);
  return at ? Math.max(0, Math.ceil((at - now) / 60000)) : 0;
};

// 前 3 塊免費；第 4~9 塊掛在境界解鎖樹的 plot_4~plot_9（第 8、9 塊同在金丹期開）
export function plotUnlocked(idx, cultivation) {
  if (!Number.isInteger(idx) || idx < 0) return false;
  if (idx < 3) return true;
  if (!cultivation || !Number.isInteger(cultivation.realmIdx)) return false;
  return hasUnlock(cultivation, `plot_${idx + 1}`);
}

export const replantPromptBlocked = (lastHarvest, plotIdx, now = Date.now()) => (
  lastHarvest?.plotIdx === plotIdx
  && Number.isFinite(lastHarvest.until)
  && Number(now) < lastHarvest.until
);

// 種植：花錢買種（shop 作物）或消耗背包種子（dungeon 作物）。回傳錯誤訊息或 null。
export function plantCrop(save, plotIdx, cropId, now = Date.now()) {
  const plot = save?.farm?.plots?.[plotIdx];
  const crop = cropById(cropId);
  const plantedAt = Number(now);
  if (!plot || !crop || plot.cropId || !Number.isFinite(plantedAt) || plantedAt <= 0) return "無法種植";
  if (!plotUnlocked(plotIdx, save?.cultivation)) return "🔒 境界不足，尚未開墾";
  if (crop.source === "shop") {
    if (!Number.isFinite(save.coins) || save.coins < crop.seedCost) return "🪙 不足";
    save.coins -= crop.seedCost;
  } else {
    const seedKey = `${crop.id}_seed`;
    const seedCount = Number(save?.inventory?.[seedKey]) || 0;
    if (seedCount < 1) return "沒有種子";
    save.inventory[seedKey] = seedCount - 1;
  }
  plot.cropId = cropId;
  plot.plantedAt = plantedAt;
  return null;
}

// 收成：熟了才收，產物進背包。回傳 { crop, count } 或 null。
export function harvestPlot(save, plotIdx, now = Date.now()) {
  const plot = save?.farm?.plots?.[plotIdx];
  if (!plot || plotStage(plot, now) !== 3) return null;
  const crop = cropById(plot.cropId);
  if (!crop || !save?.inventory) return null;
  save.inventory[crop.id] = (Number(save.inventory[crop.id]) || 0) + crop.yield;
  plot.cropId = null;
  plot.plantedAt = null;
  return { crop, count: crop.yield };
}

// 離線期間熟成的格數（結算卡用）
export function ripenedDuring(save, sinceTs, now = Date.now()) {
  const since = Number(sinceTs);
  const current = Number(now);
  if (!Number.isFinite(since) || !Number.isFinite(current)) return 0;
  return (save?.farm?.plots || []).filter((p) => {
    const at = readyAtOf(p);
    return at && at > since && at <= current;
  }).length;
}

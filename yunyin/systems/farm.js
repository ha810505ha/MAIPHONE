// 靈田：地塊狀態完全由 plantedAt 時間戳推導，無計時器。
import { CROPS } from "../data/crops";
import { hasUnlock } from "./cultivation";

export const AURA_MUL = 0.9; // 靈氣被動加成：生長時間 -10%
export const cropById = (id) => CROPS.find((c) => c.id === id);
export const growMs = (crop) => crop.growMin * 60000 * AURA_MUL;

// null=空地；0種/1芽/2長/3熟
export function plotStage(plot, now = Date.now()) {
  if (!plot.cropId) return null;
  const crop = cropById(plot.cropId);
  return Math.max(0, Math.min(3, Math.floor(((now - plot.plantedAt) / growMs(crop)) * 3)));
}

export const readyAtOf = (plot) => plot.cropId ? plot.plantedAt + growMs(cropById(plot.cropId)) : null;

export const remainMin = (plot, now = Date.now()) => {
  const at = readyAtOf(plot);
  return at ? Math.max(0, Math.ceil((at - now) / 60000)) : 0;
};

// 前 3 塊免費；第 4~8 塊掛在境界解鎖樹的 plot_4~plot_8；第 9 塊保留
export function plotUnlocked(idx, cultivation) {
  if (idx < 3) return true;
  return hasUnlock(cultivation, `plot_${idx + 1}`);
}

// 種植：花錢買種（shop 作物）或消耗背包種子（dungeon 作物）。回傳錯誤訊息或 null。
export function plantCrop(save, plotIdx, cropId, now = Date.now()) {
  const plot = save.farm.plots[plotIdx];
  const crop = cropById(cropId);
  if (!plot || !crop || plot.cropId) return "無法種植";
  if (crop.source === "shop") {
    if (save.coins < crop.seedCost) return "🪙 不足";
    save.coins -= crop.seedCost;
  } else {
    const seedKey = `${crop.id}_seed`;
    if ((save.inventory[seedKey] || 0) < 1) return "沒有種子";
    save.inventory[seedKey] -= 1;
  }
  plot.cropId = cropId;
  plot.plantedAt = now;
  return null;
}

// 收成：熟了才收，產物進背包。回傳 { crop, count } 或 null。
export function harvestPlot(save, plotIdx, now = Date.now()) {
  const plot = save.farm.plots[plotIdx];
  if (!plot || plotStage(plot, now) !== 3) return null;
  const crop = cropById(plot.cropId);
  save.inventory[crop.id] = (save.inventory[crop.id] || 0) + crop.yield;
  plot.cropId = null;
  plot.plantedAt = null;
  return { crop, count: crop.yield };
}

// 離線期間熟成的格數（結算卡用）
export function ripenedDuring(save, sinceTs, now = Date.now()) {
  return save.farm.plots.filter((p) => {
    const at = readyAtOf(p);
    return at && at > sinceTs && at <= now;
  }).length;
}

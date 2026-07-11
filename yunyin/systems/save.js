import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";

// 存檔：永遠不存進度百分比，只存時間戳＋參數，開場用公式回算離線進度。
const KEY = "mali_yunyin_save_v1";
const DB_KEY = "ent_yunyinSave";

export const defaultSave = () => ({
  ver: 1,
  createdAt: Date.now(),
  lastSeenAt: Date.now(),
  coins: 100, // 開局盤纏，夠買幾把青靈草種子
  cultivation: { realmIdx: 0, exp: 0, expUpdatedAt: Date.now(), breakthroughCdUntil: 0 },
  farm: { plots: Array.from({ length: 9 }, (_, id) => ({ id, cropId: null, plantedAt: null })) },
  shop: {
    furnace: { recipeId: null, startedAt: null, batch: 0 },
    shelves: Array.from({ length: 2 }, (_, id) => ({ id, itemId: null, stock: 0, soldUpdatedAt: null })),
    orders: [],
    lastOrderDay: "",
  },
  dungeon: { runsToday: 2, lastResetDay: "", activeRun: null },
  inventory: {},
  player: { pos: { map: "gate", x: 10, y: 9 }, appearance: null },
  npcs: [], // 漫遊 NPC 的 seed + 名字（外觀由 seed 重建）
  settings: {
    // 觸發點開關（想不想被搭話）；台詞來源全自動：有個人句庫用角色的，沒有用通用的
    ai: { breakthrough: true, dungeon: true, farm: true },
    bindings: {}, // npcSeed → 角色 id（角色入駐）
  },
  // 角色個人句庫：key 是「角色 id」不是 NPC——跟綁定完全脫鉤，解綁/換綁句庫都留著
  linePacks: {}, // charId → { versions: [{ createdAt, lines: {池: [句...]} }], active: 0 }
});

// 淺層依 section merge：舊檔缺欄位自動補 default（版本遷移先用這招，夠用）
const normalizeSave = (raw) => {
  const d = defaultSave();
  if (!raw || typeof raw !== "object") return d;
  const normalized = {
      ...d, ...raw,
      cultivation: { ...d.cultivation, ...(raw.cultivation || {}) },
      farm: { plots: d.farm.plots.map((p, i) => ({ ...p, ...(raw.farm?.plots?.[i] || {}) })) },
      shop: {
        furnace: { ...d.shop.furnace, ...(raw.shop?.furnace || {}) },
        shelves: d.shop.shelves.map((s, i) => ({ ...s, ...(raw.shop?.shelves?.[i] || {}) })),
        orders: raw.shop?.orders || [],
        lastOrderDay: raw.shop?.lastOrderDay || "",
      },
      dungeon: { ...d.dungeon, ...(raw.dungeon || {}) },
      inventory: { ...(raw.inventory || {}) },
      player: { ...d.player, ...(raw.player || {}), pos: { ...d.player.pos, ...(raw.player?.pos || {}) } },
      npcs: raw.npcs || [],
      settings: {
        ai: { ...d.settings.ai, ...(raw.settings?.ai || {}) },
        bindings: { ...(raw.settings?.bindings || {}) },
      },
      linePacks: { ...(raw.linePacks || {}) },
  };
  normalized.farm.plots.forEach((plot) => {
    if (plot.cropId === "test_sprout") {
      plot.cropId = null;
      plot.plantedAt = null;
    }
  });
  normalized.shop.shelves.forEach((shelf) => {
    if (shelf.itemId === "test_sprout") Object.assign(shelf, { itemId: null, stock: 0, soldUpdatedAt: null });
  });
  delete normalized.inventory.test_sprout;
  delete normalized.inventory.test_sprout_seed;
  return normalized;
};

export async function loadSave() {
  try {
    const stored = await loadFeatureEntity(DB_KEY, null);
    if (stored) return normalizeSave(stored);
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
    const migrated = normalizeSave(legacy);
    await saveFeatureEntity(DB_KEY, migrated);
    try { localStorage.removeItem(KEY); } catch (_) {}
    return migrated;
  } catch (error) {
    console.warn("[yunyin] 存檔載入失敗，使用新存檔", error);
    return defaultSave();
  }
}

export function persistSave(s) {
  s.lastSeenAt = Date.now();
  return saveFeatureEntity(DB_KEY, structuredClone(s)).catch((error) => console.error("[yunyin] 存檔失敗", error));
}

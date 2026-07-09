// 存檔：永遠不存進度百分比，只存時間戳＋參數，開場用公式回算離線進度。
const KEY = "mali_yunyin_save_v1";

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
    ai: { master: false, breakthrough: true, dungeon: true, farm: true },
    bindings: {}, // npcSeed → 角色 id（角色入駐）
  },
});

// 淺層依 section merge：舊檔缺欄位自動補 default（版本遷移先用這招，夠用）
export function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw) return defaultSave();
    const d = defaultSave();
    return {
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
    };
  } catch { return defaultSave(); }
}

export function persistSave(s) {
  s.lastSeenAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 容量滿等罕見狀況，下次再存 */ }
}

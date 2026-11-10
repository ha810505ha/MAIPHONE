import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";
import { YUNYIN_SAVE_UPDATED_EVENT } from "../../constants/notifications";
import { normalizeHomeState } from "../home/homeState";
import { cropById } from "./farm.js";
import { normalizeNpcField } from "./npcFields.js";
import { OUTDOOR_MARGIN } from "../data/maps/mapLayout.js";

// 存檔：永遠不存進度百分比，只存時間戳＋參數，開場用公式回算離線進度。
const KEY = "mali_yunyin_save_v1";
const DB_KEY = "ent_yunyinSave";
export const SAVE_VERSION = 2;
// 地圖版型版本：2 = 戶外三張圖四周加樹林外框、內容整體往內移 OUTDOOR_MARGIN 格（MP-029）
export const MAP_LAYOUT_VERSION = 2;
const FRAMED_OUTDOOR_MAPS = new Set(["gate", "farm", "residence"]);

export const defaultSave = () => ({
  ver: SAVE_VERSION,
  createdAt: Date.now(),
  lastSeenAt: Date.now(),
  coins: 100, // 開局盤纏，夠買幾把青靈草種子
  cultivation: { realmIdx: 0, exp: 0, expUpdatedAt: Date.now(), breakthroughCdUntil: 0 },
  farm: {
    // 18 格＝第一塊田 9 格＋第二塊田 9 格（MP-045）；舊存檔只有 9 格，載入時用這份預設補齊，既有田格不動
    plots: Array.from({ length: 18 }, (_, id) => ({ id, cropId: null, plantedAt: null })),
    npcFields: {}, // characterId → 角色田地狀態（獨立於玩家田）
  },
  shop: {
    // 兩座丹爐：第 2 座要築基期（furnace_2）才啟用，但存檔固定兩格、以解鎖判定控制可用數
    furnaces: Array.from({ length: 2 }, () => ({ recipeId: null, startedAt: null, batch: 0 })),
    shelves: Array.from({ length: 2 }, (_, id) => ({ id, itemId: null, stock: 0, soldUpdatedAt: null })),
    orders: [],
    lastOrderDay: "",
  },
  dungeon: { runsToday: 2, lastResetDay: "", activeRun: null },
  hall: { lastMeditateDay: "" }, // 修煉堂每日打坐
  blueprints: {}, // furnitureId → true（稀有家具購買資格）
  inventory: {},
  player: { pos: { map: "gate", x: 13, y: 12 }, appearance: null },
  mapLayoutVersion: MAP_LAYOUT_VERSION,
  npcs: [], // 漫遊 NPC 的 seed + 名字（外觀由 seed 重建）
  settings: {
    // 觸發點開關（想不想被搭話）；台詞來源全自動：有個人句庫用角色的，沒有用通用的
    ai: { breakthrough: true, dungeon: true, farm: true },
    bindings: {}, // npcSeed → 角色 id（角色入駐）
    cameraScale: null, // 玩家選定後，所有地圖共用 0.5 / 1 / 1.5 / 2
  },
  // 角色個人句庫：key 是「角色 id」不是 NPC——跟綁定完全脫鉤，解綁/換綁句庫都留著
  linePacks: {}, // charId → { versions: [{ createdAt, lines: {池: [句...]} }], active: 0 }
  home: normalizeHomeState(),
});

// 淺層依 section merge：舊檔缺欄位自動補 default（版本遷移先用這招，夠用）
const normalizeSave = (raw) => {
  const d = defaultSave();
  if (!raw || typeof raw !== "object") return d;
  const normalized = {
      ...d, ...raw,
      cultivation: { ...d.cultivation, ...(raw.cultivation || {}) },
      farm: {
        plots: d.farm.plots.map((p, i) => ({ ...p, ...(raw.farm?.plots?.[i] || {}) })),
        // 住客角色田（MP-030）：characterId → 田地狀態；壞掉的欄位補預設、作物不存在就清空
        npcFields: Object.fromEntries(Object.entries(raw.farm?.npcFields && typeof raw.farm.npcFields === "object" ? raw.farm.npcFields : {})
          .map(([characterId, field]) => [characterId, normalizeNpcField(field)])),
      },
      shop: {
        // 舊檔單爐 furnace → 遷移成 furnaces[0]
        furnaces: d.shop.furnaces.map((f, i) => ({ ...f, ...(raw.shop?.furnaces?.[i] || (i === 0 ? raw.shop?.furnace : null) || {}) })),
        shelves: d.shop.shelves.map((s, i) => ({ ...s, ...(raw.shop?.shelves?.[i] || {}) })),
        orders: raw.shop?.orders || [],
        lastOrderDay: raw.shop?.lastOrderDay || "",
      },
      dungeon: { ...d.dungeon, ...(raw.dungeon || {}) },
      hall: { ...d.hall, ...(raw.hall || {}) },
      blueprints: { ...(raw.blueprints || {}) },
      inventory: { ...(raw.inventory || {}) },
      player: { ...d.player, ...(raw.player || {}), pos: { ...d.player.pos, ...(raw.player?.pos || {}) } },
      npcs: raw.npcs || [],
      settings: {
        ai: { ...d.settings.ai, ...(raw.settings?.ai || {}) },
        bindings: { ...(raw.settings?.bindings || {}) },
        cameraScale: raw.settings?.cameraScale
          ?? raw.settings?.cameraScales?.[raw.player?.pos?.map]
          ?? d.settings.cameraScale,
      },
      linePacks: { ...(raw.linePacks || {}) },
      home: normalizeHomeState(raw.home),
  };
  // 舊版把 home 池混在一般角色句庫中；首次讀取時複製到獨立入住句庫，避免玩家重生台詞。
  for (const [characterId, pack] of Object.entries(normalized.linePacks)) {
    if (normalized.home.residentLinePacks[characterId]?.versions?.length) continue;
    const versions = (Array.isArray(pack?.versions) ? pack.versions : [])
      .filter((version) => Array.isArray(version?.lines?.home) && version.lines.home.length)
      .map((version) => ({ createdAt: version.createdAt, lines: { home: [...version.lines.home] } }));
    if (versions.length) {
      normalized.home.residentLinePacks[characterId] = {
        versions,
        active: Math.min(Number(pack.active) || 0, versions.length - 1),
      };
    }
  }
  normalized.ver = SAVE_VERSION;
  // 舊版型存檔：玩家站在戶外三張圖時，座標跟著地圖內容一起往內移；只轉換一次
  if ((Number(raw.mapLayoutVersion) || 1) < 2 && raw.player?.pos && FRAMED_OUTDOOR_MAPS.has(normalized.player.pos.map)) {
    normalized.player.pos = {
      ...normalized.player.pos,
      x: (Number(normalized.player.pos.x) || 0) + OUTDOOR_MARGIN,
      y: (Number(normalized.player.pos.y) || 0) + OUTDOOR_MARGIN,
    };
  }
  normalized.mapLayoutVersion = MAP_LAYOUT_VERSION;
  normalized.farm.plots.forEach((plot) => {
    const plantedAt = Number(plot.plantedAt);
    if (plot.cropId === "test_sprout" || (plot.cropId && (!cropById(plot.cropId) || !Number.isFinite(plantedAt) || plantedAt <= 0))) {
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

export async function loadSave({ isCurrent = () => true } = {}) {
  const assertCurrent = () => {
    if (!isCurrent()) throw new DOMException("Villa loading cancelled", "AbortError");
  };
  const assertSave = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DOMException("Invalid villa save", "DataError");
    }
    return value;
  };
  // A failed read is never evidence of a first visit. Let the caller stop loading.
  const stored = await loadFeatureEntity(DB_KEY, null);
  assertCurrent();
  if (stored != null) return normalizeSave(assertSave(stored));
  const legacyText = localStorage.getItem(KEY);
  let legacy = null;
  if (legacyText !== null) {
    try { legacy = JSON.parse(legacyText); }
    catch { throw new DOMException("Invalid legacy villa save", "DataError"); }
    assertSave(legacy);
  }
  const migrated = normalizeSave(legacy);
  assertCurrent();
  // 沒有任何存檔時先用記憶體裡的預設開局，不立刻寫回：資料庫被系統清掉後第一次開山莊，
  // 不能用一份「最新建立」的空檔搶走雲端合併與備份的優先權（MP-090）。玩家有實際進度才存。
  if (legacyText === null) return { ...migrated, fresh: true };
  await saveFeatureEntity(DB_KEY, migrated);
  assertCurrent();
  // Keep the legacy copy if migration could not commit, or the caller left.
  try { localStorage.removeItem(KEY); } catch (_) {}
  return migrated;
}

/** 玩家做了會改變進度的事：這份存檔從此可以寫回。 */
export function touchSave(s) {
  if (s && typeof s === "object") delete s.fresh;
  return s;
}

// 存檔後把整份存檔廣播給通知層（MP-091）；人在山莊裡時對方只先收著，離開才套用。
function announceSave(snapshot) {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent(YUNYIN_SAVE_UPDATED_EVENT, { detail: snapshot })); } catch {}
}

export function persistSave(s) {
  if (s?.fresh) return Promise.resolve();
  s.lastSeenAt = Date.now();
  const snapshot = structuredClone(s);
  announceSave(snapshot);
  return saveFeatureEntity(DB_KEY, snapshot).catch((error) => console.error("[yunyin] 存檔失敗", error));
}

export async function replaceSave(raw) {
  const normalized = normalizeSave(raw);
  delete normalized.fresh;
  normalized.lastSeenAt = Date.now();
  const snapshot = structuredClone(normalized);
  await saveFeatureEntity(DB_KEY, snapshot);
  announceSave(snapshot);
  return normalized;
}

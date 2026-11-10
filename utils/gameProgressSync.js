import { CRYSTAL_LEDGER_LIMIT, normalizeCrystalLedger } from "./crystalLedger.js";

const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const amount = (value) => Math.max(0, Math.round(Number(value) || 0));
const delta = (entry) => (entry?.type === "expense" ? -1 : 1) * amount(entry?.amount);
const keyCount = (value) => (isObject(value) ? Object.keys(value).length : 0);

function uniqueLedger(...ledgers) {
  const entries = new Map();
  ledgers.flat().forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const key = String(entry.id || `legacy:${entry.time || 0}:${index}`);
    const previous = entries.get(key);
    if (!previous || Number(entry.time || 0) >= Number(previous.time || 0)) entries.set(key, entry);
  });
  return [...entries.values()].sort((a, b) => Number(a.time || 0) - Number(b.time || 0));
}

function inferredBase(balance, ledger) {
  return Math.max(0, amount(balance) - ledger.reduce((total, entry) => total + delta(entry), 0));
}

// 帳本若還留著「初始結晶餘額」那筆，代表沒被 30 筆上限截斷，推算出的基底是準的。
const isCompleteLedger = (ledger) => ledger.some((entry) => entry?.type === "initial");
// 清空後重建的裝置：餘額 0、帳本只有一筆 0 的初始紀錄（或空的）。它沒有任何資訊，不能參與合併。
const isEmptyCrystalAccount = (balance, ledger) => amount(balance) === 0
  && ledger.every((entry) => entry?.type === "initial" && amount(entry.amount) === 0);

/**
 * Combines crystal ledger entries from two devices.
 *
 * Base rules: a device whose ledger was truncated to the last 30 entries knows
 * the balance before those entries; a device whose ledger still holds the
 * initial entry starts from zero. When both are truncated the lower base
 * wins so a stale device cannot manufacture crystals. When only one is
 * truncated, its base is the history the other side never saw, so it is kept
 * instead of being zeroed by a freshly reset device. An account with no
 * balance and no history is ignored entirely (MP-090).
 */
export function mergeCrystalSyncData(local = {}, remote = {}) {
  const localLedger = normalizeCrystalLedger(local.gachaCrystalLedger).reverse();
  const remoteLedger = normalizeCrystalLedger(remote.gachaCrystalLedger).reverse();
  if (!localLedger.length && !remoteLedger.length) {
    return { gachaCurrency: Math.max(amount(local.gachaCurrency), amount(remote.gachaCurrency)), gachaCrystalLedger: [] };
  }
  const localEmpty = isEmptyCrystalAccount(local.gachaCurrency, localLedger);
  const remoteEmpty = isEmptyCrystalAccount(remote.gachaCurrency, remoteLedger);
  if (localEmpty !== remoteEmpty) {
    const keep = localEmpty ? remote : local;
    const keepLedger = localEmpty ? remoteLedger : localLedger;
    return { gachaCurrency: amount(keep.gachaCurrency), gachaCrystalLedger: [...keepLedger].reverse() };
  }
  const allEntries = uniqueLedger(localLedger, remoteLedger);
  const localBase = inferredBase(local.gachaCurrency, localLedger);
  const remoteBase = inferredBase(remote.gachaCurrency, remoteLedger);
  const localComplete = isCompleteLedger(localLedger);
  const remoteComplete = isCompleteLedger(remoteLedger);
  let base;
  if (localComplete === remoteComplete) base = Math.min(localBase, remoteBase);
  else base = localComplete ? remoteBase : localBase;
  let balance = base;
  const withBalances = allEntries.map((entry) => {
    balance = Math.max(0, balance + delta(entry));
    return { ...entry, balanceAfter: balance };
  });
  return {
    gachaCurrency: balance,
    gachaCrystalLedger: withBalances.slice(-CRYSTAL_LEDGER_LIMIT).reverse(),
  };
}

const loginRewardProgress = (value) => {
  const claimed = Array.isArray(value?.claimedDates) ? value.claimedDates.filter((date) => typeof date === "string").length : 0;
  return claimed * 1000 + (Math.max(1, Number(value?.cycle) || 1) - 1) * 10 + (Number(value?.day) || 0);
};

/**
 * A claimed date must never become claimable again after switching devices.
 * The side with more recorded progress is the main body; a device that was
 * reset and claimed once must not pull a long streak back to day 1 (MP-090).
 */
export function mergeLoginRewardProgress(local, remote) {
  if (!isObject(remote)) return local || null;
  if (!isObject(local)) return remote;
  const claimedDates = [...new Set([...(local.claimedDates || []), ...(remote.claimedDates || [])])]
    .filter((value) => typeof value === "string")
    .sort()
    .slice(-20);
  const localProgress = loginRewardProgress(local);
  const remoteProgress = loginRewardProgress(remote);
  let main;
  if (remoteProgress !== localProgress) main = remoteProgress > localProgress ? remote : local;
  else main = String(remote.lastClaimDate || "") >= String(local.lastClaimDate || "") ? remote : local;
  return {
    ...main,
    cycle: Math.max(1, Number(local.cycle) || 1, Number(remote.cycle) || 1),
    claimedDates,
    lastClaimDate: claimedDates.at(-1) || main.lastClaimDate || "",
  };
}

// 山莊開局盤纏；與 yunyin/systems/save.js 的 defaultSave 一致。這裡不 import 山莊模組，避免同步工具拖進遊戲資料。
const YUNYIN_STARTING_COINS = 100;

/**
 * True when a villa save shows any sign of play. A save that is still at the
 * starting values is what a wiped device creates on its first visit; it must
 * never beat a real save just because it was created later.
 */
export function hasYunyinProgress(save) {
  if (!isObject(save)) return false;
  if (Number(save.coins) !== YUNYIN_STARTING_COINS && save.coins !== undefined) return true;
  const cultivation = isObject(save.cultivation) ? save.cultivation : {};
  if ((Number(cultivation.realmIdx) || 0) > 0 || (Number(cultivation.exp) || 0) > 0) return true;
  if (keyCount(save.inventory) > 0 || keyCount(save.blueprints) > 0 || keyCount(save.linePacks) > 0) return true;
  const farm = isObject(save.farm) ? save.farm : {};
  if (Array.isArray(farm.plots) && farm.plots.some((plot) => plot?.cropId)) return true;
  if (keyCount(farm.npcFields) > 0) return true;
  const shop = isObject(save.shop) ? save.shop : {};
  if (shop.lastOrderDay || (Array.isArray(shop.orders) && shop.orders.length)) return true;
  if (Array.isArray(shop.shelves) && shop.shelves.some((shelf) => shelf?.itemId || (Number(shelf?.stock) || 0) > 0)) return true;
  if (Array.isArray(shop.furnaces) && shop.furnaces.some((furnace) => furnace?.recipeId)) return true;
  if (isObject(save.dungeon) && (save.dungeon.lastResetDay || save.dungeon.activeRun)) return true;
  if (isObject(save.hall) && save.hall.lastMeditateDay) return true;
  if (isObject(save.settings) && keyCount(save.settings.bindings) > 0) return true;
  const home = isObject(save.home) ? save.home : {};
  if (keyCount(home.residents) > 0 || keyCount(home.relationships) > 0 || keyCount(home.residentLinePacks) > 0) return true;
  return false;
}

/**
 * Yunyin has a single save slot. A save with progress always beats a pristine
 * one; between two played saves the last played one is authoritative.
 */
export function newestYunyinSave(local, remote) {
  if (!isObject(remote)) return local || null;
  if (!isObject(local)) return remote;
  const localPlayed = hasYunyinProgress(local);
  const remotePlayed = hasYunyinProgress(remote);
  if (localPlayed !== remotePlayed) return localPlayed ? local : remote;
  return Number(remote.lastSeenAt || 0) >= Number(local.lastSeenAt || 0) ? remote : local;
}

/** Mail content is bundled with the app; only read and claimed flags sync. */
export function mergeSystemMailboxState(local, remote) {
  if (!isObject(remote)) return local || null;
  if (!isObject(local)) return remote;
  const unique = (key) => [...new Set([...(local[key] || []), ...(remote[key] || [])]
    .filter((value) => value !== null && value !== undefined)
    .map(String))];
  return {
    readMailIds: unique("readMailIds"),
    claimedGrantIds: unique("claimedGrantIds"),
  };
}

export function mergeGameProgressSyncData(local = {}, remote = {}) {
  const crystals = mergeCrystalSyncData(local, remote);
  return {
    ...crystals,
    loginReward: mergeLoginRewardProgress(local.loginReward, remote.loginReward),
    yunyinSave: newestYunyinSave(local.yunyinSave, remote.yunyinSave),
    systemMailbox: mergeSystemMailboxState(local.systemMailbox, remote.systemMailbox),
  };
}

const hasEntries = (value) => Array.isArray(value) && value.length > 0;
const hasKeys = (value) => isObject(value) && Object.keys(value).length > 0;
const timeOf = (item) => Number(item?.updatedAt) || Number(item?.createdAt) || 0;

/** 依 id 聯集兩邊；同一 id 取較新的（沒有時間就取雲端那份）。順序：較新的在前。 */
function unionById(local, remote) {
  const byId = new Map();
  for (const item of Array.isArray(local) ? local : []) if (isObject(item) && item.id != null) byId.set(String(item.id), item);
  for (const item of Array.isArray(remote) ? remote : []) {
    if (!isObject(item) || item.id == null) continue;
    const key = String(item.id);
    const current = byId.get(key);
    if (!current || timeOf(item) >= timeOf(current)) byId.set(key, item);
  }
  return [...byId.values()].sort((a, b) => timeOf(b) - timeOf(a));
}

const unionListsById = (local, remote) => {
  const byId = new Map();
  for (const item of Array.isArray(local) ? local : []) if (isObject(item) && item.id != null) byId.set(String(item.id), item);
  for (const item of Array.isArray(remote) ? remote : []) if (isObject(item) && item.id != null) byId.set(String(item.id), { ...(byId.get(String(item.id)) || {}), ...item });
  return [...byId.values()];
};

/**
 * 情侶空間（ent_coupleDaily，2026-10-29 起上雲端）：長期資料依角色分開存在頂層欄位，
 * 約定／紀念日依 id 聯集（雲端那份的欄位優先）、最高溫度取大、暱稱雲端有就用雲端；
 * 每日重建的 store 與其他欄位以雲端為準、雲端沒有就留本機。兩邊都沒有就是 null。
 */
export function mergeCoupleDaily(local, remote) {
  if (!isObject(remote)) return isObject(local) ? local : null;
  if (!isObject(local)) return remote;
  const merged = { ...local, ...remote };
  for (const field of ["_promises", "_anniversaries"]) {
    const chars = new Set([...Object.keys(local[field] || {}), ...Object.keys(remote[field] || {})]);
    if (!chars.size) continue;
    merged[field] = Object.fromEntries([...chars].map((charId) => [charId, unionListsById(local[field]?.[charId], remote[field]?.[charId])]));
  }
  const peakChars = new Set([...Object.keys(local._peakTemp || {}), ...Object.keys(remote._peakTemp || {})]);
  if (peakChars.size) {
    merged._peakTemp = Object.fromEntries([...peakChars].map((charId) => [charId, Math.max(Number(local._peakTemp?.[charId]) || 0, Number(remote._peakTemp?.[charId]) || 0)]));
  }
  if (isObject(local._nicknames) || isObject(remote._nicknames)) merged._nicknames = { ...(local._nicknames || {}), ...(remote._nicknames || {}) };
  return merged;
}

/**
 * 卡片背包、特別篇、特別記憶、抽卡進度、寵物小屋、情侶空間的下載合併（MP-093）。
 * - 背包：依 uid 聯集（結晶帳本兩邊都算，抽到的卡也不能少一邊），再扣掉任何一段特別篇已經用掉的 uid，
 *   用掉的卡不會因為另一邊還沒更新而變回來。
 * - 特別篇／特別記憶：依 id 聯集，同一段取較新的；本機獨有的（例如還沒上傳的那一段）不會消失。
 * - 抽卡進度：取累計抽數多的那一邊（保底計數跟著它走），兩邊一樣多取雲端。
 * - 寵物小屋：雲端有內容就以雲端為準，否則留本機（結構不透明，不逐欄合併）。
 */
export function mergeCollectionSyncData(local = {}, remote = {}) {
  const safeLocal = isObject(local) ? local : {};
  const safeRemote = isObject(remote) ? remote : {};
  const result = {};
  result.gachaEpisodes = unionById(safeLocal.gachaEpisodes, safeRemote.gachaEpisodes);
  const consumed = new Set(result.gachaEpisodes.map((episode) => episode?.item?.uid).filter((uid) => uid != null).map(String));
  const byUid = new Map();
  for (const item of Array.isArray(safeRemote.gachaInventory) ? safeRemote.gachaInventory : []) if (isObject(item) && item.uid != null) byUid.set(String(item.uid), item);
  for (const item of Array.isArray(safeLocal.gachaInventory) ? safeLocal.gachaInventory : []) if (isObject(item) && item.uid != null && !byUid.has(String(item.uid))) byUid.set(String(item.uid), item);
  result.gachaInventory = [...byUid.values()].filter((item) => !consumed.has(String(item.uid)));
  result.gachaSpecialMemories = unionById(safeLocal.gachaSpecialMemories, safeRemote.gachaSpecialMemories);
  const localDraws = Number(safeLocal.gachaProgress?.totalDrawCount) || 0;
  const remoteDraws = Number(safeRemote.gachaProgress?.totalDrawCount) || 0;
  if (isObject(safeRemote.gachaProgress) && remoteDraws >= localDraws) result.gachaProgress = safeRemote.gachaProgress;
  else if (isObject(safeLocal.gachaProgress)) result.gachaProgress = safeLocal.gachaProgress;
  else result.gachaProgress = isObject(safeRemote.gachaProgress) ? safeRemote.gachaProgress : null;
  result.petHome = hasKeys(safeRemote.petHome) ? safeRemote.petHome : (safeLocal.petHome ?? null);
  result.coupleDaily = mergeCoupleDaily(safeLocal.coupleDaily, safeRemote.coupleDaily);
  const personaIds = new Set([...Object.keys(isObject(safeLocal.personaFeatures) ? safeLocal.personaFeatures : {}), ...Object.keys(isObject(safeRemote.personaFeatures) ? safeRemote.personaFeatures : {})]);
  result.personaFeatures = Object.fromEntries([...personaIds].map((personaId) => {
    const localFeatures = isObject(safeLocal.personaFeatures?.[personaId]) ? safeLocal.personaFeatures[personaId] : {};
    const remoteFeatures = isObject(safeRemote.personaFeatures?.[personaId]) ? safeRemote.personaFeatures[personaId] : {};
    const coupleDaily = mergeCoupleDaily(localFeatures.coupleDaily, remoteFeatures.coupleDaily);
    // 信風等其他人格存檔不在雲端文件裡，留本機那份。
    return [personaId, { ...localFeatures, ...(coupleDaily ? { coupleDaily } : {}) }];
  }));
  return result;
}

/**
 * Feature data after downloading the account text document. The cloud
 * document always carries every text-sync key, so an empty `notes` or a null
 * `calendar` there means "nothing uploaded", not "delete mine" (MP-090).
 * Collections (cards, episodes, memories, pets) merge by mergeCollectionSyncData (MP-093);
 * device-only stores (petSettings, musicPlayer, storePurchases, aiUsage) stay as they are.
 */
export function mergeTextSyncFeatureData(local = {}, remote = {}) {
  const safeLocal = isObject(local) ? local : {};
  const safeRemote = isObject(remote) ? remote : {};
  const merged = { ...safeLocal, ...safeRemote, ...mergeGameProgressSyncData(safeLocal, safeRemote), ...mergeCollectionSyncData(safeLocal, safeRemote) };
  if (!(Array.isArray(safeRemote.notes) && safeRemote.notes.length)) {
    if (safeLocal.notes !== undefined) merged.notes = safeLocal.notes;
    else delete merged.notes;
  }
  if (!isObject(safeRemote.calendar)) {
    if (safeLocal.calendar !== undefined) merged.calendar = safeLocal.calendar;
    else delete merged.calendar;
  }
  return merged;
}

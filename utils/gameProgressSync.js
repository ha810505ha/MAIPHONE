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

/**
 * Feature data after downloading the account text document. The cloud
 * document always carries every text-sync key, so an empty `notes` or a null
 * `calendar` there means "nothing uploaded", not "delete mine" (MP-090).
 * Media-related stores (pets, cards, episodes) stay as they are on this device.
 */
export function mergeTextSyncFeatureData(local = {}, remote = {}) {
  const safeLocal = isObject(local) ? local : {};
  const safeRemote = isObject(remote) ? remote : {};
  const merged = { ...safeLocal, ...safeRemote, ...mergeGameProgressSyncData(safeLocal, safeRemote) };
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

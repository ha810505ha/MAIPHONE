import { CRYSTAL_LEDGER_LIMIT, normalizeCrystalLedger } from "./crystalLedger.js";

const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const amount = (value) => Math.max(0, Math.round(Number(value) || 0));
const delta = (entry) => (entry?.type === "expense" ? -1 : 1) * amount(entry?.amount);

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

/**
 * Combines crystal ledger entries from two devices. The lower inferred base
 * prevents a stale device from manufacturing crystals during a merge.
 */
export function mergeCrystalSyncData(local = {}, remote = {}) {
  const localLedger = normalizeCrystalLedger(local.gachaCrystalLedger).reverse();
  const remoteLedger = normalizeCrystalLedger(remote.gachaCrystalLedger).reverse();
  if (!localLedger.length && !remoteLedger.length) {
    return { gachaCurrency: Math.max(amount(local.gachaCurrency), amount(remote.gachaCurrency)), gachaCrystalLedger: [] };
  }
  const allEntries = uniqueLedger(localLedger, remoteLedger);
  const base = Math.min(
    inferredBase(local.gachaCurrency, localLedger),
    inferredBase(remote.gachaCurrency, remoteLedger),
  );
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

/** A claimed date must never become claimable again after switching devices. */
export function mergeLoginRewardProgress(local, remote) {
  if (!isObject(remote)) return local || null;
  if (!isObject(local)) return remote;
  const claimedDates = [...new Set([...(local.claimedDates || []), ...(remote.claimedDates || [])])]
    .filter((value) => typeof value === "string")
    .sort()
    .slice(-20);
  const newest = String(remote.lastClaimDate || "") >= String(local.lastClaimDate || "") ? remote : local;
  return {
    ...newest,
    cycle: Math.max(1, Number(local.cycle) || 1, Number(remote.cycle) || 1),
    claimedDates,
    lastClaimDate: claimedDates.at(-1) || newest.lastClaimDate || "",
  };
}

/** Yunyin has a single save slot, so the last played save is authoritative. */
export function newestYunyinSave(local, remote) {
  if (!isObject(remote)) return local || null;
  if (!isObject(local)) return remote;
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

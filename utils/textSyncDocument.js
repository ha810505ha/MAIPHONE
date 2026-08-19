const DATA_IMAGE_RE = /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i;
const RAW_BASE64_RE = /^[a-z0-9+/=\s]{128,}$/i;

const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function isMediaValue(value, key) {
  return typeof value === "string" && (
    DATA_IMAGE_RE.test(value)
    || (isMediaKey(key) && RAW_BASE64_RE.test(value))
  );
}

function isMediaKey(key) {
  const normalized = String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return ["avatar", "image", "photo", "thumbnail", "cover", "hero", "background", "banner", "wallpaper"]
    .some((name) => normalized.includes(name));
}

function itemLookup(items) {
  const byId = new Map();
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    if (!isObject(item)) return;
    const id = item.id ?? item.messageId ?? item.characterId;
    if (id !== null && id !== undefined && id !== "") byId.set(String(id), item);
    byId.set(`@index:${index}`, item);
  });
  return byId;
}

/** Removes inline images without changing any text or structured game data. */
export function stripTextSyncMedia(value, key = "") {
  if (isMediaKey(key) || isMediaValue(value, key)) return undefined;
  if (Array.isArray(value)) return value.map((item) => stripTextSyncMedia(item)).filter((item) => item !== undefined);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .map(([childKey, childValue]) => [childKey, stripTextSyncMedia(childValue, childKey)])
    .filter(([, childValue]) => childValue !== undefined));
}

/**
 * Adds this device's media back after receiving text-only cloud data. A text
 * sync must never delete local avatars, chat images, or backgrounds.
 */
export function preserveLocalMedia(remote, local, key = "") {
  if (isMediaKey(key) || isMediaValue(local, key)) return local;
  if (Array.isArray(remote)) {
    const localItems = itemLookup(local);
    return remote.map((item, index) => {
      if (!isObject(item)) return item;
      const id = item.id ?? item.messageId ?? item.characterId;
      const localItem = (id !== null && id !== undefined && id !== "" ? localItems.get(String(id)) : null)
        || localItems.get(`@index:${index}`);
      return preserveLocalMedia(item, localItem, key);
    });
  }
  if (!isObject(remote)) return remote;
  const result = {};
  for (const [childKey, remoteValue] of Object.entries(remote)) {
    result[childKey] = preserveLocalMedia(remoteValue, local?.[childKey], childKey);
  }
  if (isObject(local)) {
    for (const [childKey, localValue] of Object.entries(local)) {
      if (!hasOwn(result, childKey) && (isMediaKey(childKey) || isMediaValue(localValue, childKey))) {
        result[childKey] = localValue;
      }
    }
  }
  return result;
}

export function createTextSyncDocument(appState, { version = "" } = {}) {
  const state = stripTextSyncMedia(appState);
  // Keep media-related stores local. Text-first data and the small shared game
  // progress stores below are safe to put in the account document.
  const featureData = state.featureData && typeof state.featureData === "object"
    ? {
      notes: Array.isArray(state.featureData.notes) ? state.featureData.notes : [],
      calendar: state.featureData.calendar && typeof state.featureData.calendar === "object"
        ? state.featureData.calendar
        : null,
      loginReward: state.featureData.loginReward && typeof state.featureData.loginReward === "object"
        ? state.featureData.loginReward
        : null,
      yunyinSave: state.featureData.yunyinSave && typeof state.featureData.yunyinSave === "object"
        ? state.featureData.yunyinSave
        : null,
      systemMailbox: state.featureData.systemMailbox && typeof state.featureData.systemMailbox === "object"
        ? state.featureData.systemMailbox
        : null,
      gachaCurrency: Number.isFinite(Number(state.featureData.gachaCurrency))
        ? Math.max(0, Number(state.featureData.gachaCurrency))
        : 0,
      gachaCrystalLedger: Array.isArray(state.featureData.gachaCrystalLedger)
        ? state.featureData.gachaCrystalLedger
        : [],
    }
    : { notes: [], calendar: null, loginReward: null, yunyinSave: null, systemMailbox: null, gachaCurrency: 0, gachaCrystalLedger: [] };
  state.featureData = featureData;
  // Wallets are kept as a separate append-only ledger payload. The import path
  // merges these entries rather than letting the rest of app state overwrite a
  // second device's transactions.
  state.walletData = {
    wallet: state.wallet || { balance: 0, transactions: [], assets: [] },
    characterWallets: state.characterWallets || {},
    transfers: Array.isArray(state.transfers) ? state.transfers : [],
  };
  delete state.wallet;
  delete state.characterWallets;
  delete state.transfers;
  delete state.localAppData;
  return {
    format: "maliphone-text-sync",
    formatVersion: 1,
    version,
    exportedAt: new Date().toISOString(),
    state,
  };
}

export function validateTextSyncDocument(document) {
  if (!isObject(document) || document.format !== "maliphone-text-sync" || Number(document.formatVersion) !== 1 || !isObject(document.state)) {
    throw new Error("Invalid text sync document");
  }
  return document;
}

import { getCloudMediaKind, getCloudMediaName, isCloudMediaRef } from "./cloudMediaRefs.js";

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

function mapTextSyncMedia(value, resolveImage, key = "", inherited = "", mediaOnly = false) {
  const kind = getCloudMediaKind(key, inherited);
  if (isMediaKey(key) && !kind) return undefined;
  if (typeof value === "string" && DATA_IMAGE_RE.test(value)) {
    return kind ? resolveImage(value, kind) : undefined;
  }
  if (isMediaValue(value, key) || isCloudMediaRef(value)) return undefined;
  const onlyRefs = mediaOnly || isMediaKey(key);
  if (Array.isArray(value)) {
    const items = value.map((item) => mapTextSyncMedia(item, resolveImage, "", kind, onlyRefs));
    if (onlyRefs) return items.some((item) => item !== undefined) ? items.map((item) => item ?? null) : undefined;
    return items.filter((item) => item !== undefined);
  }
  if (!isObject(value)) return onlyRefs ? undefined : value;
  const entries = Object.entries(value)
    .map(([childKey, childValue]) => [childKey, mapTextSyncMedia(childValue, resolveImage, childKey, kind, onlyRefs)])
    .filter(([, childValue]) => childValue !== undefined);
  return onlyRefs && !entries.length ? undefined : Object.fromEntries(entries);
}

/** Collect only images that can occur in the text-sync document. */
export function collectTextSyncMedia(appState) {
  const sources = new Map();
  const featureKeys = ["notes", "calendar", "loginReward", "yunyinSave", "systemMailbox", "gachaCurrency", "gachaCrystalLedger"];
  const state = {
    ...appState,
    featureData: Object.fromEntries(featureKeys.map((key) => [key, appState?.featureData?.[key]])),
  };
  delete state.localAppData;
  mapTextSyncMedia(state, (dataUrl, kind) => {
    // If shared by an avatar and a background, the smaller avatar limit wins.
    if (!sources.has(dataUrl) || kind === "avatar") sources.set(dataUrl, kind);
    return undefined;
  });
  return sources;
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

export function createTextSyncDocument(appState, { version = "", mediaRefs } = {}) {
  const state = mediaRefs
    ? mapTextSyncMedia(appState, (dataUrl) => {
      const ref = mediaRefs.get(dataUrl);
      return getCloudMediaName(ref) ? ref : undefined;
    })
    : stripTextSyncMedia(appState);
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

/** Resolve cloud images only into empty fields, keeping every local media value. */
export async function hydrateTextSyncMedia(remote, local, download) {
  const downloads = new Map();
  let downloaded = 0;
  let failed = 0;
  const resolve = (ref) => {
    if (!downloads.has(ref)) {
      downloads.set(ref, Promise.resolve().then(() => download(ref)).then((dataUrl) => {
        if (typeof dataUrl !== "string" || !DATA_IMAGE_RE.test(dataUrl)) throw new Error("Invalid cloud image");
        downloaded += 1;
        return dataUrl;
      }).catch(() => {
        failed += 1;
        return undefined;
      }));
    }
    return downloads.get(ref);
  };
  const hasLocalValue = (value) => value !== undefined && value !== null && value !== "" && !isCloudMediaRef(value);
  const merge = async (remoteValue, localValue, key = "", inherited = "", mediaOnly = false) => {
    const kind = getCloudMediaKind(key, inherited);
    if (isCloudMediaRef(remoteValue)) {
      if (hasLocalValue(localValue)) return localValue;
      return kind && getCloudMediaName(remoteValue) ? resolve(remoteValue) : undefined;
    }
    if (isMediaValue(localValue, key)) return localValue;
    if (isMediaKey(key) && !kind) return localValue;
    const onlyMedia = mediaOnly || isMediaKey(key);
    if (onlyMedia && hasLocalValue(localValue) && !isObject(localValue) && !Array.isArray(localValue)) return localValue;
    if (onlyMedia && ((Array.isArray(remoteValue) && isObject(localValue)) || (isObject(remoteValue) && Array.isArray(localValue)))) return localValue;
    if (Array.isArray(remoteValue)) {
      const localItems = itemLookup(localValue);
      const localList = Array.isArray(localValue) ? localValue : [];
      const items = onlyMedia ? localList.slice() : [];
      for (let index = 0; index < remoteValue.length; index += 1) {
        const item = remoteValue[index];
        const id = isObject(item) ? (item.id ?? item.messageId ?? item.characterId) : null;
        const hasId = id !== null && id !== undefined && id !== "";
        const localItem = hasId
          ? localItems.get(String(id))
          : localList[index];
        const merged = await merge(item, localItem, "", kind, onlyMedia);
        if (!onlyMedia) items.push(merged);
        else if (merged !== undefined) {
          // Fill media arrays in place so omitted or reordered local images survive.
          const localIndex = hasId ? localList.indexOf(localItem) : index;
          items[localIndex >= 0 ? localIndex : items.length] = merged;
        }
      }
      return items;
    }
    if (!isObject(remoteValue)) return onlyMedia || isMediaValue(remoteValue, key) ? localValue : remoteValue;
    const result = onlyMedia && isObject(localValue) ? { ...localValue } : {};
    for (const [childKey, childValue] of Object.entries(remoteValue)) {
      const merged = await merge(childValue, localValue?.[childKey], childKey, kind, onlyMedia);
      if (merged !== undefined) result[childKey] = merged;
    }
    if (isObject(localValue)) {
      for (const [childKey, childValue] of Object.entries(localValue)) {
        if (!hasOwn(result, childKey) && (onlyMedia || isMediaKey(childKey) || isMediaValue(childValue, childKey))) result[childKey] = childValue;
      }
    }
    return result;
  };
  const removeRefs = (value) => {
    if (isCloudMediaRef(value)) return undefined;
    if (Array.isArray(value)) return value.map((item) => removeRefs(item) ?? null);
    if (!isObject(value)) return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, removeRefs(child)]).filter(([, child]) => child !== undefined));
  };
  return { state: removeRefs(await merge(remote, local)), downloaded, failed };
}

export function validateTextSyncDocument(document) {
  if (!isObject(document) || document.format !== "maliphone-text-sync" || Number(document.formatVersion) !== 1 || !isObject(document.state)) {
    throw new Error("Invalid text sync document");
  }
  return document;
}

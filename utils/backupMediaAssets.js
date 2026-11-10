import { normalizeImagePayload } from "./imagePayload.js";

const DATA_IMAGE_RE = /^data:(image\/(?:png|jpe?g|gif|webp));base64,([a-z0-9+/=\s]+)$/i;
const RAW_IMAGE_KEYS = new Set(["image"]);
const RAW_BASE64_RE = /^[a-z0-9+/=\s]{128,}$/i;

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

const toHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

async function assetIdFor(value) {
  const bytes = new TextEncoder().encode(value);
  if (!globalThis.crypto?.subtle) throw new Error("Secure hashing is unavailable in this runtime");
  return `sha256-${toHex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)))}`;
}

function parseImageValue(value, key) {
  if (typeof value !== "string") return null;
  const dataImage = value.match(DATA_IMAGE_RE);
  if (dataImage) return { encoding: "data-url", mimeType: normalizeImagePayload(value, dataImage[1]).mimeType, data: value };
  if (RAW_IMAGE_KEYS.has(key) && RAW_BASE64_RE.test(value)) {
    const image = normalizeImagePayload(value);
    return { encoding: "raw-base64", mimeType: image.mimeType, data: image.data };
  }
  return null;
}

/**
 * Makes a portable, single-file backup compact without changing the runtime
 * state shape. Identical embedded image payloads are moved into `assets` once.
 */
export async function packBackupMedia(state) {
  const assets = {};
  const assetIds = new Map();

  const visit = async (value, key = "") => {
    const media = parseImageValue(value, key);
    if (media) {
      let id = assetIds.get(media.data);
      if (!id) {
        id = await assetIdFor(media.data);
        assetIds.set(media.data, id);
        assets[id] = media;
      }
      return { $asset: id };
    }
    if (Array.isArray(value)) return Promise.all(value.map((item) => visit(item)));
    if (!isPlainObject(value)) return value;
    if (typeof value.$asset === "string" && Object.keys(value).length === 1) return value;
    const result = {};
    for (const [childKey, childValue] of Object.entries(value)) result[childKey] = await visit(childValue, childKey);
    return result;
  };

  return { state: await visit(state), assets };
}

/** Restores format v2 asset references to the data strings expected by current UI code. */
export function unpackBackupMedia(state, assets = {}) {
  const visit = (value) => {
    if (Array.isArray(value)) return value.map(visit);
    if (!isPlainObject(value)) return value;
    if (typeof value.$asset === "string" && Object.keys(value).length === 1) {
      const asset = assets[value.$asset];
      if (!asset || typeof asset.data !== "string") return "";
      return asset.encoding === "raw-base64" ? asset.data : asset.data;
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child)]));
  };
  return visit(state);
}

/** Active persona data is identical to top-level state, so it need not be serialized twice. */
export function compactActivePersona(personas, activePersonaId) {
  if (!isPlainObject(personas) || !activePersonaId || !isPlainObject(personas[activePersonaId])) return personas;
  return {
    ...personas,
    [activePersonaId]: {
      ...personas[activePersonaId],
      data: undefined,
      activeDataInTopLevel: true,
    },
  };
}

export function restoreActivePersona(personas, activePersonaId, topLevelState) {
  if (!isPlainObject(personas) || !activePersonaId || !personas[activePersonaId]?.activeDataInTopLevel) return personas;
  const { personas: _personas, activePersonaId: _activePersonaId, ...personaData } = topLevelState || {};
  return {
    ...personas,
    [activePersonaId]: {
      ...personas[activePersonaId],
      data: personaData,
      activeDataInTopLevel: undefined,
    },
  };
}

/** Omits migrated localStorage mirrors when their canonical feature entity exists. */
export function compactLegacyLocalData(localData, featureData) {
  if (!isPlainObject(localData) || !isPlainObject(featureData)) return localData;
  const next = { ...localData };
  if (isPlainObject(featureData.yunyinSave)) delete next.mali_yunyin_save_v1;
  if (isPlainObject(featureData.petHome)) delete next["maliphone-pet-home"];
  if (isPlainObject(featureData.petSettings)) {
    delete next["maliphone-pet-settings"];
    delete next["maliphone-pet-cooldown-until"];
  }
  return next;
}

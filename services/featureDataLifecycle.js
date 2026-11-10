export const FEATURE_DATA_CHANGED_EVENT = "maliphone:feature-data-changed";

const normalizeKeys = (keys) => [...new Set(Array.from(keys || []).map(String).filter(Boolean))];

export function dispatchFeatureDataChanged(keys, reason = "update") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FEATURE_DATA_CHANGED_EVENT, {
    detail: { keys: normalizeKeys(keys), reason },
  }));
}

export function featureDataEventIncludes(event, keys) {
  const changed = Array.isArray(event?.detail?.keys) ? event.detail.keys : [];
  const expected = Array.isArray(keys) ? keys : [keys];
  return changed.length === 0 || expected.some((key) => changed.includes(key));
}

// 本機存檔真的寫進 IndexedDB 時廣播（主資料實體或功能存檔有變）；自動同步靠它知道「有東西要上傳」（MP-094）。
export const APP_DATA_SAVED_EVENT = "maliphone:app-data-saved";

export function dispatchAppDataSaved(keys, reason = "save") {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(APP_DATA_SAVED_EVENT, { detail: { keys: normalizeKeys(keys), reason } }));
  } catch {}
}

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

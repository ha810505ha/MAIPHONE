import { DEFAULT_PERSONA_ID } from "./personaModel.js";

const ACTIVE_PERSONA_KEY = "mali_active_persona_id";
const SCOPED_FEATURE_KEYS = new Set([
  "ent_coupleDaily",
  "ent_dating",
]);

export function getActivePersonaStorageId() {
  try {
    return localStorage.getItem(ACTIVE_PERSONA_KEY) || DEFAULT_PERSONA_ID;
  } catch {
    return DEFAULT_PERSONA_ID;
  }
}

export function setActivePersonaStorageId(personaId) {
  const safeId = String(personaId || DEFAULT_PERSONA_ID);
  try { localStorage.setItem(ACTIVE_PERSONA_KEY, safeId); } catch {}
  return safeId;
}

export const isPersonaScopedFeatureKey = (key) => SCOPED_FEATURE_KEYS.has(String(key));

export function resolvePersonaFeatureKey(key, personaId = getActivePersonaStorageId()) {
  const baseKey = String(key);
  if (!isPersonaScopedFeatureKey(baseKey)) return baseKey;
  const suffix = baseKey.slice("ent_".length);
  return `ent_persona_${String(personaId)}_${suffix}`;
}

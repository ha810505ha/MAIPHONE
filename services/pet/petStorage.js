import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";

export const PET_HOME_KEY = "ent_petHome";
export const PET_SETTINGS_KEY = "ent_petSettings";
export const DEFAULT_PET_SETTINGS = { reminders: false, autoWander: true, desktopPet: false, desktopPetReturnMinutes: 5, cooldownUntil: 0, aiDiary: true };

const readLegacyJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch { return fallback; } };

export async function loadPetStorage(initialHome) {
  const [storedHome, storedSettings] = await Promise.all([
    loadFeatureEntity(PET_HOME_KEY, null),
    loadFeatureEntity(PET_SETTINGS_KEY, null),
  ]);
  const legacyHome = readLegacyJson("maliphone-pet-home", null);
  const legacySettings = readLegacyJson("maliphone-pet-settings", null);
  const legacyCooldown = Number(localStorage.getItem("maliphone-pet-cooldown-until")) || 0;
  const home = storedHome && typeof storedHome === "object" ? storedHome : (legacyHome || initialHome);
  const settings = { ...DEFAULT_PET_SETTINGS, ...(storedSettings && typeof storedSettings === "object" ? storedSettings : legacySettings || {}), ...(!storedSettings && legacyCooldown ? { cooldownUntil: legacyCooldown } : {}) };
  if (!storedHome) await saveFeatureEntity(PET_HOME_KEY, home);
  if (!storedSettings) await saveFeatureEntity(PET_SETTINGS_KEY, settings);
  try { localStorage.removeItem("maliphone-pet-home"); localStorage.removeItem("maliphone-pet-settings"); localStorage.removeItem("maliphone-pet-cooldown-until"); } catch (_) {}
  return { home, settings };
}

export const savePetHome = (data) => saveFeatureEntity(PET_HOME_KEY, data);
export async function savePetSettingsPatch(patch) {
  const current = await loadFeatureEntity(PET_SETTINGS_KEY, DEFAULT_PET_SETTINGS);
  const next = { ...DEFAULT_PET_SETTINGS, ...(current || {}), ...(patch || {}) };
  await saveFeatureEntity(PET_SETTINGS_KEY, next);
  return next;
}

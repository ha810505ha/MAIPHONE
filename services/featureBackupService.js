import { loadFeatureEntity, saveFeatureEntity } from "../utils/indexedDbStorage";

const FEATURE_EXPORTS = {
  yunyinSave: ["ent_yunyinSave", null],
  gachaCurrency: ["ent_gachaCurrency", null],
  petHome: ["ent_petHome", null],
  petSettings: ["ent_petSettings", null],
  notes: ["ent_notes", []],
  loginReward: ["ent_loginReward", null],
};

export async function loadFeatureBackup() {
  const entries = await Promise.all(Object.entries(FEATURE_EXPORTS).map(async ([name, [key, fallback]]) => [name, await loadFeatureEntity(key, fallback)]));
  return Object.fromEntries(entries);
}

export function summarizeFeatureBackup(src = {}) {
  return {
    notes: Array.isArray(src.featureData?.notes) ? src.featureData.notes.length : 0,
    loginReward: !!src.featureData?.loginReward,
    petHome: !!src.featureData?.petHome || !!src.localAppData?.["maliphone-pet-home"],
    yunyin: !!src.featureData?.yunyinSave || !!src.localAppData?.["mali_yunyin_save_v1"],
  };
}

export async function restoreFeatureBackup(src = {}) {
  const data = src.featureData || {};
  if (data.yunyinSave && typeof data.yunyinSave === "object") await saveFeatureEntity("ent_yunyinSave", data.yunyinSave);
  else if (src.localAppData?.["mali_yunyin_save_v1"]) { try { await saveFeatureEntity("ent_yunyinSave", JSON.parse(src.localAppData["mali_yunyin_save_v1"])); } catch (_) {} }
  if (Number.isFinite(Number(data.gachaCurrency))) {
    await saveFeatureEntity("ent_gachaCurrency", Math.max(0, Number(data.gachaCurrency)));
    window.dispatchEvent(new Event("gacha-storage-updated"));
  }
  if (data.petHome && typeof data.petHome === "object") await saveFeatureEntity("ent_petHome", data.petHome);
  else if (src.localAppData?.["maliphone-pet-home"]) { try { await saveFeatureEntity("ent_petHome", JSON.parse(src.localAppData["maliphone-pet-home"])); } catch (_) {} }
  if (data.petSettings && typeof data.petSettings === "object") await saveFeatureEntity("ent_petSettings", data.petSettings);
  else if (src.localAppData?.["maliphone-pet-settings"]) {
    try { const settings = JSON.parse(src.localAppData["maliphone-pet-settings"]); await saveFeatureEntity("ent_petSettings", { ...settings, cooldownUntil: Number(src.localAppData["maliphone-pet-cooldown-until"]) || 0 }); } catch (_) {}
  }
  if (data.petSettings || src.localAppData?.["maliphone-pet-settings"]) window.dispatchEvent(new Event("pet-settings-changed"));
  if (Array.isArray(data.notes)) await saveFeatureEntity("ent_notes", data.notes);
  if (data.loginReward && typeof data.loginReward === "object") await saveFeatureEntity("ent_loginReward", data.loginReward);
}

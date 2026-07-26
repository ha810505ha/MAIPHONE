import { loadFeatureEntity, saveFeatureEntities } from "../utils/indexedDbStorage";
import { compactGachaEpisodeImages } from "../utils/persistedMediaCleanup";

const FEATURE_EXPORTS = {
  gachaInventory: ["ent_gachaInventory", []],
  gachaEpisodes: ["ent_gachaEpisodes", []],
  gachaCurrency: ["ent_gachaCurrency", null],
  gachaCrystalLedger: ["ent_gachaCrystalLedger", null],
  gachaProgress: ["ent_gachaProgress", { totalDrawCount: 0, drawsSinceLastSSR: 0 }],
  gachaSpecialMemories: ["ent_gachaSpecialMemories", []],
  coupleDaily: ["ent_coupleDaily", null],
  calendar: ["ent_calendar", null],
  musicPlayer: ["ent_musicPlayer", null],
  notes: ["ent_notes", []],
  loginReward: ["ent_loginReward", null],
  petHome: ["ent_petHome", null],
  petSettings: ["ent_petSettings", null],
  yunyinSave: ["ent_yunyinSave", null],
  systemMailbox: ["ent_systemMailbox", null],
  dating: ["ent_dating", null],
};

export async function loadFeatureBackup(characters = [], { compactImages = true } = {}) {
  const entries = await Promise.all(Object.entries(FEATURE_EXPORTS).map(async ([name, [key, fallback]]) => [name, await loadFeatureEntity(key, fallback)]));
  const backup = Object.fromEntries(entries);
  if (compactImages) backup.gachaEpisodes = compactGachaEpisodeImages(backup.gachaEpisodes, characters);
  return backup;
}

export function summarizeFeatureBackup(src = {}) {
  return {
    notes: Array.isArray(src.featureData?.notes) ? src.featureData.notes.length : 0,
    gachaInventory: Array.isArray(src.featureData?.gachaInventory) ? src.featureData.gachaInventory.length : 0,
    gachaEpisodes: Array.isArray(src.featureData?.gachaEpisodes) ? src.featureData.gachaEpisodes.length : 0,
    loginReward: !!src.featureData?.loginReward,
    petHome: !!src.featureData?.petHome || !!src.localAppData?.["maliphone-pet-home"],
    yunyin: !!src.featureData?.yunyinSave || !!src.localAppData?.["mali_yunyin_save_v1"],
  };
}

export async function restoreFeatureBackup(src = {}, { replace = false } = {}) {
  const data = src.featureData || {};
  const writes = new Map();
  const put = (name, value) => writes.set(FEATURE_EXPORTS[name][0], value);
  let legacyYunyin = null;
  let legacyPetHome = null;
  let legacyPetSettings = null;
  try { if (src.localAppData?.["mali_yunyin_save_v1"]) legacyYunyin = JSON.parse(src.localAppData["mali_yunyin_save_v1"]); } catch (_) {}
  try { if (src.localAppData?.["maliphone-pet-home"]) legacyPetHome = JSON.parse(src.localAppData["maliphone-pet-home"]); } catch (_) {}
  try {
    if (src.localAppData?.["maliphone-pet-settings"]) {
      legacyPetSettings = {
        ...JSON.parse(src.localAppData["maliphone-pet-settings"]),
        cooldownUntil: Number(src.localAppData["maliphone-pet-cooldown-until"]) || 0,
      };
    }
  } catch (_) {}

  if (replace) {
    for (const [name, [, fallback]] of Object.entries(FEATURE_EXPORTS)) put(name, data[name] ?? fallback);
  }
  if (data.yunyinSave && typeof data.yunyinSave === "object") put("yunyinSave", data.yunyinSave);
  else if (legacyYunyin) put("yunyinSave", legacyYunyin);
  if (Number.isFinite(Number(data.gachaCurrency))) {
    put("gachaCurrency", Math.max(0, Number(data.gachaCurrency)));
    if (!Array.isArray(data.gachaCrystalLedger)) put("gachaCrystalLedger", null);
  }
  if (Array.isArray(data.gachaCrystalLedger)) put("gachaCrystalLedger", data.gachaCrystalLedger);
  if (Array.isArray(data.gachaInventory)) put("gachaInventory", data.gachaInventory);
  if (Array.isArray(data.gachaEpisodes)) put("gachaEpisodes", data.gachaEpisodes);
  if (Array.isArray(data.gachaSpecialMemories)) put("gachaSpecialMemories", data.gachaSpecialMemories);
  if (data.coupleDaily && typeof data.coupleDaily === "object") put("coupleDaily", data.coupleDaily);
  if (data.calendar && typeof data.calendar === "object") {
    put("calendar", data.calendar);
  }
  if (data.musicPlayer && typeof data.musicPlayer === "object") put("musicPlayer", data.musicPlayer);
  if (data.gachaProgress && typeof data.gachaProgress === "object") {
    put("gachaProgress", {
      totalDrawCount: Math.max(0, Number(data.gachaProgress.totalDrawCount) || 0),
      drawsSinceLastSSR: Math.min(59, Math.max(0, Number(data.gachaProgress.drawsSinceLastSSR) || 0)),
    });
  }
  if (data.petHome && typeof data.petHome === "object") put("petHome", data.petHome);
  else if (legacyPetHome) put("petHome", legacyPetHome);
  if (data.petSettings && typeof data.petSettings === "object") put("petSettings", data.petSettings);
  else if (legacyPetSettings) put("petSettings", legacyPetSettings);
  if (Array.isArray(data.notes)) put("notes", data.notes);
  if (data.loginReward && typeof data.loginReward === "object") put("loginReward", data.loginReward);
  if (data.systemMailbox && typeof data.systemMailbox === "object") put("systemMailbox", data.systemMailbox);
  if (data.dating && typeof data.dating === "object") put("dating", data.dating);

  await saveFeatureEntities(writes.entries());
  if (data.gachaInventory || data.gachaEpisodes || data.gachaCurrency != null || data.gachaCrystalLedger || data.gachaProgress || data.gachaSpecialMemories || replace) window.dispatchEvent(new Event("gacha-storage-updated"));
  if (data.calendar || replace) window.dispatchEvent(new CustomEvent("calendar-storage-updated", { detail: writes.get("ent_calendar") }));
  if (data.petSettings || src.localAppData?.["maliphone-pet-settings"] || replace) window.dispatchEvent(new Event("pet-settings-changed"));
}

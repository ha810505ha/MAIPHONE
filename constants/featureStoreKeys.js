// 各功能在 IndexedDB 的實體 key 與預設值。備份匯出／還原（featureBackupService）
// 與救援檔轉換（utils/backupInspect）共用，新增功能時只改這裡。
export const FEATURE_EXPORTS = {
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
  storePurchases: ["ent_storePurchases", null],
  // AI 花費本（MP-063）：整台裝置一本，不分人格；進全域備份，不進帳號雲端同步。
  aiUsage: ["ent_aiUsage", null],
};

export const PERSONA_FEATURE_EXPORTS = {
  coupleDaily: ["ent_coupleDaily", null],
  dating: ["ent_dating", null],
};

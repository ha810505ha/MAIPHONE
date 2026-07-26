// 境界表：全遊戲解鎖樹的鑰匙。unlocks 的 key 之後由靈田/丹房/秘境各自認領。
export const REALMS = [
  { name: "煉氣一層", expMax: 1000,   ratePerMin: 1.0, unlocks: [] },
  { name: "煉氣三層", expMax: 3000,   ratePerMin: 2.0, unlocks: ["plot_4"] },
  { name: "煉氣五層", expMax: 8000,   ratePerMin: 3.5, unlocks: ["plot_5", "recipe_ningshen"] },
  { name: "築基期",   expMax: 30000,  ratePerMin: 6.0, unlocks: ["plot_6", "plot_7", "furnace_2", "dungeon_depth_2"] },
  { name: "金丹期",   expMax: 120000, ratePerMin: 12,  unlocks: ["plot_8", "plot_9", "dungeon_depth_3"] },
  // 占位境界：先讓金丹期打滿有下一級可衝（每日打坐/掛機不再歸零），解鎖內容之後設計了再填
  { name: "元嬰期",   expMax: 400000, ratePerMin: 20,  unlocks: [] },
];

export const BREAKTHROUGH_BASE_RATE = 0.7;
export const BREAKTHROUGH_FAIL_LOSS = 0.1;   // 失敗退 10% 修為
export const BREAKTHROUGH_COOLDOWN_MS = 60 * 60 * 1000; // 失敗冷卻 1 小時

export const DATING_APP_ID = "dating";
export const DATING_ENTITY_KEY = "ent_dating";

// 配對機率：上線後最該憑手感微調的就是 BASE。
// 下限不為 0（永遠留一線），上限不到 1（滿分留給 Super Like）。
export const MATCH_BASE_RATE = 0.35;
export const MATCH_LIKE_WEIGHT = 0.15;
// 雷點比共同點重：一個地雷的殺傷力大於三個共同點。
export const MATCH_DISLIKE_WEIGHT = 0.25;
export const MATCH_RATE_MIN = 0.05;
export const MATCH_RATE_MAX = 0.9;

export const SUPER_LIKE_RATE_FLOOR = 0.9;
export const SUPER_LIKE_INITIAL = 3;

// 延遲配對：長度是角色特質而非亂數，讓「秒回的人」本身就是人設的一部分。
export const RESPONSE_DELAY_RANGES = Object.freeze({
  instant: [30 * 1000, 2 * 60 * 1000],
  normal: [20 * 60 * 1000, 2 * 60 * 60 * 1000],
  slow: [6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000],
});

// 跳過的人隔一天回鍋。卡池有限，這是主要的「還有事可做」來源。
export const PASS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const PHOTO_ROTATE_MS = 4000;
export const SWIPE_THRESHOLD = 88;
export const SWIPE_UP_THRESHOLD = 80;
export const CARD_MAX_ROTATION = 15;

// 沒填在線時段的角色視為全天在線，舊資料不會突然變得聯絡不上。
export const DEFAULT_ONLINE_HOURS = Object.freeze({ start: "00:00", end: "24:00" });

/**
 * 在線時回覆的最短耗時（毫秒）。這是「至少要花這麼久」，不是額外疊加——
 * API 本來就慢的話不會再加倍等。讓三種 responseStyle 在對話裡也有手感差異。
 */
export const IN_APP_REPLY_DELAY = Object.freeze({
  instant: [900, 2600],
  normal: [3000, 8000],
  slow: [9000, 18000],
});

// 檢舉走「人工審核」，1～2 天才有結果。即時回覆太假，也會讓檢舉變得沒有重量。
export const REPORT_REVIEW_RANGE = [24 * 60 * 60 * 1000, 48 * 60 * 60 * 1000];
export const REPORT_REWARD_SUPER_LIKES = 2;

// 加入聯絡人的門檻。只計玩家發出、且長度達標的訊息，避免用「嗯」「哦」刷進度。
export const EFFECTIVE_MESSAGE_MIN_LENGTH = 8;
export const CONTACT_PACE_THRESHOLDS = Object.freeze({
  fast: { messages: 10, days: 2 },
  normal: { messages: 20, days: 3 },
  slow: { messages: 35, days: 5 },
});

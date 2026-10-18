export const DATING_APP_ID = "dating";
export const DATING_ENTITY_KEY = "ent_dating";
// 信風暱稱（profile.name）上限；空字串時顯示層回退玩家名稱。
export const DATING_NICKNAME_MAX = 20;

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
// Super Like 回補（MP-051，小舞 2026-10-13 核准）：
// 每週一台北時間 00:00 補到 3（不累積）；交換聯絡方式 +1；連續登入第 7 天 +1（登入獎勵 App 負責呼叫）；
// 檢舉成立 +2（REPORT_REWARD_SUPER_LIKES）。任何加點都夾在上限 9，避免囤積後一輪全 Super Like。
export const SUPER_LIKE_WEEKLY_FLOOR = 3;
export const SUPER_LIKE_MAX = 9;
export const SUPER_LIKE_CONTACT_REWARD = 1;
export const SUPER_LIKE_LOGIN_STREAK_REWARD = 1;
export const SUPER_LIKE_TIME_ZONE = "Asia/Taipei";

// 延遲配對：長度是角色特質而非亂數，讓「秒回的人」本身就是人設的一部分。
export const RESPONSE_DELAY_RANGES = Object.freeze({
  instant: [30 * 1000, 2 * 60 * 1000],
  normal: [20 * 60 * 1000, 2 * 60 * 60 * 1000],
  slow: [6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000],
});

// 跳過的人隔一天回鍋。卡池有限，這是主要的「還有事可做」來源。
export const PASS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
// 喜歡／Super Like 沒配到的人也會回鍋：這不是真的交友軟體，每個角色都要留機會聊到。
// 刻意比最慢的配對延遲（24 小時）長，否則人一回來玩家就知道「沒配到」。
export const LIKE_RETRY_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

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

// 交換聯絡方式不再由固定門檻決定，而是角色依關係主動邀請、或玩家提議後角色答應。
// 只保留一個很低的保底（有效訊息＝玩家發出且長度達標），避免剛配對就按；
// 卡片可用 contactGate: { messages, days } 另設更嚴的限制（特別角色用）。
export const EFFECTIVE_MESSAGE_MIN_LENGTH = 8;
export const CONTACT_GATE_DEFAULT = Object.freeze({ messages: 5, days: 0 });
// 玩家提議被婉拒後，要再多聊幾句有效訊息才能再提，避免連按。
export const CONTACT_PROPOSAL_RETRY_MESSAGES = 3;
// 角色回覆中的隱藏標記：邀請交換／答應玩家的提議。程式會去掉標記再存。
export const CONTACT_INVITE_MARKER = "[[CONTACT_INVITE]]";
export const CONTACT_ACCEPT_MARKER = "[[CONTACT_ACCEPT]]";

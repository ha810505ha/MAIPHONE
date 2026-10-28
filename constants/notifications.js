export const NOTIFICATION_TYPES = Object.freeze({
  MESSAGE: "message",
  MATCH: "match",
  LIKE: "like",
  SOCIAL: "social",
  // 山莊（田熟、丹好）與登入獎勵（今天還沒領）：MP-091，小舞 2026-10-28。錢包入帳、寵物、抽卡決定不跳。
  VILLA: "villa",
  LOGIN_REWARD: "loginReward",
  MAILBOX: "mailbox",
});

/**
 * 沉浸式 App：全螢幕的獨立世界，期間不跳橫幅。
 * 未讀仍照常累積，由圖示紅點與鎖定畫面承接；離開時把期間錯過的補跳一次（小舞 2026-10-28 改）。
 */
export const IMMERSIVE_APPS = Object.freeze(["yunyin"]);
// 山莊每次存檔後廣播整份存檔（detail），讓通知層不用重讀 IndexedDB。
export const YUNYIN_SAVE_UPDATED_EVENT = "yunyin-save-updated";

// 橫幅停留時間，比 toast 長，才來得及點。
export const BANNER_DURATION = 4000;
export const LOCK_NOTIFICATION_LIMIT = 6;

export const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  enabled: true,
  types: Object.freeze({ message: true, match: true, like: true, social: true, villa: true, loginReward: true, mailbox: true }),
  quietHours: Object.freeze({ enabled: false, start: "23:00", end: "08:00" }),
  // system 預設關閉：它需要瀏覽器權限，得由玩家主動開啟才問。
  surfaces: Object.freeze({ banner: true, lockScreen: true, badge: true, system: false }),
  // 與其他項目不同：這個省的是 API 額度，不是打擾，所以獨立成一個開關。
  pauseProactive: false,
});

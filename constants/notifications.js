export const NOTIFICATION_TYPES = Object.freeze({
  MESSAGE: "message",
  MATCH: "match",
  LIKE: "like",
  SOCIAL: "social",
  WALLET: "wallet",
  MAILBOX: "mailbox",
});

/**
 * 沉浸式 App：全螢幕的獨立世界，期間不跳橫幅。
 * 未讀仍照常累積，由圖示紅點與鎖定畫面承接，離開後不補跳。
 */
export const IMMERSIVE_APPS = Object.freeze(["yunyin"]);

// 橫幅停留時間，比 toast 長，才來得及點。
export const BANNER_DURATION = 4000;
export const LOCK_NOTIFICATION_LIMIT = 6;

export const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  enabled: true,
  types: Object.freeze({ message: true, match: true, like: true, social: true, wallet: true, mailbox: true }),
  quietHours: Object.freeze({ enabled: false, start: "23:00", end: "08:00" }),
  // system 預設關閉：它需要瀏覽器權限，得由玩家主動開啟才問。
  surfaces: Object.freeze({ banner: true, lockScreen: true, badge: true, system: false }),
  // 與其他項目不同：這個省的是 API 額度，不是打擾，所以獨立成一個開關。
  pauseProactive: false,
});

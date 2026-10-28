import assert from "node:assert/strict";

// MP-090（小舞 2026-10-28）：每日備份提醒。只提醒、不自動上傳；狀態只在這台裝置的 localStorage。
globalThis.localStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); },
  removeItem(key) { this.values.delete(key); },
};

const {
  BACKUP_KINDS, BACKUP_REMINDER_INTERVAL_MS, BACKUP_REMINDER_KEY, buildBackupReminderNotification, isBackupReminderDue,
  markBackupDone, markBackupReminded, readBackupReminderState, setBackupReminderEnabled,
} = await import("../services/backup/backupReminder.js");

const tr = (zh) => zh;
const DAY = BACKUP_REMINDER_INTERVAL_MS;
const now = 1_800_000_000_000;

// 全新安裝：預設開、從沒備份過 → 有角色就提醒；沒有角色不提醒。
const fresh = readBackupReminderState();
assert.deepEqual(fresh, { enabled: true, lastBackupAt: 0, lastBackupKind: "", lastRemindedAt: 0 });
assert.equal(isBackupReminderDue({ state: fresh, now, characterCount: 0 }), false, "an empty phone has nothing to back up");
assert.equal(isBackupReminderDue({ state: fresh, now, characterCount: 1 }), true, "a never-backed-up phone with content is reminded on day one");
assert.match(buildBackupReminderNotification({ state: fresh, now, tr }).body, /還沒備份過/);

// 提醒跳過之後 24 小時內不再跳，之後再跳。
markBackupReminded(now);
assert.equal(isBackupReminderDue({ state: readBackupReminderState(), now: now + DAY - 1, characterCount: 1 }), false, "reminded once per day at most");
assert.equal(isBackupReminderDue({ state: readBackupReminderState(), now: now + DAY, characterCount: 1 }), true);

// 任一種備份完成 → 歸零；24 小時後才會再提醒；文案帶天數。
markBackupDone(BACKUP_KINDS.googleDrive, now + DAY);
let state = readBackupReminderState();
assert.equal(state.lastBackupKind, "google-drive");
assert.equal(isBackupReminderDue({ state, now: now + DAY + 60_000, characterCount: 3 }), false, "just backed up → quiet");
assert.equal(isBackupReminderDue({ state, now: now + 3 * DAY, characterCount: 3 }), true);
assert.match(buildBackupReminderNotification({ state, now: now + 3 * DAY, tr }).body, /已經 2 天沒備份/);
const notification = buildBackupReminderNotification({ state, now: now + 3 * DAY, tr });
assert.equal(notification.appId, "settings");
assert.deepEqual(notification.payload, { settingsTab: "data" }, "tapping the banner opens Settings → Data");
assert.equal(notification.icon, "bell");

// 關閉開關 → 永遠不提醒；打開恢復。
setBackupReminderEnabled(false);
assert.equal(isBackupReminderDue({ state: readBackupReminderState(), now: now + 30 * DAY, characterCount: 3 }), false, "switched off → never");
setBackupReminderEnabled(true);
assert.equal(isBackupReminderDue({ state: readBackupReminderState(), now: now + 30 * DAY, characterCount: 3 }), true);

// 其他備份種類也算。
for (const kind of [BACKUP_KINDS.github, BACKUP_KINDS.exportFile, BACKUP_KINDS.cloudSave]) {
  markBackupDone(kind, now + 40 * DAY);
  assert.equal(readBackupReminderState().lastBackupKind, kind);
  assert.equal(isBackupReminderDue({ state: readBackupReminderState(), now: now + 40 * DAY + 1000, characterCount: 3 }), false);
}

// 壞掉的儲存值不會讓開機失敗，回到預設。
localStorage.setItem(BACKUP_REMINDER_KEY, "{broken");
assert.deepEqual(readBackupReminderState(), fresh);
localStorage.setItem(BACKUP_REMINDER_KEY, JSON.stringify({ enabled: "yes", lastBackupAt: -5, lastRemindedAt: "x" }));
assert.deepEqual(readBackupReminderState(), fresh, "garbage fields fall back to defaults");

console.log("ok: the daily backup reminder fires once a day only when there is content and no recent backup, and can be switched off (MP-090)");

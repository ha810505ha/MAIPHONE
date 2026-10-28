// 每日備份提醒（MP-090，小舞 2026-10-28）：不自動上傳任何東西，只在玩家太久沒備份時
// 用殼內通知橫幅提醒一次。狀態只存這台裝置的 localStorage，不進雲端同步、不進備份檔。
//
// 「上次備份」的定義：Google Drive 備份、GitHub 備份、匯出全域資料備份檔、上傳雲端存檔，
// 任何一種完成都算；還原／匯入不算。

export const BACKUP_REMINDER_KEY = "mali_backup_reminder_v1";
export const BACKUP_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;
// 開 App 或解鎖後稍等再提醒，不跟開機動畫、每日快照搶同一秒。
export const BACKUP_REMINDER_DELAY_MS = 8_000;

export const BACKUP_KINDS = Object.freeze({
  googleDrive: "google-drive",
  github: "github",
  exportFile: "export-file",
  cloudSave: "cloud-save",
});

const DEFAULT_STATE = Object.freeze({ enabled: true, lastBackupAt: 0, lastBackupKind: "", lastRemindedAt: 0 });

const getStorage = () => {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
};

export function normalizeBackupReminderState(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const num = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0);
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_STATE.enabled,
    lastBackupAt: num(source.lastBackupAt),
    lastBackupKind: typeof source.lastBackupKind === "string" ? source.lastBackupKind : "",
    lastRemindedAt: num(source.lastRemindedAt),
  };
}

export function readBackupReminderState() {
  const storage = getStorage();
  if (!storage) return { ...DEFAULT_STATE };
  try {
    return normalizeBackupReminderState(JSON.parse(storage.getItem(BACKUP_REMINDER_KEY) || "null"));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeBackupReminderState(patch) {
  const next = normalizeBackupReminderState({ ...readBackupReminderState(), ...patch });
  const storage = getStorage();
  if (storage) {
    try { storage.setItem(BACKUP_REMINDER_KEY, JSON.stringify(next)); } catch {}
  }
  return next;
}

export function setBackupReminderEnabled(enabled) {
  return writeBackupReminderState({ enabled: Boolean(enabled) });
}

/** 任一種備份完成後呼叫：計時器歸零。 */
export function markBackupDone(kind, now = Date.now()) {
  return writeBackupReminderState({ lastBackupAt: now, lastBackupKind: String(kind || "") });
}

/** 提醒已經跳過（不論玩家有沒有點）：24 小時內不再跳。 */
export function markBackupReminded(now = Date.now()) {
  return writeBackupReminderState({ lastRemindedAt: now });
}

/**
 * 該不該提醒（純函式）：開關開著、本機至少一位角色、距上次備份與上次提醒都超過間隔。
 * 從沒備份過的玩家（lastBackupAt 為 0）裝上新版第一天就會看到提醒，這是故意的。
 */
export function isBackupReminderDue({ state, now = Date.now(), characterCount = 0, intervalMs = BACKUP_REMINDER_INTERVAL_MS } = {}) {
  const current = normalizeBackupReminderState(state);
  if (!current.enabled) return false;
  if (!(Number(characterCount) > 0)) return false;
  if (now - current.lastBackupAt < intervalMs) return false;
  if (now - current.lastRemindedAt < intervalMs) return false;
  return true;
}

/** 通知橫幅用的內容；tr 由呼叫端提供。 */
export function buildBackupReminderNotification({ state, now = Date.now(), tr }) {
  const current = normalizeBackupReminderState(state);
  const neverBackedUp = !current.lastBackupAt;
  const days = neverBackedUp ? 0 : Math.max(1, Math.floor((now - current.lastBackupAt) / BACKUP_REMINDER_INTERVAL_MS));
  return {
    id: `backup-reminder:${now}`,
    type: "backup-reminder",
    appId: "settings",
    icon: "bell",
    time: now,
    title: tr("備份提醒", "Backup reminder", "バックアップのお知らせ", "백업 알림"),
    body: neverBackedUp
      ? tr("這台裝置還沒備份過，點一下去備份，避免資料遺失。", "This device has never been backed up. Tap to back up and avoid losing data.", "この端末はまだバックアップされていません。タップしてバックアップし、データ消失を防ぎましょう。", "이 기기는 아직 백업한 적이 없어요. 눌러서 백업하고 데이터 손실을 막으세요.")
      : tr(`已經 ${days} 天沒備份了，點一下去備份。`, `It's been ${days} day${days > 1 ? "s" : ""} since your last backup. Tap to back up.`, `最後のバックアップから ${days} 日経っています。タップしてバックアップしましょう。`, `마지막 백업 후 ${days}일이 지났어요. 눌러서 백업하세요.`),
    payload: { settingsTab: "data" },
  };
}

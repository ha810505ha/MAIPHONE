import { DEFAULT_ONLINE_HOURS } from "../../constants/dating";

const CLOCK = /^([01]?\d|2[0-4]):([0-5]\d)$/;

/** "09:00" → 540；"24:00" → 1440（允許用 24:00 表示到午夜為止）。 */
export function toMinutes(clock, fallback = 0) {
  const match = CLOCK.exec(String(clock || ""));
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

const hours = (entry) => {
  const source = entry?.onlineHours || DEFAULT_ONLINE_HOURS;
  return { start: toMinutes(source.start, 0), end: toMinutes(source.end, 1440) };
};

const minutesOfDay = (time) => {
  const date = new Date(time);
  return date.getHours() * 60 + date.getMinutes();
};

/**
 * 在線時段可以跨午夜（夜貓子 22:00–03:00），跟勿擾時段同一套判斷。
 * 沒有設定的角色視為全天在線，這樣舊資料不會突然變得聯絡不上。
 */
export function isOnline(entry, time = Date.now()) {
  const { start, end } = hours(entry);
  if (start === end) return true;
  const current = minutesOfDay(time);
  return start < end ? current >= start && current < end : current >= start || current < end;
}

/** 下一次上線的時間戳；已經在線就回傳 0。 */
export function nextOnlineAt(entry, time = Date.now()) {
  if (isOnline(entry, time)) return 0;
  const { start } = hours(entry);
  const date = new Date(time);
  const target = new Date(date);
  target.setHours(Math.floor(start / 60), start % 60, 0, 0);
  if (target.getTime() <= time) target.setDate(target.getDate() + 1);
  return target.getTime();
}

const pad = (value) => String(value).padStart(2, "0");

/** 依角色與日期決定的固定偏移，讓「最後上線」不會永遠停在整點被看穿。 */
function jitterMinutes(entry, date) {
  const seed = `${entry?.id || ""}${date.getFullYear()}${date.getMonth()}${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100003;
  return hash % 41;
}

/** 上一段在線時段的結束時間。跨午夜的話結束點落在隔天凌晨。 */
export function lastOnlineAt(entry, time = Date.now()) {
  if (isOnline(entry, time)) return time;
  const { start, end } = hours(entry);
  if (start === end) return time;
  const date = new Date(time);
  const candidate = new Date(date);
  candidate.setHours(Math.floor(end / 60), end % 60, 0, 0);
  // 時段結束點還在未來，代表上一次結束是昨天那一輪。
  if (candidate.getTime() > time) candidate.setDate(candidate.getDate() - 1);
  return candidate.getTime() - jitterMinutes(entry, candidate) * 60000;
}

function relativeLabel(at, now) {
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 5) return "剛剛還在線上";
  if (minutes < 60) return `最後上線 ${minutes} 分鐘前`;
  const hoursAgo = Math.floor(minutes / 60);
  if (hoursAgo < 24) return `最後上線 ${hoursAgo} 小時前`;
  const date = new Date(at);
  return `最後上線 ${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 聊天室頂部的狀態。
 *
 * 刻意只顯示「最後上線」，不預告幾點會回來——真的交友軟體不會知道對方的作息，
 * 說了就變成把角色的設定表攤給玩家看。誰是夜貓子要靠玩家自己觀察出來。
 *
 * lastActivityAt 傳入對方最後一則訊息的時間，比推算出來的時段結束更準。
 */
export function presenceLabel(entry, time = Date.now(), lastActivityAt = 0) {
  if (isOnline(entry, time)) return { online: true, text: "線上" };
  const at = Math.min(time, Math.max(lastOnlineAt(entry, time), lastActivityAt || 0));
  return { online: false, text: relativeLabel(at, time) };
}

/** 對方離線期間玩家傳的訊息，上線後要一次回完，不是回五次。 */
export function pendingUserMessages(messages = []) {
  const pending = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== "user") break;
    pending.unshift(messages[i]);
  }
  return pending;
}

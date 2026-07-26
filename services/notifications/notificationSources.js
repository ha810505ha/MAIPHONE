import {
  DEFAULT_NOTIFICATION_SETTINGS,
  IMMERSIVE_APPS,
  LOCK_NOTIFICATION_LIMIT,
  NOTIFICATION_TYPES,
} from "../../constants/notifications";
import { messagePreviewText } from "../../utils/pseudoImage";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const bool = (value, fallback) => (typeof value === "boolean" ? value : fallback);
const clockOr = (value, fallback) => (typeof value === "string" && TIME_PATTERN.test(value) ? value : fallback);
const pickFlags = (source, defaults) => Object.fromEntries(
  Object.keys(defaults).map((key) => [key, bool(source?.[key], defaults[key])]),
);

export function normalizeNotificationSettings(src) {
  const base = DEFAULT_NOTIFICATION_SETTINGS;
  const source = src && typeof src === "object" ? src : {};
  const quiet = source.quietHours && typeof source.quietHours === "object" ? source.quietHours : {};
  return {
    enabled: bool(source.enabled, base.enabled),
    types: pickFlags(source.types, base.types),
    quietHours: {
      enabled: bool(quiet.enabled, base.quietHours.enabled),
      start: clockOr(quiet.start, base.quietHours.start),
      end: clockOr(quiet.end, base.quietHours.end),
    },
    surfaces: pickFlags(source.surfaces, base.surfaces),
    pauseProactive: bool(source.pauseProactive, base.pauseProactive),
  };
}

function collectSocialNotifications({ posts, socialSeenAt }) {
  const unseen = (posts || [])
    .filter((post) => {
      const authorType = post?.authorType || (post?.charId ? "character" : "player");
      return authorType === "character" && (Number(post?.time) || 0) > (Number(socialSeenAt) || 0);
    })
    .sort((a, b) => (Number(b?.time) || 0) - (Number(a?.time) || 0));
  if (!unseen.length) return [];
  const latest = unseen[0];
  return [{
    id: `${NOTIFICATION_TYPES.SOCIAL}:posts`,
    type: NOTIFICATION_TYPES.SOCIAL,
    title: latest.charName || latest.authorName || "社群",
    body: latest.content || "",
    avatar: latest.charAvatar || latest.avatar || "",
    fallbackIcon: "🗯️",
    count: unseen.length,
    time: Number(latest.time) || 0,
    appId: "social",
    payload: { section: "feed" },
  }];
}

function collectMailboxNotifications({ mailboxMails }) {
  const unread = (mailboxMails || [])
    .filter((mail) => !mail?.read)
    .sort((a, b) => new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime());
  if (!unread.length) return [];
  const latest = unread[0];
  return [{
    id: `${NOTIFICATION_TYPES.MAILBOX}:system`,
    type: NOTIFICATION_TYPES.MAILBOX,
    title: latest.title || "系統信箱",
    body: latest.sender ? `來自 ${latest.sender}` : "你有新的系統信件",
    fallbackIcon: "✉️",
    count: unread.length,
    time: new Date(latest.createdAt).getTime() || 0,
    appId: "settings",
    payload: { settingsTab: "data", mailbox: true },
  }];
}

/**
 * 訊息通知：直接從 proactiveUnread 衍生，不另外存一份通知佇列。
 * 這樣玩家從別處讀掉訊息時，鎖定畫面與紅點會自動消失，不需要手動同步。
 * 同一個角色的多則訊息天生就是一筆，count 帶出數量。
 */
function collectMessageNotifications({ proactiveUnread, characters, chatHistory }) {
  return Object.keys(proactiveUnread || {}).map((charId) => {
    const count = Number(proactiveUnread[charId]) || 0;
    if (count <= 0) return null;
    const character = (characters || []).find((item) => item.id === charId);
    if (!character) return null;
    const messages = chatHistory?.[charId] || [];
    const last = messages[messages.length - 1];
    const sender = character.name || "對方";
    return {
      id: `${NOTIFICATION_TYPES.MESSAGE}:${charId}`,
      type: NOTIFICATION_TYPES.MESSAGE,
      title: character.name || "",
      body: messagePreviewText(last, {
        imageText: `${sender}傳送了圖片`,
        voiceText: `${sender}傳送了語音訊息`,
      }),
      avatar: character.avatar || "",
      fallbackIcon: character.name?.[0] || "🙂",
      count,
      time: last?.time || 0,
      appId: "chat",
      payload: { charId },
    };
  }).filter(Boolean);
}

/**
 * 交友通知：對話活在交友 App 自己的狀態裡，沒有進 chatHistory，所以要獨立衍生。
 * 尚未看過的配對報「配對成功」，看過之後的未讀訊息才報訊息。
 */
function collectDatingNotifications({ datingState, datingProfiles }) {
  if (!datingState) return [];
  const findEntry = (profileId) => (datingProfiles || []).find((item) => item.id === profileId);
  return (datingState.matches || []).map((match) => {
    const entry = findEntry(match.profileId);
    if (!entry) return null;
    const relation = datingState.relations?.[match.profileId];
    const unread = Number(relation?.unread) || 0;
    if (match.seen && unread <= 0) return null;
    const last = relation?.messages?.[relation.messages.length - 1];
    const fresh = !match.seen;
    return {
      id: `${fresh ? NOTIFICATION_TYPES.MATCH : NOTIFICATION_TYPES.MESSAGE}:dating:${match.profileId}`,
      type: fresh ? NOTIFICATION_TYPES.MATCH : NOTIFICATION_TYPES.MESSAGE,
      title: fresh ? `和 ${entry.profile.name} 配對成功` : entry.profile.name,
      body: fresh ? "點進去看看他說了什麼" : (last?.content || ""),
      avatar: entry.profile.photos?.[0] || "",
      fallbackIcon: fresh ? "💘" : (entry.profile.name?.[0] || "🙂"),
      count: fresh ? 1 : unread,
      time: last?.time || match.at || 0,
      appId: "dating",
      payload: { profileId: match.profileId },
    };
  }).filter(Boolean);
}

/**
 * 新功能要接通知，就在這裡加一個 collector。
 * 各功能的未讀狀態是唯一真相，這裡只負責轉譯成統一的通知描述。
 */
export function collectNotifications(sources = {}) {
  return [
    ...collectMessageNotifications(sources),
    ...collectDatingNotifications(sources),
    ...collectSocialNotifications(sources),
    ...collectMailboxNotifications(sources),
  ].sort((a, b) => b.time - a.time);
}

export function isQuietHours(settings, now = new Date()) {
  const quiet = settings?.quietHours;
  if (!quiet?.enabled) return false;
  const toMinutes = (value) => {
    const [hour, minute] = String(value).split(":");
    return (Number(hour) || 0) * 60 + (Number(minute) || 0);
  };
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  const current = now.getHours() * 60 + now.getMinutes();
  // 跨午夜的區間（例如 23:00 → 08:00）要反過來判斷。
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

const typeAllowed = (settings, type) => settings?.types?.[type] !== false;

export function filterForSurface(list, settings, surface) {
  if (settings?.enabled === false || settings?.surfaces?.[surface] === false) return [];
  return list.filter((item) => typeAllowed(settings, item.type));
}

export function selectLockNotifications(list, settings) {
  return filterForSurface(list, settings, "lockScreen").slice(0, LOCK_NOTIFICATION_LIMIT);
}

export function buildBadgeCounts(list, settings) {
  return filterForSurface(list, settings, "badge").reduce((acc, item) => {
    acc[item.appId] = (acc[item.appId] || 0) + (item.count || 1);
    return acc;
  }, {});
}

/**
 * 橫幅是唯一會打斷玩家的表面，抑制條件也最多。
 * 三種抑制情境（鎖定／勿擾／沉浸 App）行為一致：不顯示，而且不補跳。
 */
export function canInterrupt({ settings, locked, currentApp, now }) {
  if (locked) return false;
  if (settings?.enabled === false || settings?.surfaces?.banner === false) return false;
  if (IMMERSIVE_APPS.includes(currentApp)) return false;
  return !isQuietHours(settings, now);
}

// 同時到達多則時合併成一則摘要，不排隊連播。
export function buildBannerPayload(list) {
  if (list.length === 1) return list[0];
  return {
    ...list[0],
    id: `summary:${list[0].time}`,
    summaryCount: list.length,
    names: list.slice(0, 3).map((item) => item.title).filter(Boolean).join("、"),
  };
}

export function formatNotificationTime(time, tr) {
  if (!time) return "";
  const diff = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return tr("剛剛", "Now", "たった今", "방금");
  if (minutes < 60) return tr(`${minutes} 分鐘前`, `${minutes}m ago`, `${minutes}分前`, `${minutes}분 전`);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tr(`${hours} 小時前`, `${hours}h ago`, `${hours}時間前`, `${hours}시간 전`);
  const days = Math.floor(hours / 24);
  return tr(`${days} 天前`, `${days}d ago`, `${days}日前`, `${days}일 전`);
}

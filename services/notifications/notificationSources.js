import {
  DEFAULT_NOTIFICATION_SETTINGS,
  IMMERSIVE_APPS,
  LOCK_NOTIFICATION_LIMIT,
  NOTIFICATION_TYPES,
} from "../../constants/notifications.js";
import { messagePreviewText } from "../../utils/pseudoImage.js";
import { normalizeUiLanguage, translate } from "../../utils/i18n.js";
import { taiwanDayKey } from "../../utils/taiwanDayKey.js";

// 通知在 hook 裡彙整、拿不到元件的 tr，直接讀目前介面語言（非瀏覽器環境退回繁中）。
const uiTr = (...translations) => translate(
  normalizeUiLanguage(typeof document !== "undefined" ? document.documentElement.lang : ""),
  ...translations,
);

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

export function collectSocialActivities({ posts, socialSeenAt, socialNow, characters }) {
  const seenAt = Number(socialSeenAt) || 0;
  const visibleAt = Number(socialNow) || Date.now();
  const characterById = new Map((characters || []).map((character) => [
    String(character?.id),
    character,
  ]));
  const events = [];
  (posts || []).forEach((post) => {
    const postTime = Number(post?.time) || 0;
    const authorType = post?.authorType || (post?.charId ? "character" : "player");
    const postAuthor = characterById.get(String(post?.charId));
    const postAuthorName = post?.authorName || post?.charName || postAuthor?.name || "社群成員";
    if (
      authorType === "character"
      && post?.generationSource === "auto"
      && postTime > 0
      && postTime <= visibleAt
    ) {
      const author = characterById.get(String(post?.charId));
      events.push({
        id: `post:${post.id}`,
        kind: "post",
        postId: post.id,
        commentId: null,
        actorName: postAuthorName,
        postAuthorName,
        targetName: "",
        targetKind: "post",
        title: postAuthorName,
        body: post.content || "",
        avatar: author?.avatar || post.charAvatar || post.avatar || "",
        time: postTime,
        isUnread: postTime > seenAt,
      });
    }
    const commentsById = new Map((post?.comments || []).map((comment) => [
      String(comment?.id),
      comment,
    ]));
    (post?.comments || []).forEach((comment) => {
      const commentTime = Number(comment?.time) || 0;
      if (comment?.role !== "assistant" || commentTime <= 0 || commentTime > visibleAt) return;
      const commenter = characterById.get(String(comment?.charId));
      const actorName = comment.charName || commenter?.name || "社群成員";
      const parentComment = comment?.parentId
        ? commentsById.get(String(comment.parentId))
        : null;
      const targetName = comment.replyToName
        || (parentComment?.role === "assistant"
          ? (parentComment.charName || "社群成員")
          : parentComment
            ? (postAuthorName || "玩家")
            : postAuthorName);
      const isSelfComment = comment?.interactionKind === "self-comment"
        || (
          !comment?.parentId
          && authorType === "character"
          && String(comment?.charId) === String(post?.charId)
        );
      events.push({
        id: `comment:${post.id}:${comment.id}`,
        kind: isSelfComment ? "self-comment" : "comment",
        postId: post.id,
        commentId: comment.id,
        actorName,
        postAuthorName,
        targetName,
        targetKind: comment?.parentId ? "comment" : "post",
        title: actorName,
        body: comment.content || "",
        avatar: commenter?.avatar || comment.charAvatar || "",
        time: commentTime,
        isUnread: commentTime > seenAt,
      });
    });
  });
  events.sort((first, second) => second.time - first.time);
  return events;
}

function collectSocialNotifications(sources) {
  const events = collectSocialActivities(sources).filter((event) => event.isUnread);
  if (!events.length) return [];
  const latest = events[0];
  return [{
    id: `${NOTIFICATION_TYPES.SOCIAL}:activity`,
    type: NOTIFICATION_TYPES.SOCIAL,
    title: latest.title,
    body: latest.body,
    avatar: latest.avatar,
    fallbackIcon: latest.kind === "post" ? "🗯️" : "💬",
    count: events.length,
    time: latest.time,
    appId: "social",
    payload: { section: "feed", postId: latest.postId },
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
      title: fresh
        ? uiTr(`和 ${entry.profile.name} 配對成功`, `You matched with ${entry.profile.name}`, `${entry.profile.name}とマッチしました`, `${entry.profile.name}님과 매칭됐어요`)
        : entry.profile.name,
      body: fresh ? uiTr("點進去看看他說了什麼", "Tap to see what they said", "タップしてメッセージを見る", "눌러서 메시지를 확인하세요") : (last?.content || ""),
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
/**
 * 山莊：熟成的田與煉好的丹（MP-091）。只讀存檔欄位，不 import 山莊的作物／丹方表，
 * 免得把遊戲資料拖進主程式；`readyAt`／`unitMs` 由山莊在種植／開爐時寫入，舊檔沒有就略過。
 * time 取「最早熟成而還沒收」的那一件：之後陸續熟成不再重複跳，全部收完後再熟的才算新事件。
 */
export function collectVillaReadyItems(save, now = Date.now()) {
  const timestamp = Number(now) || Date.now();
  const plots = Array.isArray(save?.farm?.plots) ? save.farm.plots : [];
  const ripePlots = plots.filter((plot) => plot?.cropId && Number(plot.readyAt) > 0 && Number(plot.readyAt) <= timestamp);
  const furnaces = Array.isArray(save?.shop?.furnaces) ? save.shop.furnaces : [];
  const cooked = furnaces.map((furnace) => {
    const startedAt = Number(furnace?.startedAt);
    const unitMs = Number(furnace?.unitMs);
    if (!furnace?.recipeId || !(startedAt > 0) || !(unitMs > 0)) return null;
    const firstReadyAt = startedAt + unitMs;
    if (firstReadyAt > timestamp) return null;
    const done = Math.min(Number(furnace.batch) || 0, Math.floor((timestamp - startedAt) / unitMs));
    return done > 0 ? { readyAt: firstReadyAt, count: done } : null;
  }).filter(Boolean);
  const readyTimes = [...ripePlots.map((plot) => Number(plot.readyAt)), ...cooked.map((item) => item.readyAt)];
  return {
    ripePlots: ripePlots.length,
    cookedBatches: cooked.reduce((sum, item) => sum + item.count, 0),
    earliestReadyAt: readyTimes.length ? Math.min(...readyTimes) : 0,
  };
}

/** 下一個會讓山莊通知變化的時間點（下一塊田熟、下一爐第一份好）；沒有就回 0。 */
export function nextVillaDueAt(save, now = Date.now()) {
  const timestamp = Number(now) || Date.now();
  const candidates = [];
  for (const plot of Array.isArray(save?.farm?.plots) ? save.farm.plots : []) {
    if (plot?.cropId && Number(plot.readyAt) > timestamp) candidates.push(Number(plot.readyAt));
  }
  for (const furnace of Array.isArray(save?.shop?.furnaces) ? save.shop.furnaces : []) {
    const startedAt = Number(furnace?.startedAt);
    const unitMs = Number(furnace?.unitMs);
    if (furnace?.recipeId && startedAt > 0 && unitMs > 0 && startedAt + unitMs > timestamp) candidates.push(startedAt + unitMs);
  }
  return candidates.length ? Math.min(...candidates) : 0;
}

function collectVillaNotifications({ yunyinSave, featureLoaded, featureNow }) {
  if (!featureLoaded || !yunyinSave) return [];
  const ready = collectVillaReadyItems(yunyinSave, featureNow);
  if (!ready.ripePlots && !ready.cookedBatches) return [];
  const parts = [];
  if (ready.ripePlots) parts.push(uiTr(`${ready.ripePlots} 塊田可以收成了`, `${ready.ripePlots} plot${ready.ripePlots > 1 ? "s are" : " is"} ready to harvest`, `${ready.ripePlots} 区画の作物が収穫できます`, `밭 ${ready.ripePlots}곳을 수확할 수 있어요`));
  if (ready.cookedBatches) parts.push(uiTr(`丹爐煉好了 ${ready.cookedBatches} 份`, `${ready.cookedBatches} batch${ready.cookedBatches > 1 ? "es" : ""} finished in the furnace`, `丹炉で ${ready.cookedBatches} 回分が完成しました`, `단로에서 ${ready.cookedBatches}회분이 완성됐어요`));
  return [{
    id: `${NOTIFICATION_TYPES.VILLA}:ready`,
    type: NOTIFICATION_TYPES.VILLA,
    title: uiTr("雲隱山莊", "Cloudveil Villa", "雲隠山荘", "운은산장"),
    body: parts.join(uiTr("、", ", ", "、", ", ")),
    fallbackIcon: "⛰️",
    // 明細在 body；count 固定 1，橫幅標題才不會變成「雲隱山莊・3 則訊息」。
    count: 1,
    time: ready.earliestReadyAt,
    appId: "yunyin",
    payload: {},
  }];
}

/** 台灣時間 05:00 換日（與 taiwanDayKey 一致）：回傳目前這一「天」的起點時間戳。 */
export function taiwanDayStart(now = Date.now()) {
  const [year, month, day] = taiwanDayKey(now).split("-").map(Number);
  return Date.UTC(year, month - 1, day, 5) - 8 * 60 * 60 * 1000;
}

function collectLoginRewardNotifications({ loginReward, featureLoaded, featureNow }) {
  if (!featureLoaded) return [];
  const now = Number(featureNow) || Date.now();
  if (loginReward?.lastClaimDate === taiwanDayKey(now)) return [];
  const nextDay = Math.min(7, (Number(loginReward?.day) || 0) + 1);
  return [{
    id: `${NOTIFICATION_TYPES.LOGIN_REWARD}:today`,
    type: NOTIFICATION_TYPES.LOGIN_REWARD,
    title: uiTr("登入獎勵", "Login reward", "ログイン報酬", "로그인 보상"),
    body: uiTr(`今天的獎勵還沒領（第 ${nextDay} 天），點一下去領。`, `Today's reward (day ${nextDay}) is waiting. Tap to claim.`, `今日の報酬（${nextDay}日目）がまだです。タップして受け取りましょう。`, `오늘의 보상(${nextDay}일차)을 아직 받지 않았어요. 눌러서 받으세요.`),
    fallbackIcon: "🎁",
    count: 1,
    time: taiwanDayStart(now),
    appId: "game",
    payload: { gamePage: "loginReward" },
  }];
}

/** 通知時鐘下一次該跳的時間：下一塊田熟／下一爐好／下一次換日，取最近的。 */
export function nextFeatureNotificationDueAt({ yunyinSave } = {}, now = Date.now()) {
  const timestamp = Number(now) || Date.now();
  const candidates = [taiwanDayStart(timestamp) + 24 * 60 * 60 * 1000];
  const villa = nextVillaDueAt(yunyinSave, timestamp);
  if (villa) candidates.push(villa);
  return Math.min(...candidates.filter((value) => value > timestamp));
}

/**
 * 離開沉浸 App 時要補跳的通知（MP-091）：遊玩期間被抑制的那些，
 * 只留現在還存在（沒被讀掉）的，去重，且不包含正要進入的 App 自己的。
 */
export function selectCatchUpNotifications(missed, notifications, currentApp) {
  const seen = new Set();
  const result = [];
  for (const item of missed || []) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    const live = (notifications || []).find((candidate) => candidate.id === item.id);
    if (!live || live.appId === currentApp) continue;
    result.push(live);
  }
  return result.sort((a, b) => b.time - a.time);
}

export function collectNotifications(sources = {}) {
  return [
    ...collectMessageNotifications(sources),
    ...collectDatingNotifications(sources),
    ...collectSocialNotifications(sources),
    ...collectVillaNotifications(sources),
    ...collectLoginRewardNotifications(sources),
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
  return filterForSurface(list, settings, "lockScreen")
    .filter((item) => item.type !== NOTIFICATION_TYPES.SOCIAL)
    .slice(0, LOCK_NOTIFICATION_LIMIT);
}

export function buildBadgeCounts(list, settings) {
  return filterForSurface(list, settings, "badge").reduce((acc, item) => {
    acc[item.appId] = (acc[item.appId] || 0) + (item.count || 1);
    return acc;
  }, {});
}

/**
 * 橫幅是唯一會打斷玩家的表面，抑制條件也最多。
 * 鎖定／勿擾：不顯示，而且不補跳；沉浸 App：不顯示，離開時補跳一次（selectCatchUpNotifications）。
 */
export function canInterrupt({ settings, locked, currentApp, now }) {
  if (locked) return false;
  if (settings?.enabled === false || settings?.surfaces?.banner === false) return false;
  if (IMMERSIVE_APPS.includes(currentApp)) return false;
  return !isQuietHours(settings, now);
}

/**
 * 系統通知的抑制條件比橫幅少一項：不看 currentApp 與 locked。
 * 它只在頁面不在前景時送出（由呼叫端判斷），此時玩家開著哪個 App、
 * 虛擬手機鎖沒鎖都不構成「正在被打斷」，勿擾時段則照常尊重。
 */
export function canNotifySystem({ settings, now }) {
  if (settings?.enabled === false || settings?.surfaces?.system !== true) return false;
  return !isQuietHours(settings, now);
}

export const filterAllowedTypes = (list, settings) => list.filter((item) => typeAllowed(settings, item.type));

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

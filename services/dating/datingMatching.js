import {
  CONTACT_PACE_THRESHOLDS, MATCH_BASE_RATE, MATCH_DISLIKE_WEIGHT, MATCH_LIKE_WEIGHT,
  MATCH_RATE_MAX, MATCH_RATE_MIN, PASS_COOLDOWN_MS, RESPONSE_DELAY_RANGES,
  SUPER_LIKE_INITIAL, SUPER_LIKE_RATE_FLOOR,
} from "../../constants/dating";
import { dayKey, isEffectiveMessage } from "./datingChat";
import { DATING_PROFILES } from "../../data/dating/profiles";
import { isValidTag } from "../../data/dating/interestTags";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const intersect = (a = [], b = []) => a.filter((item) => b.includes(item));

export const createDatingState = () => ({
  profile: { bio: "", photos: [], tags: [] },
  swiped: {},        // profileId → { action: "pass" | "like" | "super", at }
  pending: [],       // 已右滑且註定會配對的，等時間到
  matches: [],       // 已配對：{ profileId, at, superLike, shared, seen }
  /**
   * 對話活在這裡，不進 chatHistory，配對成功也不建角色。
   * characters 有三十幾個消費端（聯絡人、社群、群組、錢包⋯），
   * 靠旗標到處過濾是打地鼠；根本不建立才不會穿幫。
   * profileId → { messages, unread, contactCharId, promotedAt }
   */
  relations: {},
  blocked: {},       // profileId → at；封鎖只作用在交友軟體，已加入聯絡人的聊天室不受影響
  reports: [],       // { profileId, at, resolveAt, status, claimed }

  superLikes: SUPER_LIKE_INITIAL,
  superLikeLog: [],  // 稀缺資源要有帳可查：{ profileId, at, status }
});

export function normalizeDatingState(src) {
  const base = createDatingState();
  const source = src && typeof src === "object" ? src : {};
  const profile = source.profile && typeof source.profile === "object" ? source.profile : {};
  return {
    profile: {
      bio: typeof profile.bio === "string" ? profile.bio.slice(0, 500) : "",
      photos: Array.isArray(profile.photos) ? profile.photos.filter((item) => typeof item === "string").slice(0, 6) : [],
      tags: Array.isArray(profile.tags) ? profile.tags.filter(isValidTag).slice(0, 12) : [],
    },
    swiped: source.swiped && typeof source.swiped === "object" ? source.swiped : {},
    pending: Array.isArray(source.pending) ? source.pending : [],
    matches: Array.isArray(source.matches) ? source.matches : [],
    relations: source.relations && typeof source.relations === "object" ? source.relations : {},
    blocked: source.blocked && typeof source.blocked === "object" ? source.blocked : {},
    reports: Array.isArray(source.reports) ? source.reports : [],
    superLikes: Number.isFinite(Number(source.superLikes)) ? Math.max(0, Number(source.superLikes)) : base.superLikes,
    superLikeLog: Array.isArray(source.superLikeLog) ? source.superLikeLog : [],
  };
}

export const findProfile = (profileId) => DATING_PROFILES.find((item) => item.id === profileId) || null;

/** 公開的興趣標籤命中就加分，隱藏的雷點命中就扣分（扣得比加的重）。 */
export function calculateMatchRate(entry, playerTags = [], superLike = false) {
  const likes = intersect(entry.profile?.tags, playerTags).length;
  const dislikes = intersect(entry.dislikes, playerTags).length;
  const raw = MATCH_BASE_RATE + likes * MATCH_LIKE_WEIGHT - dislikes * MATCH_DISLIKE_WEIGHT;
  const rate = clamp(raw, MATCH_RATE_MIN, MATCH_RATE_MAX);
  return superLike ? Math.max(rate, SUPER_LIKE_RATE_FLOOR) : rate;
}

/** 配對慶祝畫面上顯示的共同點——玩家得感覺到檔案有用，否則這套系統等於不存在。 */
export const sharedTags = (entry, playerTags = []) => intersect(entry.profile?.tags, playerTags);

export function pickDelay(responseStyle, superLike) {
  const [min, max] = RESPONSE_DELAY_RANGES[responseStyle] || RESPONSE_DELAY_RANGES.normal;
  const delay = min + Math.random() * (max - min);
  return Math.round(superLike ? delay / 2 : delay);
}

/**
 * 結果在右滑的當下就骰完，連延遲長度一起，存進 pending。
 * 若等到 sweep 才判定，玩家關掉重開就能刷結果。
 */
export function decideSwipe(entry, playerTags, superLike, now = Date.now()) {
  const rate = calculateMatchRate(entry, playerTags, superLike);
  if (Math.random() >= rate) return null;
  return { profileId: entry.id, superLike, rate, decidedAt: now, matchAt: now + pickDelay(entry.responseStyle, superLike) };
}

/** 跳過的人隔一天回鍋；配對過、Super Like 過、封鎖過與檢舉成立的不再出現。 */
export function availableProfiles(state, now = Date.now()) {
  const matchedIds = new Set(state.matches.map((item) => item.profileId));
  const pendingIds = new Set(state.pending.map((item) => item.profileId));
  // 檢舉成立的帳號永久消失，獎勵總量因此天然封頂，不會變成農法。
  const removed = new Set((state.reports || []).filter((item) => item.status === "confirmed").map((item) => item.profileId));
  return DATING_PROFILES.filter((entry) => {
    if (matchedIds.has(entry.id) || pendingIds.has(entry.id)) return false;
    if (state.blocked?.[entry.id] || removed.has(entry.id)) return false;
    const swipe = state.swiped[entry.id];
    if (!swipe) return true;
    if (swipe.action !== "pass") return false;
    return now - (swipe.at || 0) >= PASS_COOLDOWN_MS;
  });
}

/** 全部滑完時，算出最快什麼時候會有人回鍋，好在空狀態給玩家一個時間。 */
export function nextRefreshAt(state, now = Date.now()) {
  const times = DATING_PROFILES
    .map((entry) => state.swiped[entry.id])
    .filter((swipe) => swipe?.action === "pass")
    .map((swipe) => (swipe.at || 0) + PASS_COOLDOWN_MS)
    .filter((at) => at > now);
  return times.length ? Math.min(...times) : 0;
}

/**
 * 加入聯絡人的門檻：有效訊息數 + 跨越的遊玩日。
 *
 * 兩個條件都要滿足。跨天是關鍵——現實中沒有人聊三十句就交換聯絡方式，是「聊了幾天」。
 * 不要求連續，玩家斷一天不會被懲罰。
 *
 * 刻意不顯示成進度條：一有進度條，聊天就變成刷條，對話品質會垮。
 * 玩家感覺到的應該是角色的態度變了，然後按鈕突然出現——是驚喜，不是達成。
 */
export function contactProgress(entry, relation) {
  const threshold = CONTACT_PACE_THRESHOLDS[entry.pace] || CONTACT_PACE_THRESHOLDS.normal;
  const messages = relation?.messages || [];
  const effective = messages.filter(isEffectiveMessage);
  const days = new Set(effective.map((item) => dayKey(item.time)));
  return {
    ready: effective.length >= threshold.messages && days.size >= threshold.days,
    messages: effective.length,
    days: days.size,
    threshold,
  };
}

/**
 * 檢舉審核：時間到才有結果，是不是詐騙由卡池的 isScam 決定。
 * 誤報也會收到回覆（「經查證無違規」），沒有懲罰——成本已經付了：
 * 檢舉的同時就封鎖，你失去了這個角色。
 */
export function resolveReports(reports, now = Date.now()) {
  let changed = false;
  const next = reports.map((item) => {
    if (item.status !== "reviewing" || now < item.resolveAt) return item;
    changed = true;
    return { ...item, status: findProfile(item.profileId)?.isScam ? "confirmed" : "dismissed", resolvedAt: now };
  });
  return changed ? next : reports;
}

// 檢舉獎的是「你在受害前就發現了」。都已經交換聯絡方式了，等於已經上鉤，不再給獎。
export const canReport = (relation) => !relation?.contactCharId;

export function maturePending(state, now = Date.now()) {
  const matured = state.pending.filter((item) => item.matchAt <= now);
  return { matured, remaining: state.pending.filter((item) => item.matchAt > now) };
}

/** Super Like 過了預定時間還沒配對，就標成「未回應」——不是拒絕通知，只是沒有下文。 */
export function resolveSuperLikeLog(log, state, now = Date.now()) {
  const matchedIds = new Set(state.matches.map((item) => item.profileId));
  const pendingIds = new Set(state.pending.map((item) => item.profileId));
  let changed = false;
  const next = log.map((item) => {
    if (item.status !== "waiting") return item;
    if (matchedIds.has(item.profileId)) { changed = true; return { ...item, status: "matched" }; }
    if (pendingIds.has(item.profileId)) return item;
    if (now < (item.resolveAt || 0)) return item;
    changed = true;
    return { ...item, status: "silent" };
  });
  // 沒變就回傳原陣列，否則每次 sweep 都會產生新物件、觸發無謂的存檔。
  return changed ? next : log;
}

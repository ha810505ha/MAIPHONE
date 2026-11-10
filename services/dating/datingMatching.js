import {
  DATING_NICKNAME_MAX, MATCH_BASE_RATE, MATCH_DISLIKE_WEIGHT, MATCH_LIKE_WEIGHT,
  LIKE_RETRY_COOLDOWN_MS, MATCH_RATE_MAX, MATCH_RATE_MIN, PASS_COOLDOWN_MS, RESPONSE_DELAY_RANGES,
  SUPER_LIKE_INITIAL, SUPER_LIKE_MAX, SUPER_LIKE_RATE_FLOOR, SUPER_LIKE_TIME_ZONE, SUPER_LIKE_WEEKLY_FLOOR,
} from "../../constants/dating.js";
import { dayKey, isEffectiveMessage } from "./datingChat.js";
import { DATING_PROFILES } from "../../data/dating/profiles.js";
import { isValidTag } from "../../data/dating/interestTags.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const intersect = (a = [], b = []) => a.filter((item) => b.includes(item));

export const createDatingState = () => ({
  // name 是信風專用暱稱（MP-055），空字串＝顯示層回退玩家名稱；舊存檔沒有此欄位。
  profile: { name: "", bio: "", photos: [], tags: [] },
  swiped: {},        // profileId → { action: "pass" | "like" | "super", at }
  pending: [],       // 已右滑且註定會配對的，等時間到
  matches: [],       // 已配對：{ profileId, at, superLike, shared, seen }
  /**
   * 信風保存公開階段的聊天與解鎖狀態；完整角色卡由 DATING_PROFILES registry 持有。
   * characterId 是角色永久身份，contactCharId 為 null 時代表尚未顯示在聯絡人；
   * 解鎖後兩者相同（舊存檔可能保留舊版隨機 contactCharId）。
   * profileId → { messages, unread, characterId, contactState, contactCharId, promotedAt }
   */
  relations: {},
  blocked: {},       // profileId → at；封鎖只作用在交友軟體，已加入聯絡人的聊天室不受影響
  reports: [],       // { profileId, at, resolveAt, status, claimed }

  superLikes: SUPER_LIKE_INITIAL,
  // 稀缺資源要有帳可查：使用 { profileId, at, status: waiting|matched|silent, resolveAt }；
  // 回補 { profileId: null, at, status: "granted", source, count }。
  superLikeLog: [],
  // 每週補滿只做一次：記本週（台北時間，週一起算）的 key，見 getTaipeiWeekKey。
  lastSuperLikeRefillWeek: "",
});

export function normalizeDatingState(src, profiles = DATING_PROFILES) {
  const base = createDatingState();
  const source = src && typeof src === "object" ? src : {};
  const profile = source.profile && typeof source.profile === "object" ? source.profile : {};
  const profileRegistry = Array.isArray(profiles) ? profiles : DATING_PROFILES;
  return {
    profile: {
      name: typeof profile.name === "string" || typeof profile.name === "number" ? String(profile.name).slice(0, DATING_NICKNAME_MAX) : "",
      bio: typeof profile.bio === "string" ? profile.bio.slice(0, 500) : "",
      photos: Array.isArray(profile.photos) ? profile.photos.filter((item) => typeof item === "string").slice(0, 6) : [],
      tags: Array.isArray(profile.tags) ? profile.tags.filter(isValidTag).slice(0, 12) : [],
    },
    swiped: source.swiped && typeof source.swiped === "object" ? source.swiped : {},
    pending: Array.isArray(source.pending) ? source.pending : [],
    matches: Array.isArray(source.matches) ? source.matches : [],
    relations: source.relations && typeof source.relations === "object"
      ? Object.fromEntries(Object.entries(source.relations).map(([profileId, rawRelation]) => {
        const relation = rawRelation && typeof rawRelation === "object" ? rawRelation : {};
        const canonicalCharacterId = profileRegistry.find((entry) => entry.id === profileId)?.character?.id
          || relation.characterId
          || null;
        const contactCharId = relation.contactCharId || null;
        return [profileId, {
          ...relation,
          messages: Array.isArray(relation.messages) ? relation.messages : [],
          unread: Math.max(0, Number(relation.unread) || 0),
          characterId: canonicalCharacterId,
          // invited（角色已邀請／答應，等玩家按交換）要保留；其他一律依是否已升格判定。
          contactState: contactCharId ? "unlocked" : relation.contactState === "invited" ? "invited" : "locked",
          contactCharId,
          promotedAt: Math.max(0, Number(relation.promotedAt) || 0),
        }];
      }))
      : {},
    blocked: source.blocked && typeof source.blocked === "object" ? source.blocked : {},
    reports: Array.isArray(source.reports) ? source.reports : [],
    superLikes: Number.isFinite(Number(source.superLikes))
      ? clamp(Math.floor(Number(source.superLikes)), 0, SUPER_LIKE_MAX)
      : base.superLikes,
    superLikeLog: Array.isArray(source.superLikeLog) ? source.superLikeLog : [],
    lastSuperLikeRefillWeek: typeof source.lastSuperLikeRefillWeek === "string" ? source.lastSuperLikeRefillWeek : "",
  };
}

const taipeiDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SUPER_LIKE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
});

/**
 * 回傳 now 所屬「台北時間週」的週一日期（YYYY-MM-DD）。
 * 以 Intl 取台北當地日期與星期，不依賴機器時區；台北沒有夏令時間，週一 00:00 的界線穩定。
 */
export function getTaipeiWeekKey(now = Date.now()) {
  const parts = taipeiDateFormatter.formatToParts(new Date(now));
  const pick = (type) => parts.find((item) => item.type === type)?.value || "";
  const weekdayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(pick("weekday"));
  // 用 UTC 日曆做日期減法，避免本機時區在換日時干擾。
  const localDay = Date.UTC(Number(pick("year")), Number(pick("month")) - 1, Number(pick("day")));
  const monday = new Date(localDay - Math.max(0, weekdayIndex) * 24 * 60 * 60 * 1000);
  return monday.toISOString().slice(0, 10);
}

const SUPER_LIKE_LOG_LIMIT = 50;

/**
 * 加 Super Like：夾在上限，並在帳本寫一筆 granted 紀錄。
 * 夾限後實際加 0（已達上限）時回傳原物件、不寫帳，避免無謂存檔。
 */
export function grantSuperLikes(state, count, { source = "unknown", now = Date.now() } = {}) {
  const amount = Math.max(0, Math.floor(Number(count) || 0));
  const current = clamp(Number(state?.superLikes) || 0, 0, SUPER_LIKE_MAX);
  const next = Math.min(SUPER_LIKE_MAX, current + amount);
  if (next === current) return state;
  const log = Array.isArray(state.superLikeLog) ? state.superLikeLog : [];
  return {
    ...state,
    superLikes: next,
    superLikeLog: [{ profileId: null, at: now, status: "granted", source, count: next - current }, ...log].slice(0, SUPER_LIKE_LOG_LIMIT),
  };
}

/**
 * 每週（台北時間週一 00:00 起算）第一次進入時補到 SUPER_LIKE_WEEKLY_FLOOR，不累積：
 * 有 5 個就不補、但仍記下本週已處理。沒變化時回傳同一物件。
 */
export function applySuperLikeRefill(state, now = Date.now()) {
  const week = getTaipeiWeekKey(now);
  if (state?.lastSuperLikeRefillWeek === week) return state;
  const current = Math.max(0, Number(state?.superLikes) || 0);
  const marked = { ...state, lastSuperLikeRefillWeek: week };
  if (current >= SUPER_LIKE_WEEKLY_FLOOR) return marked;
  return grantSuperLikes(marked, SUPER_LIKE_WEEKLY_FLOOR - current, { source: "weekly", now });
}

export const findProfile = (profileId) => DATING_PROFILES.find((item) => item.id === profileId) || null;

/**
 * 舊版可能因連點留下多張相同 datingProfileId 的角色。對帳時不自動刪資料，
 * 但必須優先保留 relation 正在使用的聊天室，其次才是新版永久 id。
 */
export function chooseDatingContactId(candidates, profileId, relation, profiles = DATING_PROFILES) {
  const byId = new Map((Array.isArray(candidates) ? candidates : [])
    .map((character) => [String(character?.id || "").trim(), character])
    .filter(([characterId]) => characterId));
  const linkedId = String(relation?.contactCharId || "").trim();
  if (linkedId && byId.has(linkedId)) return linkedId;

  const profileRegistry = Array.isArray(profiles) ? profiles : DATING_PROFILES;
  const canonicalId = String(profileRegistry.find((entry) => entry.id === profileId)?.character?.id || "").trim();
  if (canonicalId && byId.has(canonicalId)) return canonicalId;

  return [...byId.entries()]
    .sort(([leftId, left], [rightId, right]) => {
      const createdDiff = (Number(left?.createdAt) || 0) - (Number(right?.createdAt) || 0);
      return createdDiff || leftId.localeCompare(rightId);
    })[0]?.[0] || null;
}

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

/**
 * 滑過的人什麼時候可以回到牌堆：跳過的隔一天，喜歡／Super Like 沒配到的冷卻較久。
 * 已配對或配對還在熟成中的人不經過這裡（呼叫端先排除）。
 */
export const swipeReturnAt = (swipe) => (swipe?.at || 0)
  + (swipe?.action === "pass" ? PASS_COOLDOWN_MS : LIKE_RETRY_COOLDOWN_MS);

/** 依「角色 × 日期」算出的固定洗牌序（FNV-1a）。同一天內不變，換日才重排。 */
export function dailyDeckRank(profileId, day) {
  const seed = `${day}:${profileId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * 除了已配對、熟成中、封鎖與檢舉成立的人，其餘滑過的人冷卻後都會回鍋。
 * 牌堆每天洗一次：卡池順序固定的話，前幾個角色永遠最先出現、回鍋的人也照原順序排。
 */
export function availableProfiles(state, now = Date.now()) {
  const matchedIds = new Set(state.matches.map((item) => item.profileId));
  const pendingIds = new Set(state.pending.map((item) => item.profileId));
  // 檢舉成立的帳號永久消失，獎勵總量因此天然封頂，不會變成農法。
  const removed = new Set((state.reports || []).filter((item) => item.status === "confirmed").map((item) => item.profileId));
  const day = dayKey(now);
  return DATING_PROFILES.filter((entry) => {
    if (matchedIds.has(entry.id) || pendingIds.has(entry.id)) return false;
    if (state.blocked?.[entry.id] || removed.has(entry.id)) return false;
    const swipe = state.swiped[entry.id];
    if (!swipe) return true;
    return now >= swipeReturnAt(swipe);
  }).map((entry) => ({ entry, rank: dailyDeckRank(entry.id, day) }))
    .sort((a, b) => a.rank - b.rank || a.entry.id.localeCompare(b.entry.id))
    .map((item) => item.entry);
}

/** 全部滑完時，算出最快什麼時候會有人回鍋，好在空狀態給玩家一個時間。 */
export function nextRefreshAt(state, now = Date.now()) {
  const matchedIds = new Set(state.matches.map((item) => item.profileId));
  const pendingIds = new Set(state.pending.map((item) => item.profileId));
  const times = DATING_PROFILES
    .filter((entry) => !matchedIds.has(entry.id) && !pendingIds.has(entry.id) && !state.blocked?.[entry.id])
    .map((entry) => state.swiped[entry.id])
    .filter(Boolean)
    .map(swipeReturnAt)
    .filter((at) => at > now);
  return times.length ? Math.min(...times) : 0;
}

// 門檻計算搬到 datingChat.js（提示詞也要用），這裡保留原匯出。
export { contactProgress } from "./datingChat.js";

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
    // granted（回補）與已結案的項目不再處理。
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

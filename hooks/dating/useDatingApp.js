import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DATING_ENTITY_KEY, IN_APP_REPLY_DELAY, REPORT_REVIEW_RANGE, REPORT_REWARD_SUPER_LIKES } from "../../constants/dating";
import { isOnline, pendingUserMessages } from "../../services/dating/datingPresence";
import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";
import {
  availableProfiles, createDatingState, decideSwipe, findProfile, maturePending,
  nextRefreshAt, normalizeDatingState, resolveReports, resolveSuperLikeLog, sharedTags,
} from "../../services/dating/datingMatching";
import { generateDatingReply } from "../../services/dating/datingChat";
import { FEATURE_DATA_CHANGED_EVENT, featureDataEventIncludes } from "../../services/featureDataLifecycle";
import { createDatingReplyLifecycle, waitForDatingReplyDelay } from "../../services/dating/datingReplyLifecycle";
import { isRequestCancelled } from "../../utils/networkRequest.js";

const SWEEP_INTERVAL = 30 * 1000;
const newId = () => `dm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const emptyRelation = { messages: [], unread: 0, contactCharId: null, promotedAt: 0 };

/**
 * 交友 App 的狀態、配對熟成與 App 內聊天。
 *
 * 熟成 sweep 掛在殼層而非 App 內，因為延遲配對的重點就是玩家在玩別的東西時收到通知。
 * 判定不需要呼叫 AI，所以跑得比主動訊息的 15 分鐘密集得多。
 */
export default function useDatingApp({ apiConfig, playerName, onError }) {
  const [state, setState] = useState(createDatingState);
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);
  const [typingProfiles, setTypingProfiles] = useState(() => new Set());
  const [openChatId, setOpenChatId] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  // 每個對象各自持有 request token；不同對象可並行，同一對象不可重複生成。
  const replyLifecycleRef = useRef(null);
  if (!replyLifecycleRef.current) replyLifecycleRef.current = createDatingReplyLifecycle();
  const lifecycleGenerationRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const reload = async () => {
      const generation = ++lifecycleGenerationRef.current;
      replyLifecycleRef.current.cancelAll("Dating data reloaded");
      setTypingProfiles(new Set());
      setOpenChatId(null);
      const data = await loadFeatureEntity(DATING_ENTITY_KEY, null).catch(() => null);
      if (!mounted || generation !== lifecycleGenerationRef.current) return;
      setState(data ? normalizeDatingState(data) : createDatingState());
      setHydrated(true);
    };
    const onFeatureDataChanged = (event) => {
      if (featureDataEventIncludes(event, DATING_ENTITY_KEY)) void reload();
    };
    void reload();
    window.addEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
    return () => {
      mounted = false;
      lifecycleGenerationRef.current += 1;
      replyLifecycleRef.current.cancelAll("Dating app disposed");
      window.removeEventListener(FEATURE_DATA_CHANGED_EVENT, onFeatureDataChanged);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = setTimeout(() => { saveFeatureEntity(DATING_ENTITY_KEY, state).catch(() => {}); }, 200);
    return () => clearTimeout(timer);
  }, [hydrated, state]);

  const patchRelation = useCallback((profileId, updater) => {
    setState((current) => {
      const relation = current.relations[profileId] || emptyRelation;
      return { ...current, relations: { ...current.relations, [profileId]: { ...relation, ...updater(relation) } } };
    });
  }, []);

  const syncTypingProfiles = useCallback(() => {
    setTypingProfiles(replyLifecycleRef.current.activeProfileIds());
  }, []);

  const cancelReply = useCallback((profileId, reason = "Dating reply cancelled") => {
    if (replyLifecycleRef.current.cancel(profileId, reason)) syncTypingProfiles();
  }, [syncTypingProfiles]);

  const cancelAllReplies = useCallback((reason = "Dating app closed") => {
    if (replyLifecycleRef.current.cancelAll(reason)) syncTypingProfiles();
  }, [syncTypingProfiles]);

  const runSweep = useCallback(() => {
    setState((current) => {
      const now = Date.now();
      const { matured, remaining } = maturePending(current, now);
      const log = resolveSuperLikeLog(current.superLikeLog, current, now);
      const reports = resolveReports(current.reports, now);
      if (!matured.length) {
        if (log === current.superLikeLog && reports === current.reports) return current;
        return { ...current, superLikeLog: log, reports };
      }
      const matches = [...current.matches];
      const relations = { ...current.relations };
      for (const item of matured) {
        const entry = findProfile(item.profileId);
        if (!entry) continue;
        matches.push({
          profileId: entry.id, at: now, superLike: !!item.superLike,
          shared: sharedTags(entry, current.profile.tags), seen: false,
        });
        // 開場訊息預寫：配對通知點進去立刻有話可看，不必等 AI。
        const content = (item.superLike && entry.superLikeOpeningMessage) || entry.openingMessage || "";
        const relation = relations[entry.id] || emptyRelation;
        relations[entry.id] = content.trim()
          ? { ...relation, messages: [...relation.messages, { id: newId(), role: "assistant", content, time: now }], unread: relation.unread + 1 }
          : { ...relation };
      }
      const next = { ...current, pending: remaining, matches, relations, reports };
      return { ...next, superLikeLog: resolveSuperLikeLog(next.superLikeLog, next, now) };
    });
  }, []);

  const swipe = useCallback((profileId, action) => {
    setState((current) => {
      const entry = findProfile(profileId);
      if (!entry) return current;
      const now = Date.now();
      const superLike = action === "super";
      if (superLike && current.superLikes <= 0) return current;
      const next = {
        ...current,
        swiped: { ...current.swiped, [profileId]: { action, at: now } },
        superLikes: superLike ? current.superLikes - 1 : current.superLikes,
      };
      if (action === "pass") return next;
      const decision = decideSwipe(entry, current.profile.tags, superLike, now);
      if (decision) next.pending = [...current.pending, decision];
      if (superLike) {
        // 沒配對的話，等預定時間過完再標成「未回應」——不是拒絕通知，只是沒有下文。
        const resolveAt = decision?.matchAt || now + 12 * 60 * 60 * 1000;
        next.superLikeLog = [{ profileId, at: now, status: "waiting", resolveAt }, ...current.superLikeLog].slice(0, 50);
      }
      return next;
    });
  }, []);

  // 回上一張只還原滑動紀錄，不退還 Super Like，也不撤銷已經骰出的配對。
  const rewind = useCallback((profileId) => {
    setState((current) => {
      if (!current.swiped[profileId]) return current;
      const swiped = { ...current.swiped };
      delete swiped[profileId];
      return { ...current, swiped, pending: current.pending.filter((item) => item.profileId !== profileId) };
    });
  }, []);

  /** 產生一則回覆並寫進對話。catchUp 有值代表這是離線期間累積的訊息，上線後一次回完。 */
  const produceReply = useCallback(async (entry, catchUp) => {
    const profileId = entry.id;
    const request = replyLifecycleRef.current.start(profileId);
    if (!request) return;
    const lifecycleGeneration = lifecycleGenerationRef.current;
    syncTypingProfiles();
    const startedAt = Date.now();
    try {
      const reply = await generateDatingReply({
        entry, messages: stateRef.current.relations[profileId]?.messages || [],
        datingProfile: stateRef.current.profile, playerName, apiConfig, catchUp,
        signal: request.controller.signal,
      });
      // 最短耗時：秒回型幾乎立刻，慢熱型即使在線也會拖一下。API 本身慢的話就不再加等。
      const [min, max] = IN_APP_REPLY_DELAY[entry.responseStyle] || IN_APP_REPLY_DELAY.normal;
      const remaining = min + Math.random() * (max - min) - (Date.now() - startedAt);
      if (remaining > 0) await waitForDatingReplyDelay(remaining, request.controller.signal);
      if (
        !reply
        || lifecycleGeneration !== lifecycleGenerationRef.current
        || !replyLifecycleRef.current.isActive(request)
        || stateRef.current.blocked?.[profileId]
      ) return;
      patchRelation(profileId, (relation) => ({
        messages: [...relation.messages, { id: newId(), role: "assistant", content: reply, time: Date.now() }],
        // 補回的訊息要算未讀，才會跳通知；玩家正在看的話 openChat 會清掉。
        unread: catchUp ? relation.unread + 1 : relation.unread,
      }));
    } catch (error) {
      // 玩家的訊息已經寫進去了，保留它；只回報失敗，讓玩家可以重試。
      if (
        !isRequestCancelled(error)
        && lifecycleGeneration === lifecycleGenerationRef.current
        && replyLifecycleRef.current.isActive(request)
      ) {
        onError?.(error?.message || "訊息傳送失敗");
      }
    } finally {
      if (replyLifecycleRef.current.finish(request)) syncTypingProfiles();
    }
  }, [apiConfig, playerName, patchRelation, onError, syncTypingProfiles]);

  const sendMessage = useCallback(async (profileId, text) => {
    const entry = findProfile(profileId);
    const content = String(text || "").trim();
    if (!entry || !content || replyLifecycleRef.current.has(profileId)) return;
    if (stateRef.current.blocked?.[profileId]) return;
    patchRelation(profileId, (relation) => ({
      messages: [...relation.messages, { id: newId(), role: "user", content, time: Date.now() }],
    }));
    // 離線就先不回；等他上線後由 sweep 一次回完，這樣才有真實的時間差。
    if (!isOnline(entry)) return;
    await produceReply(entry, null);
  }, [patchRelation, produceReply]);

  /** 對方上線後，把離線期間累積的訊息補回。 */
  const deliverPendingReplies = useCallback(() => {
    const current = stateRef.current;
    for (const [profileId, relation] of Object.entries(current.relations || {})) {
      if (current.blocked?.[profileId] || replyLifecycleRef.current.has(profileId)) continue;
      const entry = findProfile(profileId);
      if (!entry || !isOnline(entry)) continue;
      const pending = pendingUserMessages(relation.messages);
      if (!pending.length) continue;
      const awayMinutes = (Date.now() - pending[0].time) / 60000;
      produceReply(entry, { pendingCount: pending.length, awayMinutes });
    }
  }, [produceReply]);

  // 掛在這裡而不是檔案上方：它依賴 deliverPendingReplies，宣告順序不能反。
  useEffect(() => {
    if (!hydrated) return undefined;
    const tickAll = () => { runSweep(); deliverPendingReplies(); };
    const onVisible = () => { if (document.visibilityState === "visible") tickAll(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const kick = setTimeout(tickAll, 1500);
    const interval = setInterval(tickAll, SWEEP_INTERVAL);
    // 空狀態的「還有多久有人回鍋」要會自己走，所以額外跳一個 tick。
    const ticker = setInterval(() => setTick((value) => value + 1), 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearTimeout(kick);
      clearInterval(interval);
      clearInterval(ticker);
    };
  }, [hydrated, runSweep, deliverPendingReplies]);

  /**
   * 加入聯絡人＝把角色卡匯入真正的角色系統。
   * 交友 App 這條對話保留並且還能繼續聊，但兩邊從此各走各的；
   * 搬一份歷史過去當起點，否則剛加好友的第一句會像失憶。
   */
  const promoteToContact = useCallback((profileId, onPromote) => {
    const entry = findProfile(profileId);
    const relation = stateRef.current.relations[profileId];
    if (!entry || !relation || relation.contactCharId) return null;
    const charId = onPromote?.(entry, relation.messages);
    if (!charId) return null;
    patchRelation(profileId, () => ({ contactCharId: charId, promotedAt: Date.now() }));
    return charId;
  }, [patchRelation]);

  const setBlocked = useCallback((profileId, blocked) => {
    if (blocked) cancelReply(profileId, "Profile blocked");
    setState((current) => {
      const next = { ...current.blocked };
      if (blocked) next[profileId] = Date.now(); else delete next[profileId];
      return { ...current, blocked: next };
    });
  }, [cancelReply]);

  /** 檢舉一定連帶封鎖：真實的交友軟體就是這樣，也讓誤報的成本天然存在。 */
  const report = useCallback((profileId) => {
    cancelReply(profileId, "Profile reported");
    setState((current) => {
      if (current.reports.some((item) => item.profileId === profileId)) return current;
      const now = Date.now();
      const [min, max] = REPORT_REVIEW_RANGE;
      return {
        ...current,
        blocked: { ...current.blocked, [profileId]: now },
        reports: [{ profileId, at: now, resolveAt: now + min + Math.random() * (max - min), status: "reviewing", claimed: false }, ...current.reports],
      };
    });
  }, [cancelReply]);

  const claimReportReward = useCallback((profileId) => {
    setState((current) => {
      const target = current.reports.find((item) => item.profileId === profileId);
      if (!target || target.status !== "confirmed" || target.claimed) return current;
      return {
        ...current,
        superLikes: current.superLikes + REPORT_REWARD_SUPER_LIKES,
        reports: current.reports.map((item) => (item.profileId === profileId ? { ...item, claimed: true } : item)),
      };
    });
  }, []);

  const openChat = useCallback((profileId) => {
    setOpenChatId(profileId);
    patchRelation(profileId, () => ({ unread: 0 }));
    setState((current) => ({
      ...current,
      matches: current.matches.map((item) => (item.profileId === profileId ? { ...item, seen: true } : item)),
    }));
  }, [patchRelation]);

  const closeChat = useCallback((profileId = openChatId) => {
    if (profileId) cancelReply(profileId, "Dating chat closed");
    setOpenChatId(null);
  }, [openChatId, cancelReply]);

  return {
    state, typingProfiles, openChatId, openChat, closeChat, swipe, rewind, sendMessage, promoteToContact,
    setBlocked, report, claimReportReward, cancelAllReplies,
    deck: useMemo(() => availableProfiles(state, Date.now()), [state, tick]),
    refreshAt: useMemo(() => nextRefreshAt(state, Date.now()), [state, tick]),
    unseenMatches: useMemo(() => state.matches.filter((item) => !item.seen), [state.matches]),
    updateProfile: useCallback((patch) => {
      setState((current) => normalizeDatingState({ ...current, profile: { ...current.profile, ...patch } }));
    }, []),
    markMatchSeen: useCallback((profileId) => {
      setState((current) => ({
        ...current,
        matches: current.matches.map((item) => (item.profileId === profileId ? { ...item, seen: true } : item)),
      }));
    }, []),
  };
}

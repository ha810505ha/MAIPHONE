import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DATING_ENTITY_KEY, IN_APP_REPLY_DELAY, REPORT_REVIEW_RANGE, REPORT_REWARD_SUPER_LIKES } from "../../constants/dating";
import { isOnline, pendingUserMessages } from "../../services/dating/datingPresence";
import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";
import {
  availableProfiles, createDatingState, decideSwipe, findProfile, maturePending,
  nextRefreshAt, normalizeDatingState, resolveReports, resolveSuperLikeLog, sharedTags,
} from "../../services/dating/datingMatching";
import { generateDatingReply } from "../../services/dating/datingChat";

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
  const [typing, setTyping] = useState(null);
  const [openChatId, setOpenChatId] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  // 防止 sweep 跟玩家送出的訊息同時對同一個人生成回覆。
  const deliveringRef = useRef(new Set());

  useEffect(() => {
    let mounted = true;
    loadFeatureEntity(DATING_ENTITY_KEY, null)
      .then((data) => { if (mounted && data) setState(normalizeDatingState(data)); })
      .catch(() => {})
      .finally(() => { if (mounted) setHydrated(true); });
    return () => { mounted = false; };
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
    if (deliveringRef.current.has(profileId)) return;
    deliveringRef.current.add(profileId);
    setTyping(profileId);
    const startedAt = Date.now();
    try {
      const reply = await generateDatingReply({
        entry, messages: stateRef.current.relations[profileId]?.messages || [],
        datingProfile: stateRef.current.profile, playerName, apiConfig, catchUp,
      });
      // 最短耗時：秒回型幾乎立刻，慢熱型即使在線也會拖一下。API 本身慢的話就不再加等。
      const [min, max] = IN_APP_REPLY_DELAY[entry.responseStyle] || IN_APP_REPLY_DELAY.normal;
      const remaining = min + Math.random() * (max - min) - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((done) => setTimeout(done, remaining));
      if (!reply) return;
      patchRelation(profileId, (relation) => ({
        messages: [...relation.messages, { id: newId(), role: "assistant", content: reply, time: Date.now() }],
        // 補回的訊息要算未讀，才會跳通知；玩家正在看的話 openChat 會清掉。
        unread: catchUp ? relation.unread + 1 : relation.unread,
      }));
    } catch (error) {
      // 玩家的訊息已經寫進去了，保留它；只回報失敗，讓玩家可以重試。
      onError?.(error?.message || "訊息傳送失敗");
    } finally {
      deliveringRef.current.delete(profileId);
      setTyping(null);
    }
  }, [apiConfig, playerName, patchRelation, onError]);

  const sendMessage = useCallback(async (profileId, text) => {
    const entry = findProfile(profileId);
    const content = String(text || "").trim();
    if (!entry || !content || typing) return;
    if (stateRef.current.blocked?.[profileId]) return;
    patchRelation(profileId, (relation) => ({
      messages: [...relation.messages, { id: newId(), role: "user", content, time: Date.now() }],
    }));
    // 離線就先不回；等他上線後由 sweep 一次回完，這樣才有真實的時間差。
    if (!isOnline(entry)) return;
    await produceReply(entry, null);
  }, [typing, patchRelation, produceReply]);

  /** 對方上線後，把離線期間累積的訊息補回。 */
  const deliverPendingReplies = useCallback(() => {
    const current = stateRef.current;
    for (const [profileId, relation] of Object.entries(current.relations || {})) {
      if (current.blocked?.[profileId] || deliveringRef.current.has(profileId)) continue;
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
    setState((current) => {
      const next = { ...current.blocked };
      if (blocked) next[profileId] = Date.now(); else delete next[profileId];
      return { ...current, blocked: next };
    });
  }, []);

  /** 檢舉一定連帶封鎖：真實的交友軟體就是這樣，也讓誤報的成本天然存在。 */
  const report = useCallback((profileId) => {
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
  }, []);

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

  return {
    state, typing, openChatId, setOpenChatId, openChat, swipe, rewind, sendMessage, promoteToContact,
    setBlocked, report, claimReportReward,
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

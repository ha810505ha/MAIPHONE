import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGacha } from "../../contexts/GachaContext";
import { SpecialMemoryModal } from "../gacha/SpecialMemoryCard";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import { reviewCoupleInviteReplies } from "../../utils/coupleInviteReview";
import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";
import { AppHeader, LargeTitle, LargeTitleHeader, SUB_PAGE_CLASS, useLargeTitle } from "../shell/LargeTitle";
import { coupleDayKey, generateLoveSign, generateDailyTask, judgeCoupleTask, settleTemperature, temperatureComment } from "../../services/couple/coupleDailyService";
import Icon from "../common/Icon";
import MoonlitSignStage from "../couple/MoonlitSignStage";
import {
  COUPLE_OPEN_PROMISE_LIMIT, COUPLE_UNLOCKS, addCoupleAnniversary, addCouplePromise, buildCoupleAnniversaries, buildCoupleTimeline,
  completeCouplePromise, daysTogether as countDaysTogether, daysUntil, fromDateKey, getCoupleAnniversaries, getCoupleNickname,
  getCouplePeakTemperature, getCouplePromises, isCoupleUnlocked, removeCoupleAnniversary, removeCouplePromise, reopenCouplePromise,
  splitCouplePromises, toDateKey, withCoupleNickname, withCouplePeakTemperature,
} from "../../utils/coupleSpace";

const RARITY_COLORS = { SSR: "#c99a4b", SR: "#8f6cc9", R: "#6f9cc9" };
// 情侶空間固定配色（不跟主題走）。之後調整配色只要改這裡。
const COUPLE_COLORS = { ink: "#7a4257", sub: "#a86e84", faint: "#b98a9c", accent: "#d16a8d", gold: "#a2652f", ok: "#3f9d63", onAccent: "#fff" };
const PROMISE_PAGE_SIZE = 5;
const TIMELINE_MONTH_STEP = 2;
const GLASS = { background: "rgba(255,255,255,.66)", border: "1px solid rgba(255,255,255,.85)" };
const HAND_FONT = "'LXGW WenKai TC','Noto Serif TC',serif";
const DAILY_KEY = "ent_coupleDaily";
const TASK_REWARD = 180;       // 一次單抽所需的靈魂結晶
const STREAK_BONUS = 540;      // 連續 7 天加碼 ×3
const formatDate = (time, locale = "zh-TW") => new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
const MOONLIT_SIGN_STYLES = `
  @keyframes coupleStampIn {
    0% { opacity: 0; transform: scale(1.9) rotate(-12deg); }
    60% { opacity: 1; }
    100% { opacity: 1; transform: scale(1) rotate(0); }
  }
  @keyframes coupleFadeUp {
    0% { opacity: 0; transform: translateY(6px); }
    100% { opacity: 1; transform: none; }
  }
  .couple-moon-stage {
    position: relative;
    height: 176px;
    margin-top: 9px;
    overflow: hidden;
    border-radius: 16px;
    isolation: isolate;
    background: linear-gradient(180deg, #a898d2 0%, #93a9c8 56%, #7d98b8 56%, #45627f 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.42), inset 0 -18px 34px rgba(20,46,74,.22);
  }
  .couple-moon-stage canvas { display: block; width: 100%; height: 100%; }
  .couple-moon-slip {
    position: absolute;
    z-index: 2;
    left: 50%;
    top: 10px;
    opacity: 0;
    transform: translateX(-50%);
    filter: drop-shadow(0 10px 18px rgba(20,30,60,.38));
  }
  .couple-moon-slip svg { display: block; }
  .couple-moon-stamp { transform-box: fill-box; transform-origin: center; opacity: 0; }
  .couple-moon-status {
    position: absolute;
    z-index: 3;
    left: 0;
    right: 0;
    bottom: 8px;
    padding: 0 10px;
    color: rgba(255,255,255,.92);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .06em;
    text-align: center;
    text-shadow: 0 1px 5px rgba(28,48,72,.5);
    transition: opacity 250ms ease;
  }
  .couple-sign-result {
    position: relative;
    overflow: hidden;
  }
  .couple-sign-result.is-revealing .couple-sign-level { animation: coupleStampIn 500ms cubic-bezier(.2,1.4,.4,1) both; }
  .couple-sign-result.is-revealing .couple-sign-tip { animation: coupleFadeUp 400ms 250ms both; }
  .couple-sign-result.is-revealing .couple-sign-text { animation: coupleFadeUp 500ms 400ms both; }
  .couple-sign-result.is-revealing .couple-sign-share { animation: coupleFadeUp 400ms 650ms both; }
  .couple-sign-moon-seal {
    position: absolute;
    right: 2px;
    top: 7px;
    width: 21px;
    height: 21px;
    border-radius: 50%;
    background: #f5dfad;
    box-shadow: 0 0 12px rgba(222,174,91,.28);
  }
  .couple-sign-moon-seal::after {
    content: "";
    position: absolute;
    width: 19px;
    height: 19px;
    left: -5px;
    top: -3px;
    border-radius: 50%;
    background: rgba(255,255,255,.94);
  }
  .couple-sign-draw-btn {
    transition: transform 140ms cubic-bezier(.23,1,.32,1), box-shadow 180ms ease, filter 180ms ease;
  }
  .couple-sign-draw-btn:active:not(:disabled) {
    transform: scale(.96);
    box-shadow: 0 2px 8px rgba(220,150,60,.24) !important;
    filter: brightness(.98);
  }
  @keyframes coupleGoldSpin { to { transform: rotate(360deg); } }
  .couple-gold-frame { position: relative; flex: 0 0 auto; display: grid; place-items: center; }
  .couple-gold-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(from 0deg, #f6dc8c, #d9a441, #fff4cf, #c98f2e, #f6dc8c);
    animation: coupleGoldSpin 7s linear infinite;
  }
  .couple-gold-orbit {
    position: absolute;
    z-index: 2;
    inset: -7px;
    border-radius: 50%;
    pointer-events: none;
    animation: coupleGoldSpin 4.5s linear infinite;
  }
  .couple-gold-frame.reverse .couple-gold-orbit { animation-direction: reverse; }
  .couple-gold-orbit i {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-style: normal;
    font-size: 9px;
    line-height: 1;
    color: var(--couple-star, #f2c14e);
    text-shadow: 0 0 6px rgba(255,220,120,.9);
  }
  .couple-gold-orbit i:first-child { top: -2px; }
  .couple-gold-orbit i:last-child { bottom: -2px; font-size: 7px; }
  @media (prefers-reduced-motion: reduce) {
    .couple-sign-result.is-revealing * { animation: none !important; }
    .couple-gold-ring, .couple-gold-orbit { animation: none; }
  }
`;

// golden：溫度 100° 解鎖的情侶頭像框（流光金框＋兩顆繞圈的小星星；reverse 讓兩個頭像方向相反）。
function Avatar({ src, fallback, size = 52, ring = "#f191ae", golden = false, reverse = false }) {
  const face = (
    <span style={{ position: "relative", zIndex: 1, width: size, height: size, borderRadius: "50%", overflow: "hidden", flex: "0 0 auto", display: "grid", placeItems: "center", background: "rgba(255,255,255,.85)", border: golden ? "2px solid #fff" : `2.5px solid ${ring}`, boxShadow: "0 4px 14px rgba(190,90,120,.25)", fontSize: size * .42, fontWeight: 800, color: "#b05e75" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (fallback || "♥")}
    </span>
  );
  if (!golden) return face;
  return (
    <span className={`couple-gold-frame${reverse ? " reverse" : ""}`} style={{ width: size + 6, height: size + 6 }}>
      <span className="couple-gold-ring" aria-hidden="true" />
      <span className="couple-gold-orbit" aria-hidden="true"><i>✦</i><i>✦</i></span>
      {face}
    </span>
  );
}

// 解鎖頭像框後中間的愛心：粉紅愛心＋金色描邊（不加心跳動畫）。
function GoldenHeart() {
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <linearGradient id="coupleHeartPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff9cbc" /><stop offset="1" stopColor="#ec5f8a" /></linearGradient>
        <linearGradient id="coupleHeartGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1c4" /><stop offset=".5" stopColor="#e2b04a" /><stop offset="1" stopColor="#b9842a" /></linearGradient>
      </defs>
      <path d="M12 20.2C5.6 15.6 2 12.1 2 7.6 2 4.7 4.2 2.5 7 2.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 2.8 0 5 2.2 5 5.1 0 4.5-3.6 8-10 12.6z" fill="url(#coupleHeartPink)" stroke="url(#coupleHeartGold)" strokeWidth="2" />
      <path d="M6.5 6.2c.6-1 1.6-1.5 2.6-1.4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity=".8" />
    </svg>
  );
}

const SectionCard = ({ children, style }) => <div style={{ ...GLASS, borderRadius: 18, padding: "13px 15px", marginTop: 10, boxShadow: "0 6px 18px rgba(200,110,140,.13)", ...style }}>{children}</div>;

function FullHeartBackdrop() {
  return <div className="couple-full-heart-bg" aria-hidden="true">
    <style>{`@keyframes coupleHeartFloat{0%{transform:translateY(18px) scale(.8);opacity:0}20%{opacity:.42}80%{opacity:.28}100%{transform:translateY(-120px) scale(1.15);opacity:0}}@keyframes coupleGlow{0%,100%{opacity:.32;transform:scale(.96)}50%{opacity:.58;transform:scale(1.04)}}.couple-full-heart-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;background:radial-gradient(circle at 50% 20%,rgba(255,255,255,.38),transparent 45%)}.couple-full-heart-bg:before{content:"";position:absolute;width:220px;height:220px;left:50%;top:8%;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,178,205,.34),transparent 68%);animation:coupleGlow 5s ease-in-out infinite}.couple-full-heart-bg span{position:absolute;bottom:-24px;color:rgba(255,255,255,.82);text-shadow:0 2px 8px rgba(213,93,137,.28);animation:coupleHeartFloat 8s linear infinite}.couple-full-heart-bg span:nth-child(1){left:8%;animation-delay:-1s}.couple-full-heart-bg span:nth-child(2){left:22%;animation-delay:-5s}.couple-full-heart-bg span:nth-child(3){left:39%;animation-delay:-3s}.couple-full-heart-bg span:nth-child(4){left:58%;animation-delay:-7s}.couple-full-heart-bg span:nth-child(5){left:75%;animation-delay:-2s}.couple-full-heart-bg span:nth-child(6){left:90%;animation-delay:-6s}@media(prefers-reduced-motion:reduce){.couple-full-heart-bg:before,.couple-full-heart-bg span{animation:none}.couple-full-heart-bg span{opacity:.18}}`}</style>
    {["♡", "✦", "♡", "·", "♡", "✦"].map((mark, index) => <span key={index} style={{ fontSize: index % 2 ? 12 : 18 }}>{mark}</span>)}
  </div>;
}

// 情侶空間：每日戀愛簽・關係溫度計・今日小任務＋特別記憶紀念卡牆。
export default function CoupleApp({ closeApp, characters = [], chatHistory = {}, setChatHistory, playerProfile, apiConfig, tr }) {
  const { specialMemories, changeCrystals } = useGacha();
  const [partnerId, setPartnerId] = useState(null);
  const [choosing, setChoosing] = useState(false); // 只有第一次或主動換人時才顯示選擇頁
  const [view, setView] = useState("home"); // home | cards（特別記憶卡牆）
  const [tab, setTab] = useState("today"); // today | promises | memories
  const [promiseForm, setPromiseForm] = useState(null); // { text, date }
  const [donePage, setDonePage] = useState(0);
  const [anniversaryForm, setAnniversaryForm] = useState(null); // { title, date, yearly }
  const [timelineMonths, setTimelineMonths] = useState(TIMELINE_MONTH_STEP);
  const [nicknameDraft, setNicknameDraft] = useState(null);
  const [rarityFilter, setRarityFilter] = useState("ALL");
  const [viewingMemory, setViewingMemory] = useState(null);
  const [dailyStore, setDailyStore] = useState(null); // null = 尚未載入
  const [dailyLoading, setDailyLoading] = useState(false);
  const [judging, setJudging] = useState(false);
  const [notice, setNotice] = useState("");
  const [judgeFailed, setJudgeFailed] = useState(false);
  const generatingRef = useRef(null); // 正在生成今日互動的角色 id
  const [generationTick, setGenerationTick] = useState(0);
  const dailyStoreRef = useRef(null);
  const writeQueueRef = useRef(Promise.resolve());
  const playerName = String(playerProfile?.name || "").trim() || tr("你", "You", "あなた", "나");
  const playerAvatar = sanitizeUserImageUrl(playerProfile?.avatar);
  const uiLocale = typeof document !== "undefined" ? (document.documentElement.lang || "zh-TW") : "zh-TW";

  // 這裡選的是情侶空間的主要互動對象，不代表角色關係已經變成情侶。
  useEffect(() => {
    loadFeatureEntity(DAILY_KEY, null).then((saved) => {
      let store = saved && typeof saved === "object" ? saved : {};
      // 舊版只有單一 _partnerId；既有進度視為已開通空間並保留。
      if (!store._spaces && store._partnerId) {
        const legacyId = store._partnerId;
        store = {
          ...store,
          _activeSpaceId: legacyId,
          _spaces: { [legacyId]: { status: "accepted", acceptedAt: store[legacyId]?.createdAt || Date.now(), migrated: true } },
        };
        saveFeatureEntity(DAILY_KEY, store).catch(() => {});
      }
      setDailyStore(store);
      const savedPartner = store._activeSpaceId;
      if (savedPartner && store._spaces?.[savedPartner]?.status === "accepted" && characters.some((c) => String(c.id) === String(savedPartner))) setPartnerId(savedPartner);
      else setChoosing(true);
    }).catch(() => { setDailyStore({}); setChoosing(true); });
  }, []);
  dailyStoreRef.current = dailyStore;
  // 聊天室回覆也會寫同一份資料（邀請答覆、小互動結束）。每次存檔前先重讀最新版本，
  // 只改這次要改的欄位，並排隊依序寫入，避免用畫面上的舊資料把別人剛寫的蓋掉。
  const updateStore = (mutate) => {
    const run = writeQueueRef.current.then(async () => {
      const latest = await loadFeatureEntity(DAILY_KEY, null).catch(() => null);
      const base = latest && typeof latest === "object" ? latest : (dailyStoreRef.current || {});
      const next = mutate(base);
      if (!next || next === base) { setDailyStore(base); return base; }
      setDailyStore(next);
      await saveFeatureEntity(DAILY_KEY, next).catch(() => {});
      return next;
    });
    writeQueueRef.current = run.catch(() => {});
    return run;
  };
  const updateSpace = (store, charId, patch) => ({
    ...store,
    _spaces: { ...(store._spaces || {}), [charId]: patch(store._spaces?.[charId] || {}) },
  });
  const openSpace = (charId) => {
    setPartnerId(charId);
    setChoosing(false);
    setView("home");
    setTab("today");
    setDonePage(0);
    setTimelineMonths(TIMELINE_MONTH_STEP);
    setPromiseForm(null);
    setAnniversaryForm(null);
    setRarityFilter("ALL");
    setNotice("");
    setJudgeFailed(false);
    updateStore((store) => ({ ...store, _activeSpaceId: charId }));
  };

  const inviteCharacter = (charId) => {
    if (!dailyStore || typeof setChatHistory !== "function") return;
    const existingPending = Object.entries(dailyStore._spaces || {}).find(([, value]) => value?.status === "pending");
    if (existingPending && String(existingPending[0]) !== String(charId)) {
      setNotice(tr("目前已有一份邀請等待回覆，請先完成或撤回。", "An invitation is already awaiting a response. Complete or withdraw it first.", "すでに返事待ちの招待があります。先に完了または取り消してください。", "이미 답변을 기다리는 초대가 있습니다. 먼저 완료하거나 철회하세요."));
      return;
    }
    const previous = dailyStore._spaces?.[charId];
    if (previous?.canInviteAgainAt && Date.now() < previous.canInviteAgainAt) {
      { const days = Math.ceil((previous.canInviteAgainAt - Date.now()) / 86400000); setNotice(tr(`還要等 ${days} 天才能再次邀請。`, `You can invite again in ${days} days.`, `再び招待できるまであと${days}日です。`, `${days}일 후에 다시 초대할 수 있습니다.`)); }
      return;
    }
    const now = Date.now();
    const content = tr(
      `💞 情侶空間邀請\n${playerName} 邀請你一起開啟「情侶空間」。\n這是一個只屬於你們兩人的共享空間，可以一起抽每日戀愛籤、完成小任務並收藏共同回憶。\n是否接受由你決定；這份邀請不代表你必須立刻改變目前的關係。`,
      `💞 Couple Space invitation\n${playerName} invited you to open a Couple Space together.\nThis is a shared space just for the two of you, where you can draw daily love fortunes, complete small activities, and collect memories.\nIt is your choice whether to accept; this invitation does not require you to change your current relationship immediately.`,
      `💞 カップルスペースへの招待\n${playerName}が「カップルスペース」を一緒に開くよう招待しました。\n二人だけの共有スペースで、毎日の恋みくじ、小さな交流、思い出のコレクションを楽しめます。\n受けるかどうかはあなた次第です。この招待で今の関係をすぐ変える必要はありません。`,
      `💞 커플 공간 초대\n${playerName}님이 함께 ‘커플 공간’을 열자고 초대했습니다.\n두 사람만의 공유 공간에서 매일 연애 운세를 뽑고, 작은 활동을 완료하며 추억을 모을 수 있습니다.\n수락 여부는 자유이며, 이 초대가 현재 관계를 바로 바꿔야 한다는 뜻은 아닙니다.`
    );
    setChatHistory((history) => ({ ...history, [charId]: [...(history[charId] || []), { id: `couple_invite_${now}`, role: "system_notice", content, time: now }] }));
    updateStore((store) => updateSpace(store, charId, () => ({ status: "pending", invitedAt: now, pendingRound: 0 })));
    setNotice(tr("邀請已送到聊天室，角色會在三次回覆內做出決定。", "The invitation was sent to chat. The character will decide within three replies.", "招待をチャットに送りました。キャラは3回以内の返信で決めます。", "초대를 채팅방에 보냈습니다. 캐릭터가 3번의 답변 안에 결정합니다."));
  };

  const reviewExpiredInvite = (charId) => {
    if (!dailyStore || typeof setChatHistory !== "function") return;
    const space = dailyStore._spaces?.[charId];
    if (space?.status !== "expired") return;
    const result = reviewCoupleInviteReplies(chatHistory[charId], space.invitedAt, 3);
    if (!result.found) {
      setNotice(tr("找不到原本的邀請訊息，無法重新確認答覆。", "The original invitation could not be found, so the response cannot be reviewed.", "元の招待メッセージが見つからず、返事を再確認できません。", "원래 초대 메시지를 찾지 못해 답변을 다시 확인할 수 없습니다."));
      return;
    }
    if (!result.decision) {
      setNotice(tr("前三輪回覆中沒有找到明確的同意或拒絕。", "No clear acceptance or rejection was found in the first three replies.", "最初の3回の返信に明確な承諾または拒否がありませんでした。", "첫 3번의 답변에서 명확한 수락 또는 거절을 찾지 못했습니다."));
      return;
    }
    if (result.decision === "declined") {
      const now = Date.now();
      updateStore((store) => updateSpace(store, charId, (latest) => ({
        ...space,
        ...latest,
        status: "declined",
        declinedAt: now,
        canInviteAgainAt: Math.max(Number(space.invitedAt) + 3 * 86400000, now),
      })));
      setNotice(tr(`重新確認第 ${result.matchedRound} 輪回覆後，判定角色婉拒了邀請。`, `After reviewing reply ${result.matchedRound}, the character was determined to have declined the invitation.`, `${result.matchedRound}回目の返信を再確認し、キャラが招待を断ったと判断しました。`, `${result.matchedRound}번째 답변을 다시 확인한 결과 캐릭터가 초대를 거절한 것으로 판단했습니다.`));
      return;
    }

    const preview = result.matchedText.length > 180
      ? `${result.matchedText.slice(0, 180)}…`
      : result.matchedText;
    if (!window.confirm(tr(`偵測到角色可能已同意：\n\n「${preview}」\n\n是否開通情侶空間？`, `The character may have agreed:\n\n“${preview}”\n\nOpen the Couple Space?`, `キャラが同意した可能性があります：\n\n「${preview}」\n\nカップルスペースを開きますか？`, `캐릭터가 동의한 것으로 보입니다:\n\n“${preview}”\n\n커플 공간을 열까요?`))) return;
    const now = Date.now();
    updateStore((store) => {
      const { canInviteAgainAt: _cooldown, expiredAt: _expiredAt, ...rest } = { ...space, ...(store._spaces?.[charId] || {}) };
      return { ...updateSpace(store, charId, () => ({ ...rest, status: "accepted", acceptedAt: now, reviewedAt: now })), _activeSpaceId: charId };
    });
    setChatHistory((history) => ({
      ...history,
      [charId]: [
        ...(history[charId] || []),
        { id: `couple_invite_review_${now}`, role: "system_notice", content: tr("💞 已重新確認角色答覆，專屬情侶空間已開通。", "💞 The character's response was reviewed and your Couple Space is now open.", "💞 キャラの返事を再確認し、専用カップルスペースを開きました。", "💞 캐릭터의 답변을 다시 확인하여 전용 커플 공간을 열었습니다."), time: now },
      ],
    }));
    setNotice(tr("已重新確認答覆，情侶空間已開通。", "Response reviewed. The Couple Space is now open.", "返事を再確認し、カップルスペースを開きました。", "답변을 다시 확인하여 커플 공간을 열었습니다."));
  };

  const partners = useMemo(() => characters.map((character) => {
    const memories = specialMemories.filter((m) => String(m.characterId) === String(character.id));
    const messages = chatHistory[character.id] || [];
    return { character, memoryCount: memories.length, messageCount: messages.length };
  }).sort((a, b) => b.memoryCount - a.memoryCount || b.messageCount - a.messageCount), [characters, specialMemories, chatHistory]);
  const acceptedPartners = partners.filter(({ character: c }) => dailyStore?._spaces?.[c.id]?.status === "accepted");
  const unopenedPartners = partners
    .filter(({ character: c }) => dailyStore?._spaces?.[c.id]?.status !== "accepted")
    .sort((a, b) => {
      const rank = ({ character: c }) => {
        const itemSpace = dailyStore?._spaces?.[c.id];
        if (itemSpace?.status === "pending") return 0;
        if (itemSpace?.canInviteAgainAt && Date.now() < itemSpace.canInviteAgainAt) return 1;
        return 2;
      };
      return rank(a) - rank(b);
    });
  const renderPartnerRow = ({ character: c, memoryCount, messageCount }) => {
    const itemSpace = dailyStore?._spaces?.[c.id];
    const status = itemSpace?.status || "available";
    const cooling = itemSpace?.canInviteAgainAt && Date.now() < itemSpace.canInviteAgainAt;
    const canReview = status === "expired" && cooling;
    const coolingDays = cooling ? Math.ceil((itemSpace.canInviteAgainAt - Date.now()) / 86400000) : 0;
    const actionLabel = status === "accepted"
      ? tr("進入", "Open", "入る", "입장")
      : status === "pending"
        ? tr(`等待回覆 ${itemSpace.pendingRound || 0}/3`, `Waiting ${itemSpace.pendingRound || 0}/3`, `返事待ち ${itemSpace.pendingRound || 0}/3`, `답변 대기 ${itemSpace.pendingRound || 0}/3`)
        : canReview
          ? tr("重新確認答覆", "Review response", "返事を再確認", "답변 다시 확인")
          : cooling
            ? tr(`${coolingDays} 天後可邀請`, `Invite in ${coolingDays} days`, `${coolingDays}日後に招待可能`, `${coolingDays}일 후 초대 가능`)
            : tr("送出邀請", "Send invitation", "招待を送る", "초대 보내기");
    return <button key={c.id} type="button" disabled={status === "pending" || (cooling && !canReview)} onClick={() => status === "accepted" ? openSpace(c.id) : canReview ? reviewExpiredInvite(c.id) : inviteCharacter(c.id)}
      style={{ ...GLASS, width: "100%", display: "flex", alignItems: "center", gap: 12, borderRadius: 18, padding: "12px 14px", marginBottom: 10, textAlign: "left", boxShadow: "0 6px 18px rgba(200,110,140,.14)" }}>
      <Avatar src={sanitizeUserImageUrl(c.avatar)} fallback={c.name?.[0]} size={48} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <b style={{ fontSize: 14, fontWeight: 900, color: "#7a4257" }}>{c.name}</b>
          {status === "accepted" && <span style={{ fontSize: 8.5, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#f06292,#d16a8d)", borderRadius: 99, padding: "2px 7px" }}>💗 {tr("已開通", "Open", "開通済み", "개설됨")}</span>}
        </span>
        <span style={{ display: "block", fontSize: 10.5, color: "#a86e84", marginTop: 3 }}>{memoryCount ? tr(`✦ ${memoryCount} 段特別記憶`, `✦ ${memoryCount} special memories`, `✦ 特別な思い出 ${memoryCount}件`, `✦ 특별한 추억 ${memoryCount}개`) : tr("還沒有特別記憶", "No special memories yet", "特別な思い出はまだありません", "아직 특별한 추억이 없습니다")} · {tr(`${messageCount} 則訊息`, `${messageCount} messages`, `メッセージ ${messageCount}件`, `메시지 ${messageCount}개`)}</span>
      </span>
      <span style={{ color: status === "accepted" ? "#cf8fa5" : "#a86e84", fontSize: 10, fontWeight: 800 }}>{actionLabel}</span>
    </button>;
  };

  const partner = partners.find((item) => String(item.character.id) === String(partnerId));
  const character = partner?.character;
  const space = character && dailyStore ? dailyStore._spaces?.[character.id] : null;
  const daily = character && dailyStore ? dailyStore[character.id] : null;
  const today = coupleDayKey();
  const firstChatAt = character ? (chatHistory[character.id] || []).find((message) => message?.time)?.time || null : null;
  const anniversaryLabels = {
    firstChat: () => tr("第一次聊天", "First chat", "初めての会話", "첫 대화"),
    spaceOpen: () => tr("開通情侶空間", "Couple Space opened", "カップルスペース開通", "커플 공간 개설"),
    day: (count) => tr(`在一起第 ${count} 天`, `Day ${count} together`, `一緒に ${count} 日目`, `함께한 지 ${count}일`),
    chatYears: (count) => tr(`認識 ${count} 週年`, `${count}-year anniversary`, `出会って ${count} 周年`, `만난 지 ${count}주년`),
    spaceYears: (count) => tr(`情侶空間 ${count} 週年`, `Couple Space ${count}-year anniversary`, `カップルスペース ${count} 周年`, `커플 공간 ${count}주년`),
  };
  const anniversaries = character && dailyStore
    ? buildCoupleAnniversaries({ firstChatAt, acceptedAt: space?.acceptedAt, custom: getCoupleAnniversaries(dailyStore, character.id), labels: anniversaryLabels })
    : null;
  const todayOccasion = anniversaries?.today.map((item) => item.title).join("、") || "";

  const shareToChat = (kind) => {
    if (!character || !daily || typeof setChatHistory !== "function") return;
    const isTask = kind === "task";
    if (isTask && !daily.task?.text) return;
    if (!isTask && !daily.sign?.text) return;
    const now = Date.now();
    const content = isTask
      ? tr(`💞 ${character.name}給你的今日小互動\n「${daily.task.text}」`, `💞 Today's little activity from ${character.name}\n“${daily.task.text}”`, `💞 ${character.name}から今日の小さな交流\n「${daily.task.text}」`, `💞 ${character.name}의 오늘의 작은 활동\n“${daily.task.text}”`)
      : tr(`💞 今日戀愛籤\n${daily.sign.level}・${daily.sign.tip}\n「${daily.sign.text}」`, `💞 Today's love fortune\n${daily.sign.level} · ${daily.sign.tip}\n“${daily.sign.text}”`, `💞 今日の恋みくじ\n${daily.sign.level}・${daily.sign.tip}\n「${daily.sign.text}」`, `💞 오늘의 연애 운세\n${daily.sign.level} · ${daily.sign.tip}\n“${daily.sign.text}”`);
    setChatHistory((history) => ({
      ...history,
      [character.id]: [...(history[character.id] || []), { id: `couple_${kind}_${now}`, role: "system_notice", content, time: now }],
    }));
    const charId = character.id;
    updateStore((store) => {
      const latest = store[charId] || daily;
      return {
        ...store,
        [charId]: isTask
          ? { ...latest, taskSharedAt: now, taskChatState: "active", taskChatEndedAt: null }
          : { ...latest, signSharedAt: now },
      };
    });
    setNotice(isTask
      ? tr("已分享到聊天室；互動結束後會停止提供背景資訊。", "Shared to chat. Background context will stop after the activity ends.", "チャットに共有しました。交流終了後は背景情報の提供を停止します。", "채팅방에 공유했습니다. 활동이 끝나면 배경 정보 제공이 중지됩니다.")
      : tr("戀愛籤已分享到聊天室，後續只依聊天紀錄承接。", "The love fortune was shared to chat. Future replies will continue from chat history only.", "恋みくじをチャットに共有しました。以後はチャット履歴からのみ引き継ぎます。", "연애 운세를 채팅방에 공유했습니다. 이후에는 채팅 기록만 이어집니다."));
  };

  // 每天第一次進入：結算溫度＋生成今日戀愛簽與任務
  useEffect(() => {
    if (!character || space?.status !== "accepted" || dailyStore === null || generatingRef.current) return;
    const current = dailyStore[character.id];
    // 當天任務已存在就不重生成；戀愛簽改由玩家按鈕抽，這裡不生成
    if (current?.day === today && current?.task?.text) return;
    const charId = character.id;
    generatingRef.current = charId;
    setDailyLoading(true);
    const messages = chatHistory[charId] || [];
    const lastMessageAt = messages[messages.length - 1]?.time || null;
    const lastMemoryAt = specialMemories.filter((m) => String(m.characterId) === String(charId))[0]?.createdAt || null;
    const taskGenerationCharacter = {
      ...character,
      description: [
        "【今日小互動語氣】這不是制式任務或命令，而是角色想和玩家親近的私人邀請。請依角色個性自然地使用甜蜜、溫柔、撒嬌或調皮的口吻，讓玩家感到被期待；互動要輕鬆、具體，能在聊天室完成。避免『請完成』『必須』『任務』等系統式措辭。",
        character.description || character.personality || character.prompt || character.persona || "",
      ].filter(Boolean).join("\n"),
    };
    generateDailyTask({ character: taskGenerationCharacter, playerProfile, recentMessages: messages.slice(-12), apiConfig, locale: uiLocale, occasion: todayOccasion }).then((task) => updateStore((store) => {
      const latest = store[charId];
      if (latest?.day === today && latest?.task?.text) return store;
      // 同一天只補上任務，其他欄位（已抽的籤、分享狀態）原樣保留。
      if (latest?.day === today) return { ...store, [charId]: { ...latest, task } };
      const settled = settleTemperature({ previous: latest?.temperature, lastMessageAt, lastTaskDoneDay: latest?.lastDoneDay, lastMemoryAt, maxTemperatureReached: !!latest?.maxTemperatureReached });
      return {
        // 解鎖看「曾經到過的最高溫度」，降溫不會收回。
        ...withCouplePeakTemperature(store, charId, Math.max(settled.temperature, latest?.temperature || 0)),
        [charId]: {
          day: today,
          sign: null,
          signAt: null,
          task,
          taskDone: false,
          taskComment: "",
          streak: latest?.streak || 0,
          lastDoneDay: latest?.lastDoneDay || null,
          temperature: settled.temperature,
          tempDelta: settled.delta,
          maxTemperatureReached: latest?.maxTemperatureReached || settled.maxTemperatureReached,
          firstMaxedAt: latest?.firstMaxedAt || (settled.temperature >= 100 ? Date.now() : null),
          milestones: {
            ...(latest?.milestones || {}),
            ...(settled.temperature >= 100 && !latest?.milestones?.fullHeart ? { fullHeart: { unlocked: true, unlockedAt: Date.now() } } : {}),
          },
        },
      };
    })).finally(() => {
      generatingRef.current = null;
      setDailyLoading(false);
      // 生成期間換了對象：再跑一次，讓新對象也能生成今日互動，不會一直停在載入中。
      setGenerationTick((tick) => tick + 1);
    });
  }, [character?.id, dailyStore === null ? "loading" : "ready", today, generationTick]);

  const [drawingSign, setDrawingSign] = useState(false);
  const [drawnSign, setDrawnSign] = useState(null); // 籤已抽好、等動畫揭曉
  const [signReveal, setSignReveal] = useState(false);
  useEffect(() => { setSignReveal(false); setDrawingSign(false); setDrawnSign(null); }, [character?.id, today]);
  const finishSignReveal = () => { setDrawingSign(false); setDrawnSign(null); setSignReveal(true); };
  // 籤一回來就先存檔（中途離開也不會遺失），動畫播完才換成結果。
  const drawSign = async () => {
    if (!character || !daily || daily.sign?.text || drawingSign) return;
    setSignReveal(false);
    setDrawnSign(null);
    setDrawingSign(true);
    try {
      const charId = character.id;
      const sign = await generateLoveSign({ character, playerProfile, recentMessages: (chatHistory[charId] || []).slice(-12), apiConfig, locale: uiLocale, occasion: todayOccasion });
      const saved = await updateStore((store) => {
        const latest = store[charId] || daily;
        if (latest.sign?.text) return store;
        return { ...store, [charId]: { ...latest, sign, signAt: Date.now() } };
      });
      setDrawnSign(saved?.[charId]?.sign || sign);
    } catch {
      setDrawingSign(false);
    }
  };

  const checkTask = async () => {
    if (!character || !daily || daily.taskDone || judging) return;
    setJudging(true);
    setNotice("");
    setJudgeFailed(false);
    const charId = character.id;
    try {
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const todayMessages = (chatHistory[character.id] || []).filter((m) => (m.time || 0) >= dayStart.getTime());
      const verdict = await judgeCoupleTask({ task: daily.task?.text, character, playerProfile, todayMessages, apiConfig, locale: uiLocale });
      if (verdict.done) {
        const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - 86400000));
        let streak = 0;
        let alreadyDone = false;
        await updateStore((store) => {
          const latest = store[charId] || daily;
          if (latest.taskDone) { alreadyDone = true; return store; }
          streak = latest.lastDoneDay === yesterday ? (latest.streak || 0) + 1 : 1;
          return { ...store, [charId]: { ...latest, taskDone: true, taskComment: verdict.comment, streak, lastDoneDay: today, taskChatState: "completed", taskChatEndedAt: Date.now() } };
        });
        if (alreadyDone) return; // 已經結算過，不重複發結晶
        const bonus = streak > 0 && streak % 7 === 0 ? STREAK_BONUS : 0;
        changeCrystals(TASK_REWARD + bonus, {
          source: "couple",
          note: bonus
            ? tr(`完成情侶空間互動・連續 ${streak} 天加碼`, `Couple Space activity · ${streak}-day streak bonus`, `カップルスペース交流・${streak}日連続ボーナス`, `커플 공간 활동 · ${streak}일 연속 보너스`)
            : tr("完成情侶空間互動", "Completed Couple Space activity", "カップルスペース交流を達成", "커플 공간 활동 완료"),
        });
        setNotice(tr(
          `💎 獲得 ${TASK_REWARD} 靈魂結晶${bonus ? `，連續 ${streak} 天加碼 +${bonus}！` : `（連續 ${streak} 天）`}`,
          `💎 Earned ${TASK_REWARD} Soul Crystals${bonus ? `, plus ${bonus} for a ${streak}-day streak!` : ` (${streak}-day streak)`}`,
          `💎 ソウルクリスタルを${TASK_REWARD}個獲得${bonus ? `、${streak}日連続ボーナス +${bonus}！` : `（${streak}日連続）`}`,
          `💎 영혼 크리스털 ${TASK_REWARD}개 획득${bonus ? `, ${streak}일 연속 보너스 +${bonus}!` : `(${streak}일 연속)`}`
        ));
      } else {
        await updateStore((store) => ({ ...store, [charId]: { ...(store[charId] || daily), taskComment: verdict.comment } }));
        setNotice("");
      }
    } catch (reason) {
      setJudgeFailed(true);
      setNotice(reason?.message || tr("驗收失敗，請稍後再試。", "Could not verify the activity. Please try again later.", "確認できませんでした。しばらくしてからもう一度お試しください。", "확인에 실패했습니다. 잠시 후 다시 시도하세요."));
    } finally { setJudging(false); }
  };

  // ---- 資料載入中 ----
  if (dailyStore === null) {
    return (
      <div className="mp-page couple-app-page" data-mp-surface="light" style={{ background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
        <AppHeader title={`💞 ${tr("情侶空間", "Couple Space", "カップルスペース", "커플 공간")}`} onBack={closeApp} backLabel={tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")} style={{ background: "transparent" }} />
        <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#a86e84", fontSize: 12 }}>💗</div>
      </div>
    );
  }

  // ---- 永久空間列表／邀請角色 ----
  if (choosing || !partner) {
    return (
      <div className="mp-page couple-app-page" data-mp-surface="light" style={{ background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
        <AppHeader title={`💞 ${tr("情侶空間", "Couple Space", "カップルスペース", "커플 공간")}`} onBack={() => (partner ? setChoosing(false) : closeApp())} backLabel={tr("返回", "Back", "戻る", "뒤로")} style={{ background: "transparent" }} />
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 26px" }}>
          <div style={{ textAlign: "center", padding: "10px 0 16px" }}>
            <div style={{ fontSize: 26 }}>💌</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#7a4257", marginTop: 6, fontFamily: HAND_FONT }}>{tr("選擇一個雙人空間", "Choose a shared space", "二人のスペースを選択", "두 사람의 공간 선택")}</div>
            <div style={{ fontSize: 10.5, color: "#a86e84", marginTop: 4, lineHeight: 1.7 }}>{tr("已開通的空間會永久保留；尚未開通的角色可以先送出邀請。", "Opened spaces are kept permanently. You can invite characters whose spaces are not open yet.", "開通したスペースは永久に残ります。未開通のキャラには招待を送れます。", "개설된 공간은 계속 유지됩니다. 아직 열리지 않은 캐릭터에게 초대를 보낼 수 있습니다.")}</div>
          </div>
          {partners.length === 0 && <div className="mp-empty"><div className="mp-empty-icon" aria-hidden="true"><Icon name="heart" size={34} /></div><div className="mp-empty-t">{tr("還沒有角色", "No characters yet", "キャラがまだいません", "아직 캐릭터가 없습니다")}<br />{tr("先去建立一位吧", "Create one first", "先に作成しましょう", "먼저 캐릭터를 만들어 보세요")}</div></div>}
          {acceptedPartners.length > 0 && <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 4px 9px", color: "#9b566e", fontSize: 11, fontWeight: 900 }}>
              <span>💗 {tr("已開通空間", "Opened spaces", "開通済みスペース", "개설된 공간")}</span><span style={{ color: "#c68ba0", fontSize: 9.5 }}>({acceptedPartners.length})</span>
              <span style={{ height: 1, flex: 1, background: "rgba(190,112,140,.22)" }} />
            </div>
            {acceptedPartners.map(renderPartnerRow)}
          </>}
          {unopenedPartners.length > 0 && <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: `${acceptedPartners.length ? 18 : 2}px 4px 9px`, color: "#9b566e", fontSize: 11, fontWeight: 900 }}>
              <span>💌 {tr("未開通空間", "Unopened spaces", "未開通スペース", "열리지 않은 공간")}</span><span style={{ color: "#c68ba0", fontSize: 9.5 }}>({unopenedPartners.length})</span>
              <span style={{ height: 1, flex: 1, background: "rgba(190,112,140,.22)" }} />
            </div>
            {unopenedPartners.map(renderPartnerRow)}
          </>}
          {notice && <div style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#a2652f", marginTop: 10 }}>{notice}</div>}
        </div>
      </div>
    );
  }

  const characterAvatar = sanitizeUserImageUrl(character.avatar);
  const messages = chatHistory[character.id] || [];
  const firstMessageAt = messages[0]?.time || null;
  const daysTogether = firstMessageAt ? countDaysTogether(firstMessageAt) : null;
  const allMemories = specialMemories.filter((m) => String(m.characterId) === String(character.id)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // ---- 回憶牆 ----
  if (view === "cards") {
    const memories = rarityFilter === "ALL" ? allMemories : allMemories.filter((m) => m.itemRarity === rarityFilter);
    const rarityCounts = allMemories.reduce((acc, m) => { acc[m.itemRarity] = (acc[m.itemRarity] || 0) + 1; return acc; }, {});
    return (
      <div className="mp-page couple-app-page" data-mp-surface="light" style={{ background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
        <AppHeader title={`📖 ${tr("我們的回憶", "Our Memories", "二人の思い出", "우리의 추억")}`} onBack={() => { setView("home"); setTab("memories"); }} backLabel={tr("返回", "Back", "戻る", "뒤로")} style={{ background: "transparent" }} />
        <div style={{ flex: 1, overflowY: "auto", padding: "2px 16px 28px" }}>
          {allMemories.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "10px 0 4px" }}>
              {[["ALL", tr(`全部 ${allMemories.length}`, `All ${allMemories.length}`, `すべて ${allMemories.length}`, `전체 ${allMemories.length}`)], ...["SSR", "SR", "R"].filter((r) => rarityCounts[r]).map((r) => [r, `${r} ${rarityCounts[r]}`])].map(([key, label]) => (
                <button key={key} type="button" onClick={() => setRarityFilter(key)}
                  style={key === rarityFilter
                    ? { border: 0, borderRadius: 99, padding: "4px 13px", fontSize: 10, fontWeight: 800, color: "#fff", background: key === "ALL" ? "linear-gradient(135deg,#f06292,#d16a8d)" : RARITY_COLORS[key], boxShadow: "0 3px 10px rgba(190,90,120,.3)" }
                    : { ...GLASS, borderRadius: 99, padding: "4px 13px", fontSize: 10, fontWeight: 700, color: key === "ALL" ? "#a86e84" : RARITY_COLORS[key] }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {allMemories.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#a86e84" }}>
              <div style={{ fontSize: 34 }}>🕊️</div>
              <div style={{ fontSize: 12, fontWeight: 800, marginTop: 10, color: "#7a4257" }}>{tr("還沒有共同的特別記憶", "No shared special memories yet", "共通の特別な思い出はまだありません", "함께한 특별한 추억이 아직 없습니다")}</div>
              <div style={{ fontSize: 10.5, lineHeight: 1.8, marginTop: 6 }}>{tr(
                `到遊戲中心抽一張心意卡送給 ${character.name}，完成特別篇後凝結成記憶，就會收藏在這裡。`,
                `Draw a sentiment card in Game Center and give it to ${character.name}. Complete the special episode and preserve it as a memory to collect it here.`,
                `ゲームセンターで心意カードを引いて${character.name}に贈り、特別編を終えて思い出に凝結すると、ここに保存されます。`,
                `게임 센터에서 마음 카드를 뽑아 ${character.name}에게 선물하고 특별편을 완료해 추억으로 남기면 여기에 보관됩니다.`
              )}</div>
            </div>
          ) : (
            <div style={{ position: "relative", margin: "14px 2px 0", paddingLeft: 18 }}>
              <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, borderRadius: 2, background: "linear-gradient(180deg,#f6b6ca,#e3c6f5)" }} />
              {memories.map((memory) => {
                const color = RARITY_COLORS[memory.itemRarity] || RARITY_COLORS.R;
                return (
                  <div key={memory.id} style={{ position: "relative", marginBottom: 12 }}>
                    <span style={{ position: "absolute", left: -17.5, top: 17, width: 9, height: 9, borderRadius: "50%", background: color, border: "2px solid #fff", boxShadow: `0 0 0 2px ${color}55` }} />
                    <button type="button" onClick={() => setViewingMemory(memory)}
                      style={{ ...GLASS, width: "100%", display: "flex", alignItems: "center", gap: 11, borderRadius: 16, borderLeft: `3px solid ${color}`, padding: "11px 13px", textAlign: "left", boxShadow: "0 5px 16px rgba(200,110,140,.13)" }}>
                      <span style={{ width: 42, height: 42, flex: "0 0 auto", borderRadius: 13, display: "grid", placeItems: "center", fontSize: 21, background: `linear-gradient(145deg,${color}22,${color}0d)`, border: `1px solid ${color}44` }}>{memory.itemIcon || "🌸"}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <b style={{ fontSize: 12.5, color: "#6d3c50", fontFamily: HAND_FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{memory.title}</b>
                          {memory.pinned && <span style={{ flex: "0 0 auto", width: 14, height: 14, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 8, color: "#fff", background: "radial-gradient(circle at 35% 30%,#eed49a,#c99a4b)" }}>✦</span>}
                        </span>
                        <span style={{ display: "block", fontSize: 10, color: "#a86e84", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{memory.summary || memory.text}</span>
                        <span style={{ display: "block", fontSize: 9, color: "#c093a4", marginTop: 3 }}>{formatDate(memory.createdAt, uiLocale)} · {memory.itemName} · <b style={{ color }}>{memory.itemRarity}</b></span>
                      </span>
                      <span style={{ color: "#cf8fa5" }}>›</span>
                    </button>
                  </div>
                );
              })}
              {memories.length === 0 && <div style={{ textAlign: "center", padding: "18px 0", fontSize: 11, color: "#a86e84" }}>{tr("這個稀有度還沒有回憶", "No memories at this rarity yet", "このレアリティの思い出はまだありません", "이 희귀도의 추억은 아직 없습니다")}</div>}
            </div>
          )}
        </div>
        {viewingMemory && <SpecialMemoryModal memory={viewingMemory} characterAvatar={characterAvatar} playerAvatar={playerAvatar} playerName={playerName} tr={tr} locale={uiLocale} onClose={() => setViewingMemory(null)} />}
      </div>
    );
  }

  // ---- 主頁：分頁（今日／約定／回憶）----
  const temperature = daily?.temperature ?? 60;
  const tempDelta = daily?.tempDelta ?? 0;
  const signTime = daily?.signAt ? new Intl.DateTimeFormat(uiLocale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(daily.signAt)) : "";
  const peakTemperature = getCouplePeakTemperature(dailyStore, character.id, temperature);
  const nickname = getCoupleNickname(dailyStore, character.id);
  const goldenMoon = isCoupleUnlocked(peakTemperature, "goldenMoon");
  const avatarFrame = isCoupleUnlocked(peakTemperature, "avatarFrame");
  const unlockLabel = (id) => ({
    goldenMoon: tr("金色月光籤", "Golden moon fortune", "金色の月みくじ", "황금 달빛 운세"),
    nickname: tr("專屬暱稱", "Pet name", "特別な呼び名", "전용 애칭"),
    avatarFrame: tr("情侶頭像框", "Couple avatar frame", "ペアアイコン枠", "커플 프로필 테두리"),
  })[id];
  const { open: openPromises, done: donePromises } = splitCouplePromises(getCouplePromises(dailyStore, character.id));
  const donePageCount = Math.max(1, Math.ceil(donePromises.length / PROMISE_PAGE_SIZE));
  const safeDonePage = Math.min(donePage, donePageCount - 1);
  const timeline = buildCoupleTimeline({ anniversaries, promises: getCouplePromises(dailyStore, character.id), specialMemories: allMemories });
  const customAnniversaries = getCoupleAnniversaries(dailyStore, character.id);
  const monthLabel = (group) => new Intl.DateTimeFormat(uiLocale, { year: "numeric", month: "long" }).format(new Date(group.year, group.month - 1, 1));
  const shortDate = (time) => new Intl.DateTimeFormat(uiLocale, { month: "numeric", day: "numeric" }).format(new Date(time));
  const leftLabel = (days) => (days === 0
    ? tr("今天", "Today", "今日", "오늘")
    : days > 0
      ? tr(`${days} 天後`, `in ${days} days`, `${days}日後`, `${days}일 후`)
      : tr(`已過 ${-days} 天`, `${-days} days ago`, `${-days}日前`, `${-days}일 지남`));
  const sectionLabel = (text, extra) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 4px 2px", color: COUPLE_COLORS.sub, fontSize: 12, fontWeight: 900 }}>
      <span>{text}</span>{extra && <span style={{ fontSize: 11, fontWeight: 700, color: COUPLE_COLORS.faint }}>{extra}</span>}
      <span style={{ height: 1, flex: 1, background: "rgba(190,112,140,.22)" }} />
    </div>
  );
  const ghostButton = { width: "100%", marginTop: 10, border: "1px solid rgba(209,106,141,.25)", borderRadius: 12, padding: "8px 12px", fontSize: 12, fontWeight: 800, color: COUPLE_COLORS.sub, background: "rgba(255,255,255,.75)" };
  const primaryButton = { border: 0, borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 800, color: COUPLE_COLORS.onAccent, background: "linear-gradient(135deg,#e88aaa,#c96f91)" };
  const inputStyle = { minWidth: 0, border: "1px solid rgba(209,106,141,.3)", borderRadius: 10, padding: "7px 9px", fontSize: 12, color: COUPLE_COLORS.ink, background: "rgba(255,255,255,.92)", boxSizing: "border-box" };

  const submitPromise = () => {
    const text = String(promiseForm?.text || "").trim();
    if (!text) return;
    let status = "";
    updateStore((store) => {
      const result = addCouplePromise(store, character.id, { text, date: promiseForm?.date || "", source: "manual" });
      status = result.status;
      return result.store;
    }).then(() => {
      if (status === "added") { setPromiseForm(null); setNotice(""); }
      else if (status === "duplicate") setNotice(tr("清單裡已經有很像的約定了。", "A similar promise is already on the list.", "似た約束がすでにリストにあります。", "비슷한 약속이 이미 목록에 있어요."));
      else if (status === "full") setNotice(tr(`進行中的約定最多 ${COUPLE_OPEN_PROMISE_LIMIT} 個，先完成或刪掉一些吧。`, `You can keep up to ${COUPLE_OPEN_PROMISE_LIMIT} open promises. Complete or remove some first.`, `進行中の約束は最大${COUPLE_OPEN_PROMISE_LIMIT}件です。先に完了か削除をしてください。`, `진행 중인 약속은 최대 ${COUPLE_OPEN_PROMISE_LIMIT}개예요. 먼저 완료하거나 삭제해 주세요.`));
    });
  };
  // 手動打勾一律先確認，避免誤觸。
  const completePromise = (promise) => {
    if (!window.confirm(tr(`確定這個約定已經完成了嗎？\n\n「${promise.text}」`, `Mark this promise as done?\n\n“${promise.text}”`, `この約束を完了にしますか？\n\n「${promise.text}」`, `이 약속을 완료로 표시할까요?\n\n“${promise.text}”`))) return;
    updateStore((store) => completeCouplePromise(store, character.id, promise.id));
    setDonePage(0);
  };
  const reopenPromise = (promise) => {
    if (!window.confirm(tr(`要把「${promise.text}」改回進行中嗎？`, `Move “${promise.text}” back to open?`, `「${promise.text}」を進行中に戻しますか？`, `“${promise.text}”을(를) 진행 중으로 되돌릴까요?`))) return;
    updateStore((store) => reopenCouplePromise(store, character.id, promise.id));
  };
  const deletePromise = (promise) => {
    if (!window.confirm(tr(`確定要刪除「${promise.text}」嗎？`, `Delete “${promise.text}”?`, `「${promise.text}」を削除しますか？`, `“${promise.text}”을(를) 삭제할까요?`))) return;
    updateStore((store) => removeCouplePromise(store, character.id, promise.id));
  };
  const submitAnniversary = () => {
    let status = "";
    updateStore((store) => {
      const result = addCoupleAnniversary(store, character.id, anniversaryForm || {});
      status = result.status;
      return result.store;
    }).then(() => {
      if (status === "added") { setAnniversaryForm(null); setNotice(""); }
      else if (status === "full") setNotice(tr("自訂紀念日最多 20 個。", "You can add up to 20 anniversaries.", "記念日は最大20件です。", "기념일은 최대 20개까지 추가할 수 있어요."));
      else setNotice(tr("請填寫名稱和日期。", "Please enter a name and a date.", "名前と日付を入力してください。", "이름과 날짜를 입력해 주세요."));
    });
  };
  const deleteAnniversary = (item) => {
    if (!window.confirm(tr(`確定要刪除紀念日「${item.title}」嗎？`, `Delete the anniversary “${item.title}”?`, `記念日「${item.title}」を削除しますか？`, `기념일 “${item.title}”을(를) 삭제할까요?`))) return;
    updateStore((store) => removeCoupleAnniversary(store, character.id, item.id));
  };
  const tabs = [
    ["today", tr("今日", "Today", "今日", "오늘")],
    ["promises", tr("約定", "Promises", "約束", "약속")],
    ["memories", tr("回憶", "Memories", "思い出", "추억")],
  ];
  const nextAnniversary = anniversaries?.next;
  const ringColor = avatarFrame ? "#d9a441" : "#f191ae";

  return (
    <div className="mp-page couple-app-page" data-mp-surface="light" style={{ overflow: "hidden", background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
      <style>{MOONLIT_SIGN_STYLES}</style>
      {daily?.milestones?.fullHeart && <FullHeartBackdrop />}
      <AppHeader title={`💞 ${tr("情侶空間", "Couple Space", "カップルスペース", "커플 공간")}`} onBack={closeApp} backLabel={tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")} style={{ position: "relative", zIndex: 1, background: "transparent" }} right={
        <button type="button" title={tr("更換主要互動對象", "Change primary partner", "主な交流相手を変更", "주요 교류 상대 변경")} onClick={() => setChoosing(true)}
          style={{ marginLeft: "auto", border: "1px solid rgba(255,255,255,.85)", borderRadius: 99, background: "rgba(255,255,255,.55)", color: COUPLE_COLORS.sub, fontSize: 11, fontWeight: 800, padding: "5px 10px" }}>⇄ {tr("換人", "Switch", "変更", "변경")}</button>
      } />
      <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "2px 16px 28px" }}>

        {/* 關係頭部：置中 */}
        <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Avatar src={characterAvatar} fallback={character.name?.[0]} ring={ringColor} golden={avatarFrame} />
            <span style={{ position: "relative", margin: "0 -7px", zIndex: 3, fontSize: 20, filter: "drop-shadow(0 2px 4px rgba(200,80,110,.4))" }}>{avatarFrame ? <GoldenHeart /> : "💗"}</span>
            <Avatar src={playerAvatar} fallback={playerName[0]} ring={ringColor} golden={avatarFrame} reverse />
          </div>
          <div style={{ marginTop: 8, fontSize: 15, fontWeight: 900, color: COUPLE_COLORS.ink, fontFamily: HAND_FONT }}>{character.name} ✕ {playerName}</div>
          <div style={{ marginTop: 3, fontSize: 11, color: COUPLE_COLORS.sub }}>{daysTogether
            ? tr(`在一起第 ${daysTogether} 天・溫度 ${temperature}°`, `Day ${daysTogether} together · ${temperature}°`, `一緒に ${daysTogether} 日目・${temperature}°`, `함께한 지 ${daysTogether}일째 · ${temperature}°`)
            : tr("故事還沒開始，先去打聲招呼吧", "Your story has not started yet. Go say hello.", "物語はまだ始まっていません。まずは挨拶してみましょう。", "아직 이야기가 시작되지 않았어요. 먼저 인사해 보세요.")}</div>
        </div>

        {/* 下一個紀念日 */}
        {nextAnniversary && <button type="button" onClick={() => setTab("memories")}
          style={{ ...GLASS, width: "100%", display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 12px", borderRadius: 14, fontSize: 12, color: COUPLE_COLORS.ink, textAlign: "left" }}>
          <span>{nextAnniversary.isToday ? "🎉" : "💗"}</span>
          <span style={{ flex: 1, minWidth: 0 }}>{nextAnniversary.isToday
            ? tr(`今天是「${nextAnniversary.title}」`, `Today is “${nextAnniversary.title}”`, `今日は「${nextAnniversary.title}」`, `오늘은 “${nextAnniversary.title}”`)
            : tr(`距離「${nextAnniversary.title}」還有 ${nextAnniversary.daysLeft} 天`, `${nextAnniversary.daysLeft} days until “${nextAnniversary.title}”`, `「${nextAnniversary.title}」まであと${nextAnniversary.daysLeft}日`, `“${nextAnniversary.title}”까지 ${nextAnniversary.daysLeft}일`)}</span>
          <span style={{ fontSize: 11, color: COUPLE_COLORS.faint }}>{tr("回憶 ›", "Memories ›", "思い出 ›", "추억 ›")}</span>
        </button>}

        {/* 分頁 */}
        <div role="tablist" style={{ position: "sticky", top: 0, zIndex: 2, display: "flex", gap: 2, marginTop: 10, padding: 3, borderRadius: 12, background: "rgba(255,255,255,.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setNotice(""); }}
            style={{ flex: 1, border: 0, borderRadius: 9, padding: "7px 0", fontSize: 12, fontWeight: 800, color: tab === id ? COUPLE_COLORS.ink : COUPLE_COLORS.sub, background: tab === id ? "#fff" : "transparent", boxShadow: tab === id ? "0 2px 6px rgba(200,110,140,.18)" : "none" }}>
            {label}{id === "promises" && openPromises.length > 0 ? ` ${openPromises.length}` : ""}
          </button>)}
        </div>

        {tab === "today" && <>
          {anniversaries?.today.length > 0 && <SectionCard style={{ textAlign: "center", background: "linear-gradient(135deg,#fff3d9,#ffe2ec)" }}>
            <div style={{ fontSize: 22 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: COUPLE_COLORS.ink, fontFamily: HAND_FONT }}>{tr(`今天是「${todayOccasion}」`, `Today is “${todayOccasion}”`, `今日は「${todayOccasion}」`, `오늘은 “${todayOccasion}”`)}</div>
            <div style={{ fontSize: 11, color: COUPLE_COLORS.sub, marginTop: 3 }}>{tr(`今天的籤和小互動，${character.name}會記得這一天`, `Today's fortune and activity will remember this day`, `今日のおみくじと交流は、この日を覚えています`, `오늘의 운세와 활동은 이날을 기억해요`)}</div>
          </SectionCard>}
        {/* 關係溫度 */}
        <SectionCard>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#a86e84" }}>{tr("關係溫度", "Relationship warmth", "関係温度", "관계 온도")}</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#d16a8d" }}>{temperature}°</span>
            {tempDelta !== 0 && <span style={{ fontSize: 10, fontWeight: 800, color: tempDelta > 0 ? "#e05a86" : "#8a9bb0" }}>{tempDelta > 0
              ? tr(`▲ 今天 +${tempDelta}`, `▲ Today +${tempDelta}`, `▲ 今日 +${tempDelta}`, `▲ 오늘 +${tempDelta}`)
              : tr(`▼ 今天 ${tempDelta}`, `▼ Today ${tempDelta}`, `▼ 今日 ${tempDelta}`, `▼ 오늘 ${tempDelta}`)}</span>}
          </div>
          <div style={{ height: 7, borderRadius: 99, background: "rgba(255,255,255,.85)", marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${temperature}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#ffb2c8,#e91e63)", transition: "width .6s" }} />
          </div>
          <div style={{ fontSize: 10.5, color: "#a86e84", marginTop: 8, fontFamily: HAND_FONT }}>{tr(`${character.name}說：`, `${character.name} says: `, `${character.name}：`, `${character.name}: `)}{temperatureComment(tempDelta, temperature, uiLocale)}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
            {COUPLE_UNLOCKS.map((unlock) => {
              const unlocked = peakTemperature >= unlock.temperature;
              const label = unlockLabel(unlock.id);
              const clickable = unlocked && unlock.id === "nickname";
              return <button key={unlock.id} type="button" disabled={!clickable} onClick={() => setNicknameDraft((draft) => (draft === null ? nickname : null))}
                style={{ border: 0, borderRadius: 99, padding: "3px 9px", fontSize: 11, fontWeight: unlocked ? 800 : 600, color: unlocked ? COUPLE_COLORS.gold : COUPLE_COLORS.sub, background: unlocked ? "linear-gradient(135deg,#fff3d9,#ffe8bd)" : "rgba(255,255,255,.8)", cursor: clickable ? "pointer" : "default", opacity: 1 }}>
                {unlocked
                  ? `✓ ${unlock.temperature}° ${label}${unlock.id === "nickname" ? (nickname ? `：${nickname}` : tr("（點我設定）", " (tap to set)", "（タップで設定）", " (눌러서 설정)")) : ""}`
                  : tr(`${unlock.temperature}° ${label}（還差 ${unlock.temperature - peakTemperature}°）`, `${unlock.temperature}° ${label} (${unlock.temperature - peakTemperature}° to go)`, `${unlock.temperature}° ${label}（あと ${unlock.temperature - peakTemperature}°）`, `${unlock.temperature}° ${label} (${unlock.temperature - peakTemperature}° 남음)`)}
              </button>;
            })}
          </div>
          {nicknameDraft !== null && <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={nicknameDraft} maxLength={20} onChange={(event) => setNicknameDraft(event.target.value)} placeholder={tr(`希望${character.name}怎麼叫你？`, `What should ${character.name} call you?`, `${character.name}にどう呼ばれたい？`, `${character.name}이(가) 뭐라고 불러 주면 좋을까요?`)}
              style={{ flex: 1, minWidth: 0, border: "1px solid rgba(209,106,141,.3)", borderRadius: 10, padding: "6px 9px", fontSize: 12, color: COUPLE_COLORS.ink, background: "rgba(255,255,255,.9)" }} />
            <button type="button" onClick={() => { const value = nicknameDraft.trim(); updateStore((store) => withCoupleNickname(store, character.id, value)); setNicknameDraft(null); }}
              style={{ border: 0, borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 800, color: COUPLE_COLORS.onAccent, background: "linear-gradient(135deg,#e88aaa,#c96f91)" }}>{tr("儲存", "Save", "保存", "저장")}</button>
          </div>}
          {daily?.milestones?.fullHeart && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(209,106,141,.18)", fontSize: 10.5, fontWeight: 900, color: "#c35f86" }}>✦ {tr("羈絆里程碑：心意滿格", "Bond milestone: Hearts full", "絆のマイルストーン：想いが満タン", "유대 이정표: 마음 가득")}</div>}
        </SectionCard>

        {/* 今日戀愛簽：玩家按了才抽，一天一支 */}
        <SectionCard>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 17 }}>🥠</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#7a4257" }}>{tr("今日戀愛簽", "Today's Love Fortune", "今日の恋みくじ", "오늘의 연애 운세")}</span>
            {daily?.sign?.text && !drawingSign && <span style={{ marginLeft: "auto", fontSize: 9.5, color: "#c093a4" }}>{tr(`${signTime} 抽的`, `Drawn at ${signTime}`, `${signTime} に引きました`, `${signTime}에 뽑음`)}</span>}
          </div>
          {drawingSign ? (
            <MoonlitSignStage characterName={character.name} sign={drawnSign} tr={tr} golden={goldenMoon} onDone={finishSignReveal} />
          ) : daily?.sign?.text ? (
            <div className={`couple-sign-result${signReveal ? " is-revealing" : ""}`}>
              <span className="couple-sign-moon-seal" aria-hidden="true" />
              <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                <span className="couple-sign-level" style={{ background: "linear-gradient(135deg,#f2c14e,#dd9f33)", color: "#fff", borderRadius: 8, padding: "2px 9px", fontSize: 10.5, fontWeight: 900 }}>{daily.sign.level}</span>
                <span className="couple-sign-tip" style={{ ...GLASS, borderRadius: 8, padding: "2px 9px", fontSize: 10.5, fontWeight: 800, color: "#b05e75" }}>{daily.sign.tip}</span>
              </div>
              <div className="couple-sign-text" style={{ fontSize: 12.5, lineHeight: 1.85, color: "#6d3c50", marginTop: 8, fontFamily: HAND_FONT }}>「{daily.sign.text}」</div>
              <button className="couple-sign-share" type="button" disabled={!!daily.signSharedAt} onClick={() => shareToChat("sign")}
                style={{ marginTop: 9, border: 0, borderRadius: 10, padding: "7px 12px", fontSize: 10.5, fontWeight: 800, color: daily.signSharedAt ? "#a98b96" : "#fff", background: daily.signSharedAt ? "rgba(255,255,255,.72)" : "linear-gradient(135deg,#e88aaa,#c96f91)" }}>
                {daily.signSharedAt ? tr("已分享到聊天室", "Shared to chat", "チャットに共有済み", "채팅방에 공유됨") : tr("分享到聊天室", "Share to chat", "チャットに共有", "채팅방에 공유")}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
              <>
                <div style={{ fontSize: 10.5, color: "#a86e84", marginBottom: 10 }}>{tr(`今天的籤還在籤筒裡，抽一支看看${character.name}想對你說什麼`, `Today's fortune is still waiting. Draw one to see what ${character.name} wants to tell you.`, `今日のおみくじはまだ筒の中。一本引いて、${character.name}が伝えたいことを見てみましょう。`, `오늘의 운세는 아직 통 안에 있어요. 하나 뽑아 ${character.name}이(가) 하고 싶은 말을 확인해 보세요.`)}</div>
                <button className="couple-sign-draw-btn" type="button" disabled={dailyLoading || !daily} onClick={drawSign}
                  style={{ border: 0, borderRadius: 14, padding: "9px 22px", fontSize: 12, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#f2b25e,#dd8f33)", boxShadow: "0 4px 14px rgba(220,150,60,.35)", opacity: dailyLoading || !daily ? .6 : 1 }}>
                  🌙 {tr("月下抽一支", "Draw under the moon", "月下で一本引く", "달빛 아래 뽑기")}
                </button>
              </>
            </div>
          )}
        </SectionCard>

        {/* 今日小互動 */}
        <SectionCard>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15 }}>💌</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#7a4257" }}>{tr("今日小互動", "Today's Little Activity", "今日の小さな交流", "오늘의 작은 활동")}</span>
            <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 800, color: "#a2652f", background: "linear-gradient(135deg,#fff3d9,#ffe8bd)", border: "1px solid #ecd193", borderRadius: 99, padding: "2px 8px" }}>💎 {tr("靈魂結晶", "Soul Crystals", "ソウルクリスタル", "영혼 크리스털")} ×{TASK_REWARD}</span>
          </div>
          {dailyLoading || !daily?.task ? (
            <div style={{ fontSize: 11, color: "#a86e84", padding: "12px 0 4px", textAlign: "center" }}>{dailyLoading
              ? tr(`${character.name}正在想今天要出什麼題……`, `${character.name} is thinking of today's activity…`, `${character.name}が今日のお題を考えています……`, `${character.name}이(가) 오늘의 활동을 생각하고 있어요……`)
              : tr("載入中……", "Loading…", "読み込み中……", "불러오는 중……")}</div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, lineHeight: 1.85, color: "#6d3c50", marginTop: 8, fontFamily: HAND_FONT }}>「{daily.task.text}」</div>
              {!daily.taskDone && <button type="button" disabled={daily.taskChatState === "active"} onClick={() => shareToChat("task")}
                style={{ marginTop: 9, border: 0, borderRadius: 10, padding: "7px 12px", fontSize: 10.5, fontWeight: 800, color: daily.taskChatState === "active" ? "#a98b96" : "#fff", background: daily.taskChatState === "active" ? "rgba(255,255,255,.72)" : "linear-gradient(135deg,#e88aaa,#c96f91)" }}>
                {daily.taskChatState === "active" ? tr("已分享到聊天室", "Shared to chat", "チャットに共有済み", "채팅방에 공유됨") : tr("分享到聊天室", "Share to chat", "チャットに共有", "채팅방에 공유")}
              </button>}
              {daily.taskComment && <div style={{ fontSize: 10.5, color: daily.taskDone ? "#3f9d63" : "#b05e75", marginTop: 7, fontFamily: HAND_FONT }}>{daily.taskDone ? "✅ " : "💬 "}{daily.taskComment}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                {daily.taskDone
                  ? <span style={{ fontSize: 11, fontWeight: 800, color: "#3f9d63" }}>{tr("今日已完成", "Completed today", "本日達成済み", "오늘 완료")}</span>
                  : <button type="button" disabled={judging} onClick={checkTask}
                      style={{ border: 0, borderRadius: 12, padding: "8px 16px", fontSize: 11, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#f06292,#d16a8d)", boxShadow: "0 4px 12px rgba(233,30,99,.3)", opacity: judging ? .6 : 1 }}>
                      {judging
                        ? tr(`${character.name}驗收中…`, `${character.name} is checking…`, `${character.name}が確認中…`, `${character.name}이(가) 확인 중…`)
                        : judgeFailed
                          ? tr(`↻ 再請${character.name}驗收一次`, `↻ Ask ${character.name} to check again`, `↻ もう一度${character.name}に確認してもらう`, `↻ ${character.name}에게 다시 확인받기`)
                          : tr(`去聊天完成後，請${character.name}驗收`, `Complete it in chat, then ask ${character.name} to check`, `チャットで達成したら${character.name}に確認してもらう`, `채팅에서 완료한 뒤 ${character.name}에게 확인받기`)}
                    </button>}
                <span style={{ marginLeft: "auto", fontSize: 9.5, color: "#c093a4" }}>{tr(
                  `連續 7 天加碼 ×3 · 目前連續 ${daily.streak || 0} 天`,
                  `7-day streak bonus ×3 · Current streak: ${daily.streak || 0} days`,
                  `7日連続ボーナス ×3 · 現在 ${daily.streak || 0}日連続`,
                  `7일 연속 보너스 ×3 · 현재 ${daily.streak || 0}일 연속`
                )}</span>
              </div>
            </>
          )}
        </SectionCard>

          {notice && <div style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: COUPLE_COLORS.gold, marginTop: 10 }}>{notice}</div>}
        </>}

        {tab === "promises" && <>
          {sectionLabel(tr("進行中", "Open", "進行中", "진행 중"), `${openPromises.length}/${COUPLE_OPEN_PROMISE_LIMIT}`)}
          {openPromises.length === 0 && !promiseForm && <SectionCard style={{ textAlign: "center", fontSize: 12, lineHeight: 1.7, color: COUPLE_COLORS.sub }}>
            {tr(`還沒有約定。聊天時和${character.name}說好的事，會跳出提示讓你收進來；也可以自己新增。`, `No promises yet. When you and ${character.name} agree on something in chat, you'll be asked whether to save it. You can also add one yourself.`, `まだ約束はありません。チャットで${character.name}と約束すると追加の確認が出ます。自分で追加することもできます。`, `아직 약속이 없어요. 채팅에서 ${character.name}와(과) 약속하면 저장할지 물어봐요. 직접 추가할 수도 있어요.`)}
          </SectionCard>}
          {openPromises.map((promise) => {
            const left = promise.date ? daysUntil(fromDateKey(promise.date)) : null;
            return <SectionCard key={promise.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <button type="button" aria-label={tr("標記為完成", "Mark as done", "完了にする", "완료로 표시")} onClick={() => completePromise(promise)}
                style={{ flex: "0 0 24px", height: 24, borderRadius: "50%", border: "2px solid #e3a6bb", background: "#fff", padding: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: COUPLE_COLORS.ink, fontFamily: HAND_FONT, wordBreak: "break-word" }}>{promise.text}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 99, padding: "1px 8px", color: COUPLE_COLORS.accent, background: "rgba(209,106,141,.12)" }}>{promise.source === "chat" ? tr("💬 聊天時說好的", "💬 From chat", "💬 チャットで約束", "💬 채팅에서 약속") : tr("✎ 我新增的", "✎ Added by me", "✎ 自分で追加", "✎ 직접 추가")}</span>
                  {promise.date && <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 99, padding: "1px 8px", color: left < 0 ? COUPLE_COLORS.sub : COUPLE_COLORS.gold, background: "linear-gradient(135deg,#fff3d9,#ffe8bd)" }}>📅 {shortDate(fromDateKey(promise.date))}・{leftLabel(left)}</span>}
                </div>
              </div>
              <button type="button" aria-label={tr("刪除約定", "Delete promise", "約束を削除", "약속 삭제")} onClick={() => deletePromise(promise)}
                style={{ border: 0, background: "transparent", color: COUPLE_COLORS.faint, fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
            </SectionCard>;
          })}
          {promiseForm ? <SectionCard>
            <input value={promiseForm.text} maxLength={60} autoFocus onChange={(event) => setPromiseForm((form) => ({ ...form, text: event.target.value }))}
              placeholder={tr("要約定什麼呢？例如：週末一起看一部電影", "What's the promise? e.g. Watch a movie together this weekend", "どんな約束？例：週末に一緒に映画を見る", "어떤 약속인가요? 예: 주말에 같이 영화 보기")} style={{ ...inputStyle, width: "100%" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
              <span style={{ fontSize: 11, color: COUPLE_COLORS.sub }}>{tr("日期（可不填）", "Date (optional)", "日付（任意）", "날짜(선택)")}</span>
              <input type="date" value={promiseForm.date} onChange={(event) => setPromiseForm((form) => ({ ...form, date: event.target.value }))} style={{ ...inputStyle, flex: 1 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 9 }}>
              <button type="button" onClick={() => setPromiseForm(null)} style={{ ...primaryButton, color: COUPLE_COLORS.sub, background: "rgba(255,255,255,.8)" }}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
              <button type="button" disabled={!promiseForm.text.trim()} onClick={submitPromise} style={{ ...primaryButton, opacity: promiseForm.text.trim() ? 1 : .55 }}>{tr("新增約定", "Add promise", "約束を追加", "약속 추가")}</button>
            </div>
          </SectionCard> : <button type="button" onClick={() => setPromiseForm({ text: "", date: "" })} style={ghostButton}>＋ {tr("新增約定", "Add a promise", "約束を追加", "약속 추가")}</button>}
          {notice && <div style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: COUPLE_COLORS.gold, marginTop: 10 }}>{notice}</div>}

          {donePromises.length > 0 && <>
            {sectionLabel(tr("已完成", "Done", "完了", "완료"), String(donePromises.length))}
            {donePromises.slice(safeDonePage * PROMISE_PAGE_SIZE, (safeDonePage + 1) * PROMISE_PAGE_SIZE).map((promise) => (
              <SectionCard key={promise.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 12px" }}>
                <span style={{ flex: "0 0 22px", height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, color: COUPLE_COLORS.onAccent, background: COUPLE_COLORS.ok }}>✓</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: COUPLE_COLORS.ink, fontFamily: HAND_FONT, textDecoration: "line-through", opacity: .65, wordBreak: "break-word" }}>{promise.text}</div>
                  <div style={{ fontSize: 11, color: COUPLE_COLORS.sub, marginTop: 2 }}>{tr(`${shortDate(promise.doneAt)} 完成`, `Done ${shortDate(promise.doneAt)}`, `${shortDate(promise.doneAt)} 完了`, `${shortDate(promise.doneAt)} 완료`)}</div>
                </div>
                <button type="button" title={tr("改回進行中", "Move back to open", "進行中に戻す", "진행 중으로 되돌리기")} onClick={() => reopenPromise(promise)}
                  style={{ border: 0, background: "transparent", color: COUPLE_COLORS.faint, fontSize: 14, padding: 2 }}>↺</button>
              </SectionCard>
            ))}
            {donePageCount > 1 && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10 }}>
              <button type="button" disabled={safeDonePage <= 0} onClick={() => setDonePage(safeDonePage - 1)} aria-label={tr("上一頁", "Previous page", "前のページ", "이전 페이지")}
                style={{ ...GLASS, width: 30, height: 30, borderRadius: "50%", fontSize: 16, color: COUPLE_COLORS.sub, opacity: safeDonePage <= 0 ? .4 : 1 }}>‹</button>
              <span style={{ fontSize: 12, color: COUPLE_COLORS.sub }}>{safeDonePage + 1} / {donePageCount}</span>
              <button type="button" disabled={safeDonePage >= donePageCount - 1} onClick={() => setDonePage(safeDonePage + 1)} aria-label={tr("下一頁", "Next page", "次のページ", "다음 페이지")}
                style={{ ...GLASS, width: 30, height: 30, borderRadius: "50%", fontSize: 16, color: COUPLE_COLORS.sub, opacity: safeDonePage >= donePageCount - 1 ? .4 : 1 }}>›</button>
            </div>}
          </>}
        </>}

        {tab === "memories" && <>
          {sectionLabel(tr("紀念日", "Anniversaries", "記念日", "기념일"))}
          {anniversaries?.upcoming.length > 0 && <SectionCard style={{ display: "flex", gap: 6, padding: "10px 8px", textAlign: "center" }}>
            {anniversaries.upcoming.slice(0, 3).map((item) => <div key={item.key} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: COUPLE_COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
              <div style={{ fontSize: 11, color: item.isToday ? COUPLE_COLORS.accent : COUPLE_COLORS.sub, marginTop: 2 }}>{item.isToday ? tr("就是今天", "Today", "今日", "오늘") : `${shortDate(item.time)}・${leftLabel(item.daysLeft)}`}</div>
            </div>)}
          </SectionCard>}
          {customAnniversaries.map((item) => <SectionCard key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: COUPLE_COLORS.ink }}>💗 {item.title}<span style={{ marginLeft: 6, fontSize: 11, color: COUPLE_COLORS.sub }}>{item.date}{item.yearly ? tr("・每年", " · yearly", "・毎年", " · 매년") : ""}</span></span>
            <button type="button" aria-label={tr("刪除紀念日", "Delete anniversary", "記念日を削除", "기념일 삭제")} onClick={() => deleteAnniversary(item)} style={{ border: 0, background: "transparent", color: COUPLE_COLORS.faint, fontSize: 16, lineHeight: 1 }}>×</button>
          </SectionCard>)}
          {anniversaryForm ? <SectionCard>
            <input value={anniversaryForm.title} maxLength={40} autoFocus onChange={(event) => setAnniversaryForm((form) => ({ ...form, title: event.target.value }))}
              placeholder={tr("紀念日名稱，例如：第一次告白", "Name, e.g. The day we confessed", "記念日の名前（例：初めての告白）", "기념일 이름 (예: 처음 고백한 날)")} style={{ ...inputStyle, width: "100%" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
              <input type="date" value={anniversaryForm.date} onChange={(event) => setAnniversaryForm((form) => ({ ...form, date: event.target.value }))} style={{ ...inputStyle, flex: 1 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COUPLE_COLORS.sub }}>
                <input type="checkbox" checked={anniversaryForm.yearly} onChange={(event) => setAnniversaryForm((form) => ({ ...form, yearly: event.target.checked }))} />{tr("每年", "Yearly", "毎年", "매년")}
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 9 }}>
              <button type="button" onClick={() => setAnniversaryForm(null)} style={{ ...primaryButton, color: COUPLE_COLORS.sub, background: "rgba(255,255,255,.8)" }}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
              <button type="button" onClick={submitAnniversary} style={primaryButton}>{tr("新增", "Add", "追加", "추가")}</button>
            </div>
          </SectionCard> : <button type="button" onClick={() => setAnniversaryForm({ title: "", date: toDateKey(Date.now()), yearly: true })} style={ghostButton}>＋ {tr("新增紀念日", "Add an anniversary", "記念日を追加", "기념일 추가")}</button>}
          {notice && <div style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: COUPLE_COLORS.gold, marginTop: 10 }}>{notice}</div>}

          {sectionLabel(tr("我們的時間軸", "Our timeline", "二人のタイムライン", "우리의 타임라인"))}
          {timeline.length === 0 && <div style={{ textAlign: "center", padding: "14px 0", fontSize: 12, color: COUPLE_COLORS.sub }}>{tr("一起累積的回憶會出現在這裡", "Memories you build together will appear here", "二人で積み重ねた思い出がここに表示されます", "함께 쌓은 추억이 여기에 표시돼요")}</div>}
          <div style={{ position: "relative", paddingLeft: 20, marginTop: 8 }}>
            {timeline.length > 0 && <div style={{ position: "absolute", left: 7, top: 6, bottom: 6, width: 2, borderRadius: 2, background: "linear-gradient(180deg,#f6b6ca,#e3c6f5)" }} />}
            {timeline.slice(0, timelineMonths).map((group) => <div key={group.key}>
              <div style={{ position: "relative", display: "inline-block", margin: "4px 0 8px -20px", padding: "1px 9px", borderRadius: 99, background: "rgba(255,255,255,.85)", fontSize: 11, fontWeight: 800, color: COUPLE_COLORS.sub }}>{monthLabel(group)}</div>
              {group.items.map((item) => {
                const icon = item.type === "promise" ? "🤞" : item.type === "special" ? "✦" : "💗";
                const sub = item.type === "promise"
                  ? tr("完成的約定", "Promise kept", "果たした約束", "지킨 약속")
                  : item.type === "special"
                    ? tr(`特別記憶・${item.rarity || ""}`, `Special memory · ${item.rarity || ""}`, `特別な思い出・${item.rarity || ""}`, `특별한 추억 · ${item.rarity || ""}`)
                    : tr("紀念日", "Anniversary", "記念日", "기념일");
                return <div key={item.key} style={{ position: "relative", marginBottom: 8 }}>
                  <span style={{ position: "absolute", left: -17, top: 13, width: 9, height: 9, borderRadius: "50%", background: item.type === "special" ? (RARITY_COLORS[item.rarity] || RARITY_COLORS.R) : "#f191ae", boxShadow: "0 0 0 2px #fff" }} />
                  <button type="button" disabled={item.type !== "special"} onClick={() => item.memory && setViewingMemory(item.memory)}
                    style={{ ...GLASS, width: "100%", display: "block", borderRadius: 14, padding: "8px 12px", textAlign: "left", cursor: item.type === "special" ? "pointer" : "default" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: COUPLE_COLORS.ink, wordBreak: "break-word" }}>{icon} {item.title}</div>
                    <div style={{ fontSize: 11, color: COUPLE_COLORS.sub, marginTop: 2 }}>{shortDate(item.time)}・{sub}</div>
                  </button>
                </div>;
              })}
            </div>)}
          </div>
          {timeline.length > timelineMonths && <button type="button" onClick={() => setTimelineMonths((count) => count + TIMELINE_MONTH_STEP)} style={ghostButton}>{tr("顯示更早的回憶", "Show earlier memories", "もっと前の思い出を表示", "이전 추억 더 보기")}</button>}
          <button type="button" onClick={() => setView("cards")} style={{ ...GLASS, width: "100%", display: "flex", alignItems: "center", marginTop: 12, padding: "11px 14px", borderRadius: 16 }}>
            <span style={{ fontSize: 12.5, fontWeight: 900, color: COUPLE_COLORS.ink }}>📖 {tr("特別記憶卡牆", "Special memory wall", "特別な思い出の壁", "특별한 추억 벽")}</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: COUPLE_COLORS.sub }}>{allMemories.length ? tr(`${allMemories.length} 張 ›`, `${allMemories.length} ›`, `${allMemories.length}枚 ›`, `${allMemories.length}장 ›`) : tr("還沒有 ›", "None yet ›", "まだありません ›", "아직 없음 ›")}</span>
          </button>
        </>}
      </div>
      {viewingMemory && <SpecialMemoryModal memory={viewingMemory} characterAvatar={characterAvatar} playerAvatar={playerAvatar} playerName={playerName} tr={tr} locale={uiLocale} onClose={() => setViewingMemory(null)} />}
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGacha } from "../../contexts/GachaContext";
import { SpecialMemoryModal } from "../gacha/SpecialMemoryCard";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import { reviewCoupleInviteReplies } from "../../utils/coupleInviteReview";
import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";
import { coupleDayKey, generateLoveSign, generateDailyTask, judgeCoupleTask, settleTemperature, temperatureComment } from "../../services/couple/coupleDailyService";

const RARITY_COLORS = { SSR: "#c99a4b", SR: "#8f6cc9", R: "#6f9cc9" };
const GLASS = { background: "rgba(255,255,255,.66)", border: "1px solid rgba(255,255,255,.85)" };
const HAND_FONT = "'LXGW WenKai TC','Noto Serif TC',serif";
const DAILY_KEY = "ent_coupleDaily";
const TASK_REWARD = 180;       // 一次單抽所需的靈魂結晶
const STREAK_BONUS = 540;      // 連續 7 天加碼 ×3
const formatDate = (time, locale = "zh-TW") => new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
const MOONLIT_SIGN_STYLES = `
  @keyframes coupleMoonRise {
    0% { opacity: 0; transform: translate(-50%, 12px) scale(.88); }
    100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  }
  @keyframes coupleMoonRipple {
    0% { opacity: .55; transform: translate(-50%, -50%) scale(.35); }
    75%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
  }
  @keyframes coupleMoonShimmer {
    0% { transform: translateX(-48%) skewX(-18deg); opacity: 0; }
    25% { opacity: .55; }
    70%, 100% { transform: translateX(160%) skewX(-18deg); opacity: 0; }
  }
  @keyframes couplePaperUnderwater {
    0%, 100% { transform: translate(-50%, 18px) rotate(-1.5deg); opacity: .42; }
    50% { transform: translate(-50%, 12px) rotate(1deg); opacity: .72; }
  }
  @keyframes coupleMistDrift {
    0%, 100% { transform: translateX(-5%); opacity: .18; }
    50% { transform: translateX(5%); opacity: .36; }
  }
  @keyframes coupleSignSurface {
    0% { opacity: 0; transform: translateY(14px) rotate(.5deg) scale(.98); filter: blur(2px); clip-path: inset(58% 2% 0 2% round 12px); }
    70% { opacity: 1; filter: blur(0); }
    100% { opacity: 1; transform: translateY(0) rotate(0) scale(1); filter: blur(0); clip-path: inset(0 0 0 0 round 0); }
  }
  @keyframes coupleMoonSweep {
    0% { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
    30% { opacity: .55; }
    100% { transform: translateX(180%) skewX(-18deg); opacity: 0; }
  }
  .couple-moon-sign-stage {
    position: relative;
    height: 132px;
    margin-top: 9px;
    overflow: hidden;
    border-radius: 16px;
    isolation: isolate;
    background:
      radial-gradient(circle at 50% 16%, rgba(255,244,205,.24), transparent 31%),
      linear-gradient(180deg, #b8a9d5 0%, #8fa7c2 42%, #647f9d 58%, #496983 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.42), inset 0 -18px 34px rgba(20,46,74,.22);
  }
  .couple-moon-sign-stage::before {
    content: "";
    position: absolute;
    inset: 54% -20% -20%;
    z-index: 2;
    background:
      repeating-linear-gradient(176deg, rgba(255,255,255,.12) 0 1px, transparent 1px 8px),
      linear-gradient(180deg, rgba(132,176,201,.2), rgba(28,66,95,.4));
    transform: perspective(120px) rotateX(56deg) scale(1.2);
    transform-origin: top;
  }
  .couple-moon-disc {
    position: absolute;
    z-index: 1;
    top: 10px;
    left: 50%;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: radial-gradient(circle at 38% 34%, #fffdf0 0 18%, #f9eec7 57%, #e9d6a8 100%);
    box-shadow: 0 0 16px rgba(255,240,187,.65), 0 0 42px rgba(255,235,182,.32);
    animation: coupleMoonRise 420ms cubic-bezier(.23,1,.32,1) both;
  }
  .couple-moon-reflection {
    position: absolute;
    z-index: 3;
    left: 50%;
    top: 58px;
    width: 30px;
    height: 50px;
    transform: translateX(-50%);
    background: linear-gradient(180deg, rgba(255,239,183,.62), rgba(255,244,210,0));
    filter: blur(4px);
    clip-path: polygon(35% 0,65% 0,82% 26%,62% 38%,88% 54%,56% 65%,76% 82%,24% 100%,42% 68%,13% 55%,42% 38%,20% 22%);
  }
  .couple-moon-ripple {
    position: absolute;
    z-index: 4;
    left: 50%;
    top: 78px;
    width: 112px;
    height: 26px;
    border: 1px solid rgba(246,238,211,.62);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    animation: coupleMoonRipple 1700ms cubic-bezier(.23,1,.32,1) infinite;
  }
  .couple-moon-ripple:nth-of-type(2) { animation-delay: 680ms; }
  .couple-moon-paper {
    position: absolute;
    z-index: 5;
    left: 50%;
    bottom: -7px;
    width: 82px;
    height: 58px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(231,216,177,.72);
    border-radius: 5px 5px 2px 2px;
    color: rgba(111,78,70,.7);
    font-family: ${HAND_FONT};
    font-size: 10px;
    letter-spacing: .12em;
    background:
      linear-gradient(90deg, transparent 49%, rgba(187,157,112,.12) 50%, transparent 51%),
      linear-gradient(155deg, #fff9e9, #eee1c5);
    box-shadow: 0 7px 22px rgba(20,45,68,.28);
    animation: couplePaperUnderwater 2100ms ease-in-out infinite;
  }
  .couple-moon-paper::after {
    content: "☾";
    position: absolute;
    right: 7px;
    bottom: 5px;
    color: rgba(181,128,123,.58);
    font-size: 13px;
  }
  .couple-moon-shimmer {
    position: absolute;
    z-index: 6;
    inset: 54% auto 0 -25%;
    width: 35%;
    background: linear-gradient(90deg, transparent, rgba(255,250,226,.32), transparent);
    animation: coupleMoonShimmer 2200ms cubic-bezier(.23,1,.32,1) infinite;
  }
  .couple-moon-mist {
    position: absolute;
    z-index: 7;
    left: -10%;
    right: -10%;
    bottom: 22px;
    height: 24px;
    background: radial-gradient(ellipse, rgba(235,238,246,.55), transparent 70%);
    filter: blur(8px);
    animation: coupleMistDrift 2600ms ease-in-out infinite;
  }
  .couple-moon-status {
    position: absolute;
    z-index: 8;
    left: 0;
    right: 0;
    bottom: 8px;
    color: rgba(255,255,255,.88);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .08em;
    text-shadow: 0 1px 5px rgba(28,48,72,.5);
  }
  .couple-sign-result {
    position: relative;
    overflow: hidden;
  }
  .couple-sign-result.is-revealing {
    animation: coupleSignSurface 520ms cubic-bezier(.23,1,.32,1) both;
  }
  .couple-sign-result.is-revealing::after {
    content: "";
    position: absolute;
    z-index: 3;
    inset: 0 auto 0 -30%;
    width: 22%;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(255,250,222,.64), transparent);
    animation: coupleMoonSweep 700ms 120ms cubic-bezier(.23,1,.32,1) both;
  }
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
  @media (prefers-reduced-motion: reduce) {
    .couple-moon-disc { animation: none; transform: translateX(-50%); }
    .couple-moon-ripple, .couple-moon-paper, .couple-moon-shimmer, .couple-moon-mist { animation: none; }
    .couple-sign-result.is-revealing { animation: none; }
    .couple-sign-result.is-revealing::after { display: none; }
  }
`;

function MoonlitFortuneStage({ characterName, tr }) {
  return (
    <div className="couple-moon-sign-stage" role="status" aria-live="polite" aria-label={tr("正在抽取今日戀愛籤", "Drawing today's love fortune", "今日の恋みくじを引いています", "오늘의 연애 운세를 뽑는 중")}>
      <span className="couple-moon-disc" aria-hidden="true" />
      <span className="couple-moon-reflection" aria-hidden="true" />
      <span className="couple-moon-ripple" aria-hidden="true" />
      <span className="couple-moon-ripple" aria-hidden="true" />
      <span className="couple-moon-paper" aria-hidden="true">{tr("戀愛籤", "Love fortune", "恋みくじ", "연애 운세")}</span>
      <span className="couple-moon-shimmer" aria-hidden="true" />
      <span className="couple-moon-mist" aria-hidden="true" />
      <span className="couple-moon-status">{tr(`月光正在映出${characterName}的心意…`, `Moonlight is revealing ${characterName}'s feelings…`, `月明かりが${characterName}の想いを映しています…`, `달빛이 ${characterName}의 마음을 비추는 중…`)}</span>
    </div>
  );
}

function Avatar({ src, fallback, size = 52, ring = "#f191ae" }) {
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flex: "0 0 auto", display: "grid", placeItems: "center", background: "rgba(255,255,255,.85)", border: `2.5px solid ${ring}`, boxShadow: "0 4px 14px rgba(190,90,120,.25)", fontSize: size * .42, fontWeight: 800, color: "#b05e75" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (fallback || "♥")}
    </span>
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
  const [view, setView] = useState("home"); // home | memories
  const [rarityFilter, setRarityFilter] = useState("ALL");
  const [viewingMemory, setViewingMemory] = useState(null);
  const [dailyStore, setDailyStore] = useState(null); // null = 尚未載入
  const [dailyLoading, setDailyLoading] = useState(false);
  const [judging, setJudging] = useState(false);
  const [notice, setNotice] = useState("");
  const generatingRef = useRef(false);
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
  const saveStore = (next) => { setDailyStore(next); saveFeatureEntity(DAILY_KEY, next).catch(() => {}); };
  const openSpace = (charId) => {
    setPartnerId(charId);
    setChoosing(false);
    setView("home");
    setRarityFilter("ALL");
    setNotice("");
    saveStore({ ...(dailyStore || {}), _activeSpaceId: charId });
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
    saveStore({
      ...dailyStore,
      _spaces: { ...(dailyStore._spaces || {}), [charId]: { status: "pending", invitedAt: now, pendingRound: 0 } },
    });
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
      saveStore({
        ...dailyStore,
        _spaces: {
          ...(dailyStore._spaces || {}),
          [charId]: {
            ...space,
            status: "declined",
            declinedAt: now,
            canInviteAgainAt: Math.max(Number(space.invitedAt) + 3 * 86400000, now),
          },
        },
      });
      setNotice(tr(`重新確認第 ${result.matchedRound} 輪回覆後，判定角色婉拒了邀請。`, `After reviewing reply ${result.matchedRound}, the character was determined to have declined the invitation.`, `${result.matchedRound}回目の返信を再確認し、キャラが招待を断ったと判断しました。`, `${result.matchedRound}번째 답변을 다시 확인한 결과 캐릭터가 초대를 거절한 것으로 판단했습니다.`));
      return;
    }

    const preview = result.matchedText.length > 180
      ? `${result.matchedText.slice(0, 180)}…`
      : result.matchedText;
    if (!window.confirm(tr(`偵測到角色可能已同意：\n\n「${preview}」\n\n是否開通情侶空間？`, `The character may have agreed:\n\n“${preview}”\n\nOpen the Couple Space?`, `キャラが同意した可能性があります：\n\n「${preview}」\n\nカップルスペースを開きますか？`, `캐릭터가 동의한 것으로 보입니다:\n\n“${preview}”\n\n커플 공간을 열까요?`))) return;
    const now = Date.now();
    const { canInviteAgainAt: _cooldown, expiredAt: _expiredAt, ...rest } = space;
    saveStore({
      ...dailyStore,
      _activeSpaceId: charId,
      _spaces: {
        ...(dailyStore._spaces || {}),
        [charId]: { ...rest, status: "accepted", acceptedAt: now, reviewedAt: now },
      },
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
    saveStore({
      ...dailyStore,
      [character.id]: isTask
        ? { ...daily, taskSharedAt: now, taskChatState: "active", taskChatEndedAt: null }
        : { ...daily, signSharedAt: now },
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
    generatingRef.current = true;
    setDailyLoading(true);
    const messages = chatHistory[character.id] || [];
    const lastMessageAt = messages[messages.length - 1]?.time || null;
    const lastMemoryAt = specialMemories.filter((m) => String(m.characterId) === String(character.id))[0]?.createdAt || null;
    const settled = settleTemperature({ previous: current?.temperature, lastMessageAt, lastTaskDoneDay: current?.lastDoneDay, lastMemoryAt, maxTemperatureReached: !!current?.maxTemperatureReached });
    const taskGenerationCharacter = {
      ...character,
      description: [
        "【今日小互動語氣】這不是制式任務或命令，而是角色想和玩家親近的私人邀請。請依角色個性自然地使用甜蜜、溫柔、撒嬌或調皮的口吻，讓玩家感到被期待；互動要輕鬆、具體，能在聊天室完成。避免『請完成』『必須』『任務』等系統式措辭。",
        character.description || character.personality || character.prompt || character.persona || "",
      ].filter(Boolean).join("\n"),
    };
    generateDailyTask({ character: taskGenerationCharacter, playerProfile, recentMessages: messages.slice(-12), apiConfig, locale: uiLocale }).then((task) => {
      const sameDay = current?.day === today;
      saveStore({
        ...dailyStore,
        [character.id]: {
          day: today,
          sign: sameDay && current?.sign?.text ? current.sign : null,
          signAt: sameDay ? current?.signAt || null : null,
          task,
          taskDone: sameDay ? !!current.taskDone : false,
          taskComment: sameDay ? current.taskComment || "" : "",
          streak: current?.streak || 0,
          lastDoneDay: current?.lastDoneDay || null,
          temperature: sameDay ? current.temperature : settled.temperature,
          tempDelta: sameDay ? current.tempDelta : settled.delta,
          maxTemperatureReached: current?.maxTemperatureReached || settled.maxTemperatureReached,
          firstMaxedAt: current?.firstMaxedAt || (settled.temperature >= 100 ? Date.now() : null),
          milestones: {
            ...(current?.milestones || {}),
            ...(settled.temperature >= 100 && !current?.milestones?.fullHeart ? { fullHeart: { unlocked: true, unlockedAt: Date.now() } } : {}),
          },
        },
      });
    }).finally(() => { generatingRef.current = false; setDailyLoading(false); });
  }, [character?.id, dailyStore === null ? "loading" : "ready", today]);

  const [drawingSign, setDrawingSign] = useState(false);
  const [signReveal, setSignReveal] = useState(false);
  useEffect(() => setSignReveal(false), [character?.id, today]);
  const drawSign = async () => {
    if (!character || !daily || daily.sign?.text || drawingSign) return;
    setSignReveal(false);
    setDrawingSign(true);
    try {
      const sign = await generateLoveSign({ character, playerProfile, recentMessages: (chatHistory[character.id] || []).slice(-12), apiConfig, locale: uiLocale });
      setSignReveal(true);
      saveStore({ ...dailyStore, [character.id]: { ...daily, sign, signAt: Date.now() } });
    } finally { setDrawingSign(false); }
  };

  const checkTask = async () => {
    if (!character || !daily || daily.taskDone || judging) return;
    setJudging(true);
    setNotice("");
    try {
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const todayMessages = (chatHistory[character.id] || []).filter((m) => (m.time || 0) >= dayStart.getTime());
      const verdict = await judgeCoupleTask({ task: daily.task?.text, character, playerProfile, todayMessages, apiConfig, locale: uiLocale });
      if (verdict.done) {
        const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - 86400000));
        const streak = daily.lastDoneDay === yesterday ? (daily.streak || 0) + 1 : 1;
        const bonus = streak > 0 && streak % 7 === 0 ? STREAK_BONUS : 0;
        changeCrystals(TASK_REWARD + bonus, {
          source: "couple",
          note: bonus
            ? tr(`完成情侶空間互動・連續 ${streak} 天加碼`, `Couple Space activity · ${streak}-day streak bonus`, `カップルスペース交流・${streak}日連続ボーナス`, `커플 공간 활동 · ${streak}일 연속 보너스`)
            : tr("完成情侶空間互動", "Completed Couple Space activity", "カップルスペース交流を達成", "커플 공간 활동 완료"),
        });
        saveStore({ ...dailyStore, [character.id]: { ...daily, taskDone: true, taskComment: verdict.comment, streak, lastDoneDay: today, taskChatState: "completed", taskChatEndedAt: Date.now() } });
        setNotice(tr(
          `💎 獲得 ${TASK_REWARD} 靈魂結晶${bonus ? `，連續 ${streak} 天加碼 +${bonus}！` : `（連續 ${streak} 天）`}`,
          `💎 Earned ${TASK_REWARD} Soul Crystals${bonus ? `, plus ${bonus} for a ${streak}-day streak!` : ` (${streak}-day streak)`}`,
          `💎 ソウルクリスタルを${TASK_REWARD}個獲得${bonus ? `、${streak}日連続ボーナス +${bonus}！` : `（${streak}日連続）`}`,
          `💎 영혼 크리스털 ${TASK_REWARD}개 획득${bonus ? `, ${streak}일 연속 보너스 +${bonus}!` : `(${streak}일 연속)`}`
        ));
      } else {
        saveStore({ ...dailyStore, [character.id]: { ...daily, taskComment: verdict.comment } });
        setNotice("");
      }
    } catch (reason) {
      setNotice(reason?.message || tr("驗收失敗，請稍後再試。", "Could not verify the activity. Please try again later.", "確認できませんでした。しばらくしてからもう一度お試しください。", "확인에 실패했습니다. 잠시 후 다시 시도하세요."));
    } finally { setJudging(false); }
  };

  // ---- 資料載入中 ----
  if (dailyStore === null) {
    return (
      <div className="mp-page couple-app-page" data-mp-surface="light" style={{ background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
        <div className="mp-hdr" style={{ background: "transparent" }}><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">💞 {tr("情侶空間", "Couple Space", "カップルスペース", "커플 공간")}</div></div>
        <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#a86e84", fontSize: 12 }}>💗</div>
      </div>
    );
  }

  // ---- 永久空間列表／邀請角色 ----
  if (choosing || !partner) {
    return (
      <div className="mp-page couple-app-page" data-mp-surface="light" style={{ background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
        <div className="mp-hdr" style={{ background: "transparent" }}><div className="mp-back" onClick={() => (partner ? setChoosing(false) : closeApp())}>←</div><div className="mp-htitle">💞 {tr("情侶空間", "Couple Space", "カップルスペース", "커플 공간")}</div></div>
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 26px" }}>
          <div style={{ textAlign: "center", padding: "10px 0 16px" }}>
            <div style={{ fontSize: 26 }}>💌</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#7a4257", marginTop: 6, fontFamily: HAND_FONT }}>{tr("選擇一個雙人空間", "Choose a shared space", "二人のスペースを選択", "두 사람의 공간 선택")}</div>
            <div style={{ fontSize: 10.5, color: "#a86e84", marginTop: 4, lineHeight: 1.7 }}>{tr("已開通的空間會永久保留；尚未開通的角色可以先送出邀請。", "Opened spaces are kept permanently. You can invite characters whose spaces are not open yet.", "開通したスペースは永久に残ります。未開通のキャラには招待を送れます。", "개설된 공간은 계속 유지됩니다. 아직 열리지 않은 캐릭터에게 초대를 보낼 수 있습니다.")}</div>
          </div>
          {partners.length === 0 && <div className="mp-empty"><div className="mp-empty-i">💞</div><div className="mp-empty-t">{tr("還沒有角色", "No characters yet", "キャラがまだいません", "아직 캐릭터가 없습니다")}<br />{tr("先去建立一位吧", "Create one first", "先に作成しましょう", "먼저 캐릭터를 만들어 보세요")}</div></div>}
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
  const daysTogether = firstMessageAt ? Math.max(1, Math.ceil((Date.now() - firstMessageAt) / 86400000)) : null;
  const allMemories = specialMemories.filter((m) => String(m.characterId) === String(character.id)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // ---- 回憶牆 ----
  if (view === "memories") {
    const memories = rarityFilter === "ALL" ? allMemories : allMemories.filter((m) => m.itemRarity === rarityFilter);
    const rarityCounts = allMemories.reduce((acc, m) => { acc[m.itemRarity] = (acc[m.itemRarity] || 0) + 1; return acc; }, {});
    return (
      <div className="mp-page couple-app-page" data-mp-surface="light" style={{ background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
        <div className="mp-hdr" style={{ background: "transparent" }}><div className="mp-back" onClick={() => setView("home")}>←</div><div className="mp-htitle">📖 {tr("我們的回憶", "Our Memories", "二人の思い出", "우리의 추억")}</div></div>
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

  // ---- 主頁：溫度計＋戀愛簽＋任務 ----
  const temperature = daily?.temperature ?? 60;
  const tempDelta = daily?.tempDelta ?? 0;
  const signTime = daily?.signAt ? new Intl.DateTimeFormat(uiLocale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(daily.signAt)) : "";
  return (
    <div className="mp-page couple-app-page" data-mp-surface="light" style={{ overflow: "hidden", background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
      <style>{MOONLIT_SIGN_STYLES}</style>
      {daily?.milestones?.fullHeart && <FullHeartBackdrop />}
      <div className="mp-hdr" style={{ position: "relative", zIndex: 1, background: "transparent" }}>
        <div className="mp-back" onClick={closeApp}>←</div>
        <div className="mp-htitle">💗 {tr("我們的日子", "Our Days", "二人の日々", "우리의 날들")}</div>
        <button type="button" title={tr("更換主要互動對象", "Change primary partner", "主な交流相手を変更", "주요 교류 상대 변경")} onClick={() => setChoosing(true)}
          style={{ marginLeft: "auto", border: "1px solid rgba(255,255,255,.85)", borderRadius: 99, background: "rgba(255,255,255,.55)", color: "#a86e84", fontSize: 9.5, fontWeight: 800, padding: "5px 10px" }}>⇄ {tr("換人", "Switch", "変更", "변경")}</button>
      </div>
      <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "2px 16px 28px" }}>

        {/* 關係頭部 */}
        <div style={{ textAlign: "center", padding: "8px 0 2px" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Avatar src={characterAvatar} fallback={character.name?.[0]} />
            <span style={{ margin: "0 -7px", zIndex: 1, fontSize: 20, filter: "drop-shadow(0 2px 4px rgba(200,80,110,.4))" }}>💗</span>
            <Avatar src={playerAvatar} fallback={playerName[0]} />
          </div>
          <div style={{ marginTop: 8, fontSize: 15, fontWeight: 900, color: "#7a4257", fontFamily: HAND_FONT }}>{character.name} ✕ {playerName}</div>
          <div style={{ marginTop: 3, fontSize: 10.5, color: "#a86e84" }}>{daysTogether
            ? tr(
                `開始互動的第 ${daysTogether} 天`,
                `Day ${daysTogether} together`,
                `交流を始めて ${daysTogether} 日目`,
                `함께한 지 ${daysTogether}일째`
              )
            : tr("故事還沒開始，先去打聲招呼吧", "Your story has not started yet. Go say hello.", "物語はまだ始まっていません。まずは挨拶してみましょう。", "아직 이야기가 시작되지 않았어요. 먼저 인사해 보세요.")}</div>
        </div>

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
          {daily?.milestones?.fullHeart && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(209,106,141,.18)", fontSize: 10.5, fontWeight: 900, color: "#c35f86" }}>✦ {tr("羈絆里程碑：心意滿格", "Bond milestone: Hearts full", "絆のマイルストーン：想いが満タン", "유대 이정표: 마음 가득")}</div>}
        </SectionCard>

        {/* 今日戀愛簽：玩家按了才抽，一天一支 */}
        <SectionCard>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 17 }}>🥠</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#7a4257" }}>{tr("今日戀愛簽", "Today's Love Fortune", "今日の恋みくじ", "오늘의 연애 운세")}</span>
            {daily?.sign?.text && <span style={{ marginLeft: "auto", fontSize: 9.5, color: "#c093a4" }}>{tr(`${signTime} 抽的`, `Drawn at ${signTime}`, `${signTime} に引きました`, `${signTime}에 뽑음`)}</span>}
          </div>
          {daily?.sign?.text ? (
            <div className={`couple-sign-result${signReveal ? " is-revealing" : ""}`}>
              <span className="couple-sign-moon-seal" aria-hidden="true" />
              <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                <span style={{ background: "linear-gradient(135deg,#f2c14e,#dd9f33)", color: "#fff", borderRadius: 8, padding: "2px 9px", fontSize: 10.5, fontWeight: 900 }}>{daily.sign.level}</span>
                <span style={{ ...GLASS, borderRadius: 8, padding: "2px 9px", fontSize: 10.5, fontWeight: 800, color: "#b05e75" }}>{daily.sign.tip}</span>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.85, color: "#6d3c50", marginTop: 8, fontFamily: HAND_FONT }}>「{daily.sign.text}」</div>
              <button type="button" disabled={!!daily.signSharedAt} onClick={() => shareToChat("sign")}
                style={{ marginTop: 9, border: 0, borderRadius: 10, padding: "7px 12px", fontSize: 10.5, fontWeight: 800, color: daily.signSharedAt ? "#a98b96" : "#fff", background: daily.signSharedAt ? "rgba(255,255,255,.72)" : "linear-gradient(135deg,#e88aaa,#c96f91)" }}>
                {daily.signSharedAt ? tr("已分享到聊天室", "Shared to chat", "チャットに共有済み", "채팅방에 공유됨") : tr("分享到聊天室", "Share to chat", "チャットに共有", "채팅방에 공유")}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
              {drawingSign ? <MoonlitFortuneStage characterName={character.name} tr={tr} /> : <>
                <div style={{ fontSize: 10.5, color: "#a86e84", marginBottom: 10 }}>{tr(`今天的籤還在籤筒裡，抽一支看看${character.name}想對你說什麼`, `Today's fortune is still waiting. Draw one to see what ${character.name} wants to tell you.`, `今日のおみくじはまだ筒の中。一本引いて、${character.name}が伝えたいことを見てみましょう。`, `오늘의 운세는 아직 통 안에 있어요. 하나 뽑아 ${character.name}이(가) 하고 싶은 말을 확인해 보세요.`)}</div>
                <button className="couple-sign-draw-btn" type="button" disabled={dailyLoading || !daily} onClick={drawSign}
                  style={{ border: 0, borderRadius: 14, padding: "9px 22px", fontSize: 12, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#f2b25e,#dd8f33)", boxShadow: "0 4px 14px rgba(220,150,60,.35)", opacity: dailyLoading || !daily ? .6 : 1 }}>
                  🌙 {tr("月下抽一支", "Draw under the moon", "月下で一本引く", "달빛 아래 뽑기")}
                </button>
              </>}
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

        {notice && <div style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#a2652f", marginTop: 10 }}>{notice}</div>}

        {/* 功能入口 */}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button type="button" onClick={() => setView("memories")}
            style={{ ...GLASS, flex: 1, borderRadius: 16, padding: "13px 10px", textAlign: "center", boxShadow: "0 5px 16px rgba(200,110,140,.13)" }}>
            <div style={{ fontSize: 19 }}>📖</div>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#7a4257", marginTop: 4 }}>{tr("我們的回憶", "Our Memories", "二人の思い出", "우리의 추억")}</div>
            <div style={{ fontSize: 9, color: "#a86e84", marginTop: 2 }}>{allMemories.length
              ? tr(`✦ ${allMemories.length} 段`, `✦ ${allMemories.length}`, `✦ ${allMemories.length}件`, `✦ ${allMemories.length}개`)
              : tr("還沒有", "None yet", "まだありません", "아직 없음")}</div>
          </button>
          <button type="button" disabled style={{ ...GLASS, flex: 1, borderRadius: 16, padding: "13px 10px", textAlign: "center", opacity: .55 }}>
            <div style={{ fontSize: 19 }}>🎁</div>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#7a4257", marginTop: 4 }}>{tr("交換禮物", "Exchange Gifts", "プレゼント交換", "선물 교환")}</div>
            <div style={{ fontSize: 9, color: "#a86e84", marginTop: 2 }}>{tr("即將推出", "Coming soon", "近日公開", "출시 예정")}</div>
          </button>
          <button type="button" disabled style={{ ...GLASS, flex: 1, borderRadius: 16, padding: "13px 10px", textAlign: "center", opacity: .55 }}>
            <div style={{ fontSize: 19 }}>🤞</div>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#7a4257", marginTop: 4 }}>{tr("約定", "Promises", "約束", "약속")}</div>
            <div style={{ fontSize: 9, color: "#a86e84", marginTop: 2 }}>{tr("即將推出", "Coming soon", "近日公開", "출시 예정")}</div>
          </button>
        </div>
      </div>
    </div>
  );
}

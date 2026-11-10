import React, { useMemo, useState } from "react";
import { tagLabel } from "../../data/dating/interestTags";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import matchHeart from "./assets/match-heart-rose.png";

/**
 * 信風配對成功（第六版）：整個 App 的高潮。
 * 信封打開 → 兩張拍立得從兩側飛入相遇 → 封蠟愛心蓋下、愛心從碰撞點爆開 → 手寫標題逐字寫出 →
 * 名字、共同興趣、開場白依序出現。傳訊息時整張信收合後才進聊天室。
 *
 * 共同興趣一定要顯示——延遲配對讓玩家很難察覺喜好有影響，這行字是他意識到「原來我的檔案有用」的機會。
 * 信風是獨立 App，配色固定（花店玫瑰為底、酒紅禮服點綴、粉紫雲霧背景、珍珠清透按鈕），不跟小手機主題變。
 * 所有粒子路徑固定、數量固定，不在重繪時改變。
 */

// 碰撞點爆開的愛心：角度、距離、大小固定，16 顆。
const BURST = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
  const distance = 118 + (i * 37 % 70);
  return {
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance * 0.8),
    size: [14, 18, 24, 30][i % 4],
    delay: 680 + (i * 23 % 120),
    spin: (i % 2 ? 1 : -1) * (12 + i * 7 % 30),
  };
});
// 之後慢慢飄的少量愛心
const AMBIENT = [9, 86, 23, 71, 52].map((x, i) => ({ x, size: 11 + (i * 3 % 8), delay: 2400 + i * 1100, duration: 7800 + i * 300, drift: (i % 2 ? 1 : -1) * 12 }));

// 開場白不用 AI：依共同興趣從句型庫隨機搭配，同一次配對用固定種子，重繪也不會換句子。
const TAG_LINES = [
  ["你也喜歡{t}嗎？", "You're into {t} too?", "{t}好きなんですか？", "{t} 좋아하세요?"],
  ["看到你也喜歡{t}，忍不住想打招呼！", "Saw you like {t} too, had to say hi!", "{t}が好きって見て、つい声をかけちゃいました！", "{t} 좋아하신다길래 인사하고 싶었어요!"],
  ["最近有什麼{t}的推薦嗎？", "Any {t} recommendations lately?", "最近おすすめの{t}ってありますか？", "요즘 추천할 만한 {t} 있어요?"],
  ["{t}是我們的共同點耶，你是怎麼開始的？", "{t} is our thing! How did you get into it?", "{t}が共通点ですね。きっかけは何でした？", "{t}가 우리 공통점이네요. 어떻게 시작했어요?"],
];
const GENERIC_LINES = [
  ["嗨 {n}，很高興認識你！", "Hi {n}, nice to meet you!", "{n}さん、はじめまして！", "{n}님, 반가워요!"],
  ["今天過得怎麼樣？", "How's your day going?", "今日はどんな一日でした？", "오늘 하루 어땠어요?"],
  ["配對成功！先從自我介紹開始好嗎？", "We matched! Want to start with intros?", "マッチしましたね！まずは自己紹介から？", "매치됐네요! 자기소개부터 할까요?"],
  ["你的照片好有感覺，是在哪裡拍的？", "Love your photo. Where was it taken?", "写真すてきですね。どこで撮ったんですか？", "사진 분위기 좋네요. 어디서 찍었어요?"],
];

function seeded(seedText) {
  let h = 2166136261;
  for (const ch of String(seedText)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
}

export function buildMatchOpeners(match, tr, name) {
  const random = seeded(match?.profileId || name || "tradewind");
  const fill = (row, vars) => {
    const line = typeof tr === "function" ? tr(...row) : row[0];
    return line.replaceAll("{t}", vars.t || "").replaceAll("{n}", vars.n || "");
  };
  const lines = [];
  const tags = [...(match?.shared || [])].sort(() => random() - 0.5).slice(0, 2);
  const usedRows = new Set();
  for (const tag of tags) {
    let row = TAG_LINES[Math.floor(random() * TAG_LINES.length)];
    if (usedRows.has(row)) row = TAG_LINES[(TAG_LINES.indexOf(row) + 1) % TAG_LINES.length];
    usedRows.add(row);
    lines.push(fill(row, { t: tagLabel(tag, tr) }));
  }
  const generic = [...GENERIC_LINES].sort(() => random() - 0.5);
  while (lines.length < 2) lines.push(fill(generic.shift(), { n: name }));
  return lines;
}

const Heart = () => <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 28C12 24.4 3 18.2 3 10.8 3 3.7 11.5 1.4 16 7.6 20.5 1.4 29 3.7 29 10.8 29 18.2 20 24.4 16 28Z" fill="currentColor" /></svg>;

function Polaroid({ src, fallback, label, side }) {
  const safe = sanitizeUserImageUrl(src);
  return (
    <div className={`dtm-polaroid ${side}`}>
      <div className="dtm-photo">{safe ? <img src={safe} alt="" /> : <span className="dtm-initial">{fallback || "?"}</span>}</div>
      <span>{label}</span>
    </div>
  );
}

export default function MatchCelebration({ match, entry, playerPhoto, playerName, onOpenChat, onKeepSwiping, tr }) {
  const [leaving, setLeaving] = useState(false);
  const [custom, setCustom] = useState("");
  const text = (zhTW, en, ja, ko) => (typeof tr === "function" ? tr(zhTW, en, ja, ko) : zhTW);
  const name = entry?.profile?.name || "";
  const openers = useMemo(() => buildMatchOpeners(match, tr, name), [match, tr, name]);
  if (!match || !entry) return null;
  const playerLabel = playerName || text("你", "You", "あなた", "나");
  const backdrop = sanitizeUserImageUrl(entry.profile.photos?.[0]);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const openChat = (draft) => {
    if (leaving) return;
    if (reducedMotion) { onOpenChat?.(draft); return; }
    setLeaving(true);
    // 收合動畫 360ms 後才真正切到聊天室
    setTimeout(() => onOpenChat?.(draft), 360);
  };
  const titleChars = Array.from(text("配對成功", "It's a match", "マッチしました", "매치 성공"));
  return (
    <div key={match.profileId} className={`dtm ${leaving ? "is-leaving" : ""}`} role="dialog" aria-modal="true" aria-label={text("配對成功", "It's a match", "マッチしました", "매치 성공")}>
      <div className="dtm-backdrop" aria-hidden="true">{backdrop && <img src={backdrop} alt="" />}</div>
      <div className="dtm-ambient" aria-hidden="true">
        {AMBIENT.map((h, i) => <span key={i} style={{ left: `${h.x}%`, width: h.size, animationDelay: `${h.delay}ms`, animationDuration: `${h.duration}ms`, "--drift": `${h.drift}px` }}><Heart /></span>)}
      </div>
      <div className="dtm-scroll">
      <div className="dtm-letter">
        <div className="dtm-flap" aria-hidden="true" />
        {match.superLike && <div className="dtm-super">★ {text("你的 Super Like 有回應了", "Your Super Like got a response", "Super Like に応答がありました", "Super Like에 응답이 왔어요")}</div>}
        <div className="dtm-kicker">{text("信風為你們捎來一封信", "Tradewind brought you a note", "信風がふたりに便りを届けました", "신풍이 두 사람에게 편지를 전했어요")}</div>
        <div className="dtm-title" aria-hidden="true">{titleChars.map((ch, i) => <span key={i} style={{ animationDelay: `${860 + i * 110}ms` }}>{ch}</span>)}</div>
        <div className="dtm-stage">
          <Polaroid src={entry.profile.photos?.[0]} fallback={name?.[0]} label={name} side="left" />
          <Polaroid src={playerPhoto} fallback={playerLabel[0]} label={playerLabel} side="right" />
          <div className="dtm-burst" aria-hidden="true">
            {BURST.map((h, i) => <span key={i} style={{ width: h.size, animationDelay: `${h.delay}ms`, "--x": `${h.x}px`, "--y": `${h.y}px`, "--spin": `${h.spin}deg` }}><Heart /></span>)}
          </div>
          <div className="dtm-ring" aria-hidden="true" />
          <div className="dtm-seal" aria-hidden="true"><img src={matchHeart} alt="" draggable={false} /></div>
        </div>
        <div className="dtm-name">{text(`你和 ${name} 互相喜歡`, `You and ${name} like each other`, `${name}さんと気が合いました`, `${name}님과 서로 마음이 통했어요`)}</div>
        {match.shared?.length > 0 && (
          <div className="dtm-shared" aria-label={text("你們的共同興趣", "Your shared interests", "ふたりの共通の趣味", "두 사람의 공통 관심사")}>
            {match.shared.map((tag, i) => <span key={tag} className="dtm-tag" style={{ animationDelay: `${1180 + i * 70}ms` }}>{tagLabel(tag, tr)}</span>)}
          </div>
        )}
        <div className="dtm-openers">
          <span className="dtm-openers-label">{text("用一句話開始", "Start with one line", "ひとことから始めよう", "한마디로 시작해요")}</span>
          {openers.map((line, i) => (
            <button key={line} type="button" className="dtm-opener" style={{ animationDelay: `${1320 + i * 90}ms` }} onClick={() => openChat(line)}>{line}</button>
          ))}
          <form className="dtm-opener dtm-custom" style={{ animationDelay: "1500ms" }} onSubmit={(event) => { event.preventDefault(); if (custom.trim()) openChat(custom.trim()); }}>
            <input value={custom} onChange={(event) => setCustom(event.target.value)} maxLength={120} placeholder={text("自己寫一句…", "Write your own…", "自分で書く…", "직접 쓰기…")} aria-label={text("自訂第一句話", "Your own first message", "最初のひとことを自分で書く", "첫 메시지 직접 쓰기")} />
            <button type="submit" disabled={!custom.trim()} aria-label={text("送出並開始聊天", "Send and start chatting", "送ってチャットを始める", "보내고 채팅 시작")}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 12l15-7-5 15-2.5-6.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
            </button>
          </form>
        </div>
        <div className="dtm-actions">
          <button type="button" className="dtm-btn primary" onClick={() => openChat("")}>{text("傳訊息", "Send a message", "メッセージする", "메시지 보내기")}</button>
          <button type="button" className="dtm-btn ghost" onClick={onKeepSwiping}>{text("繼續探索", "Keep exploring", "探索を続ける", "계속 둘러보기")}</button>
        </div>
      </div>
      </div>
    </div>
  );
}

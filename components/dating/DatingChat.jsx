import React, { useEffect, useRef, useState } from "react";
import { contactProgress } from "../../services/dating/datingMatching";
import { pendingUserMessages, presenceLabel } from "../../services/dating/datingPresence";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import useAutoResizeTextarea from "../../hooks/chat/useAutoResizeTextarea";
import BackButton from "../common/BackButton";

const uiLocale = () => (typeof document !== "undefined" && document.documentElement.lang) || "zh-TW";
const clock = (time) => new Date(time).toLocaleTimeString(uiLocale(), { hour: "2-digit", minute: "2-digit" });
const localDay = (time) => new Date(time).toDateString();

/** 換日分隔線：今天／昨天，其餘依介面語言顯示日期（跨年才帶年份）。 */
function dayLabel(time, text) {
  const date = new Date(time);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return text("今天", "Today", "今日", "오늘");
  if (date.toDateString() === yesterday.toDateString()) return text("昨天", "Yesterday", "昨日", "어제");
  const options = date.getFullYear() === today.getFullYear()
    ? { month: "long", day: "numeric", weekday: "short" }
    : { year: "numeric", month: "long", day: "numeric" };
  try {
    return new Intl.DateTimeFormat(uiLocale(), options).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export default function DatingChat({ entry, relation, typing, blocked, onBack, onSend, onRetry, onPromote, onOpenContact, onOpenProfile, tr, initialDraft = "" }) {
  // 從配對成功畫面選了開場白時，帶進輸入框讓玩家確認後再送出。
  const [draft, setDraft] = useState(initialDraft);
  const endRef = useRef(null);
  const inputRef = useAutoResizeTextarea(draft, 96); // 96 對齊 .dt-chat-input 的 max-height
  const messages = relation?.messages || [];
  const progress = contactProgress(entry, relation);
  const promoted = !!relation?.contactCharId;
  const lastReply = [...messages].reverse().find((item) => item.role === "assistant");
  const text = (zhTW, en, ja, ko) => (typeof tr === "function" ? tr(zhTW, en, ja, ko) : zhTW);
  const presence = presenceLabel(entry, Date.now(), lastReply?.time, text);
  const waiting = !presence.online && pendingUserMessages(messages).length > 0;
  // 回覆失敗不會自動重試（避免背景反覆呼叫 API），要玩家自己按。
  const failed = !!relation?.replyFailedAt && !typing && !promoted && !blocked;
  const name = entry.profile.name;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, typing]);

  const send = () => {
    const text = draft.trim();
    if (!text || typing || promoted) return;
    setDraft("");
    onSend(text);
  };
  const photo = sanitizeUserImageUrl(entry.profile.photos?.[0]);

  return (
    <div className="dt-chat">
      <div className="dt-chat-hdr">
        <BackButton onClick={onBack} label={text("返回配對列表", "Back to matches", "マッチ一覧に戻る", "매칭 목록으로 돌아가기")} />
        {/* 配對之後卡片就從牌堆消失了，這裡是唯一還看得到對方檔案的入口 */}
        <button type="button" className="dt-chat-who" onClick={onOpenProfile}>
          <div className="dt-chat-av">{photo ? <img src={photo} alt="" /> : entry.profile.name?.[0]}</div>
          <div className="dt-chat-who-text">
            <div className="dt-chat-name">{entry.profile.name}<span className="dt-chat-chev">›</span></div>
            {/* 沒有這行的話，玩家等不到回覆會以為 App 壞了 */}
            <div className={`dt-chat-presence ${presence.online ? "on" : ""}`}>{presence.text}</div>
          </div>
        </button>
        {promoted && <button type="button" className="dt-chat-badge" onClick={onOpenContact}>{text("已加入聯絡人", "In contacts", "連絡先に追加済み", "연락처에 추가됨")}</button>}
      </div>

      <div className="dt-chat-scroll">
        <div className="dt-chat-note">{promoted
          ? text(
            "你們已交換聯絡方式，這段信風對話已封存。",
            "You've exchanged contact details. This Tradewind conversation is now archived.",
            "連絡先を交換したため、この信風の会話はアーカイブされました。",
            "연락처를 교환해 이 신풍 대화는 보관되었습니다.",
          )
          : text(
            "你們在信風上配對成功。這裡的對話跟聊天 App 是分開的。",
            "You matched on Tradewind. This conversation is separate from the Chat app.",
            "信風でマッチしました。ここでの会話はチャットアプリとは別です。",
            "신풍에서 매칭됐어요. 이 대화는 채팅 앱과 따로 관리돼요.",
          )}</div>
        {messages.map((message, index) => {
          // 跨天時插一條日期線：加聯絡人的門檻算的是「聊了幾天」，玩家要看得出天數。
          const newDay = index === 0 || localDay(messages[index - 1].time) !== localDay(message.time);
          return (
            <React.Fragment key={message.id}>
              {newDay && <div className="dt-chat-note dt-chat-day">{dayLabel(message.time, text)}</div>}
              <div className={`dt-msg ${message.role === "user" ? "me" : "them"}`}>
                <div className="dt-msg-bubble">{message.content}</div>
                <div className="dt-msg-time">{clock(message.time)}</div>
              </div>
            </React.Fragment>
          );
        })}
        {!promoted && typing && <div className="dt-msg them"><div className="dt-msg-bubble typing"><i /><i /><i /></div></div>}
        {/* 只講「不在線上」，不預告幾點回來——作息要玩家自己觀察出來 */}
        {!promoted && waiting && !typing && !failed && <div className="dt-chat-note">{text(`訊息已送出。${name}目前不在線上。`, `Message sent. ${name} is offline right now.`, `メッセージを送信しました。${name}は今オフラインです。`, `메시지를 보냈어요. ${name}님은 지금 오프라인이에요.`)}</div>}
        <div ref={endRef} />
      </div>

      {/* 門檻是隱性的：沒到就什麼都不顯示，到了突然出現，是驚喜而不是進度達成。 */}
      {progress.ready && !promoted && !blocked && (
        <div className="dt-chat-promote">
          <div className="dt-chat-promote-t">{text("聊得差不多了", "You two are hitting it off", "いい感じに話せてきました", "대화가 꽤 무르익었어요")}</div>
          <button type="button" className="dt-chat-promote-btn" onClick={onPromote}>{text("交換聯絡方式", "Exchange contacts", "連絡先を交換", "연락처 교환하기")}</button>
        </div>
      )}

      {failed && (
        <div className="dt-chat-blocked">
          {text("對方的回覆沒有送達。", "The reply didn't come through.", "返信が届きませんでした。", "답장이 도착하지 않았어요.")}
          <button type="button" onClick={onRetry}>{text("重試", "Retry", "再試行", "다시 시도")}</button>
        </div>
      )}

      {/* 交換聯絡方式後，信風歷史保留但不再接受任何新訊息。 */}
      {promoted ? (
        <div className="dt-chat-promote">
          <div className="dt-chat-promote-t">{text("已交換聯絡方式", "Contact details exchanged", "連絡先を交換しました", "연락처를 교환했어요")}</div>
          <div className="dt-chat-note">{text(
            "後續訊息請到聊天 App 繼續，這裡會保留原本的配對紀錄。",
            "Continue in Chat. Your original match history will remain here.",
            "続きはチャットアプリで。このマッチの履歴はここに残ります。",
            "이어서 할 대화는 채팅 앱에서 나눠주세요. 기존 매칭 기록은 여기에 남습니다.",
          )}</div>
          <button type="button" className="dt-chat-promote-btn" onClick={onOpenContact}>{text("前往聊天", "Open Chat", "チャットを開く", "채팅 열기")}</button>
        </div>
      ) : blocked ? (
        <div className="dt-chat-blocked">
          {text("你已封鎖這個人，雙方無法再傳訊息。", "You blocked this person. Neither of you can send messages.", "この人をブロックしています。お互いにメッセージを送れません。", "이 사람을 차단했어요. 서로 메시지를 보낼 수 없어요.")}
          <button type="button" onClick={onOpenProfile}>{text("解除封鎖", "Unblock", "ブロック解除", "차단 해제")}</button>
        </div>
      ) : (
        <div className="dt-chat-composer">
          {/* Enter 是換行，跟聊天室一致；送出只走按鈕。高度隨字數自動長高，跟聊天室同一套 hook。 */}
          <textarea
            ref={inputRef} className="dt-chat-input" value={draft} maxLength={800} rows={1} placeholder={typing ? text("對方正在輸入⋯", "Typing…", "入力中…", "입력 중…") : text("傳個訊息", "Send a message", "メッセージを送る", "메시지 보내기")}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="button" className="dt-chat-send" disabled={!draft.trim() || !!typing} onClick={send} aria-label={text("傳送", "Send", "送信", "보내기")}>➤</button>
        </div>
      )}
    </div>
  );
}

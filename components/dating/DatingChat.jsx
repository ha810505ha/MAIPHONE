import React, { useEffect, useRef, useState } from "react";
import { contactProgress } from "../../services/dating/datingMatching";
import { pendingUserMessages, presenceLabel } from "../../services/dating/datingPresence";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import useAutoResizeTextarea from "../../hooks/chat/useAutoResizeTextarea";

const clock = (time) => new Date(time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });

export default function DatingChat({ entry, relation, typing, blocked, onBack, onSend, onPromote, onOpenContact, onOpenProfile }) {
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);
  const inputRef = useAutoResizeTextarea(draft, 96); // 96 對齊 .dt-chat-input 的 max-height
  const messages = relation?.messages || [];
  const progress = contactProgress(entry, relation);
  const promoted = !!relation?.contactCharId;
  const lastReply = [...messages].reverse().find((item) => item.role === "assistant");
  const presence = presenceLabel(entry, Date.now(), lastReply?.time);
  const waiting = !presence.online && pendingUserMessages(messages).length > 0;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, typing]);

  const send = () => {
    const text = draft.trim();
    if (!text || typing) return;
    setDraft("");
    onSend(text);
  };
  const photo = sanitizeUserImageUrl(entry.profile.photos?.[0]);

  return (
    <div className="dt-chat">
      <div className="dt-chat-hdr">
        <button type="button" className="dt-chat-back" onClick={onBack}>←</button>
        {/* 配對之後卡片就從牌堆消失了，這裡是唯一還看得到對方檔案的入口 */}
        <button type="button" className="dt-chat-who" onClick={onOpenProfile}>
          <div className="dt-chat-av">{photo ? <img src={photo} alt="" /> : entry.profile.name?.[0]}</div>
          <div className="dt-chat-who-text">
            <div className="dt-chat-name">{entry.profile.name}<span className="dt-chat-chev">›</span></div>
            {/* 沒有這行的話，玩家等不到回覆會以為 App 壞了 */}
            <div className={`dt-chat-presence ${presence.online ? "on" : ""}`}>{presence.text}</div>
          </div>
        </button>
        {promoted && <button type="button" className="dt-chat-badge" onClick={onOpenContact}>已加入聯絡人</button>}
      </div>

      <div className="dt-chat-scroll">
        <div className="dt-chat-note">你們在信風上配對成功。這裡的對話跟聊天 App 是分開的。</div>
        {messages.map((message) => (
          <div key={message.id} className={`dt-msg ${message.role === "user" ? "me" : "them"}`}>
            <div className="dt-msg-bubble">{message.content}</div>
            <div className="dt-msg-time">{clock(message.time)}</div>
          </div>
        ))}
        {typing && <div className="dt-msg them"><div className="dt-msg-bubble typing"><i /><i /><i /></div></div>}
        {/* 只講「不在線上」，不預告幾點回來——作息要玩家自己觀察出來 */}
        {waiting && !typing && <div className="dt-chat-note">訊息已送出。{entry.profile.name}目前不在線上。</div>}
        <div ref={endRef} />
      </div>

      {/* 門檻是隱性的：沒到就什麼都不顯示，到了突然出現，是驚喜而不是進度達成。 */}
      {progress.ready && !promoted && !blocked && (
        <div className="dt-chat-promote">
          <div className="dt-chat-promote-t">聊得差不多了</div>
          <button type="button" className="dt-chat-promote-btn" onClick={onPromote}>交換聯絡方式</button>
        </div>
      )}

      {/* 封鎖只凍結交友軟體這條線；已加入聯絡人的聊天室不受影響 */}
      {blocked ? (
        <div className="dt-chat-blocked">
          你已封鎖這個人，雙方無法再傳訊息。
          <button type="button" onClick={onOpenProfile}>解除封鎖</button>
        </div>
      ) : (
        <div className="dt-chat-composer">
          {/* Enter 是換行，跟聊天室一致；送出只走按鈕。高度隨字數自動長高，跟聊天室同一套 hook。 */}
          <textarea
            ref={inputRef} className="dt-chat-input" value={draft} maxLength={800} rows={1} placeholder={typing ? "對方正在輸入⋯" : "傳個訊息"}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="button" className="dt-chat-send" disabled={!draft.trim() || !!typing} onClick={send}>➤</button>
        </div>
      )}
    </div>
  );
}

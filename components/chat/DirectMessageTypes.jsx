import React from "react";

export function SystemNoticeMessage({ message, share, connectionError, active, isTyping, onLongPressStart, onLongPressEnd, onRetry, onDelete, applyUserPlaceholder, tr }) {
  return <div className="mp-msg-note-wrap"><div className="mp-msg-note" onPointerDown={onLongPressStart} onPointerUp={onLongPressEnd} onPointerLeave={onLongPressEnd}>{share ? <div style={{ textAlign: "left" }}><div style={{ fontWeight: 700, marginBottom: 4 }}>{tr("社群分享", "Social share", "SNS共有", "소셜 공유")}</div><div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginBottom: 6 }}>{tr("來源：", "Source: ", "出典: ", "출처: ")}{share.meta.source || "-"}</div><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: 180, overflowY: "auto", paddingRight: 2 }}>{applyUserPlaceholder(share.body)}</div></div> : <div><div>{message.content}</div>{connectionError && <button className="mp-retry-btn" disabled={isTyping} onClick={(event) => { event.stopPropagation(); onRetry(); }}>重新生成</button>}</div>}</div>{active && <button className="mp-msg-editbtn" onClick={onDelete}>🗑</button>}</div>;
}

export function TransferMessage({ message, active, onToggle, onDelete, formatMoney, tr }) {
  const fromName = message.fromType === "player" ? tr("你", "You", "あなた", "당신") : (message.fromName || tr("對方", "The other party", "相手", "상대방"));
  const toName = message.toType === "player" ? tr("你", "You", "あなた", "당신") : (message.toName || tr("對方", "The other party", "相手", "상대방"));
  const heading = message.fromType === "player" ? `${tr("你", "You", "あなた", "당신")} ${tr("轉帳給", "transfer to", "送金先", "송금 대상")} ${toName}` : `${fromName} ${tr("轉帳給", "transfer to", "送金先", "송금 대상")} ${tr("你", "You", "あなた", "당신")}`;
  return <div className="mp-msg-wrap mp-msg-wrap-transfer"><div className="mp-msg mp-transfer-card" onClick={onToggle}><div className="mp-transfer-success"><div className="mp-transfer-check">✓</div><div className="mp-transfer-success-text">{tr("轉帳成功", "Transfer successful", "送金成功", "송금 성공")}</div></div><div className="mp-transfer-line">{heading}</div><div className="mp-transfer-meta"><div className="mp-transfer-row"><span className="mp-transfer-k">{tr("轉帳金額", "Amount", "金額", "금액")}</span><span className="mp-transfer-v">${formatMoney(message.amount || 0)}</span></div><div className="mp-transfer-row"><span className="mp-transfer-k">{tr("轉帳日期", "Date", "日付", "날짜")}</span><span className="mp-transfer-v">{new Date(message.time).toLocaleDateString("zh-TW")}</span></div></div><div className="mp-transfer-note">{message.note ? `${tr("備註", "Note", "メモ", "메모")}：${message.note}` : tr("無備註", "No note", "メモなし", "메모 없음")}</div><div className="mp-transfer-footer"><span>{new Date(message.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span><span className="mp-transfer-status">{message.fromType === "player" ? tr("已送出", "Sent", "送信済み", "전송됨") : tr("已收到", "Received", "受信済み", "받음")}</span></div></div>{active && <button className="mp-msg-editbtn" onClick={onDelete}>🗑</button>}</div>;
}

export function RealityChatMessage({ message, isUser, active, highlighted, displayContent, renderedContent, innerThought, voiceAction, onToggle, onEdit }) {
  return (
    <div data-message-id={message.id} className={`mp-reality-wrap ${isUser ? "mp-reality-user" : "mp-reality-ai"} ${highlighted ? "mp-thought-jump-highlight" : ""}`}>
      {isUser && <button className={`mp-msg-editbtn ${active ? "" : "mp-msg-editbtn-hidden"}`} onClick={onEdit}>✎</button>}
      <div className={`mp-thought-stack ${isUser ? "mp-thought-stack-user" : ""}`}>
        <div className="mp-reality-msg" onClick={onToggle}>
          {message.image && <img src={`data:image/png;base64,${message.image}`} className="mp-msg-img" alt="" />}
          {displayContent && renderedContent}
          {isUser && <div className="mp-reality-t">{new Date(message.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</div>}
        </div>
        {!isUser && <div className="mp-reality-footer"><span className="mp-reality-t">{new Date(message.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span>{active && <button className="mp-msg-editbtn" onClick={onEdit}>✎</button>}{voiceAction}</div>}
        {!isUser && innerThought}
      </div>
    </div>
  );
}

export function OnlineChatMessage({ message, isUser, active, highlighted, displayContent, innerThought, voiceAction, onToggle, onEdit }) {
  return <div data-message-id={message.id} className={`mp-msg-wrap ${isUser ? "mp-msg-wrap-user" : "mp-msg-wrap-ai"} ${highlighted ? "mp-thought-jump-highlight" : ""}`}>{isUser && <button className={`mp-msg-editbtn ${active ? "" : "mp-msg-editbtn-hidden"}`} onClick={onEdit}>✎</button>}<div className={`mp-thought-stack ${isUser ? "mp-thought-stack-user" : ""}`}><div className={`mp-msg ${isUser ? "mp-msg-user" : "mp-msg-ai"}`} onClick={onToggle}>{message.image && <img src={`data:image/png;base64,${message.image}`} className="mp-msg-img" alt="" />}{displayContent && <div>{displayContent}</div>}<div className="mp-msg-t">{new Date(message.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</div></div>{!isUser && innerThought}</div>{!isUser && <button className={`mp-msg-editbtn ${active ? "" : "mp-msg-editbtn-hidden"}`} onClick={onEdit}>✎</button>}{!isUser && voiceAction}</div>;
}

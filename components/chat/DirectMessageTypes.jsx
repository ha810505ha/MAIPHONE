import React, { useRef } from "react";
import PseudoImageBubble from "./PseudoImageBubble";
import PseudoVoiceBubble from "./PseudoVoiceBubble";
import { toImageDataUrl } from "../../utils/imagePayload.js";

export function SystemNoticeMessage({ message, share, connectionError, active, isTyping, onLongPressStart, onLongPressEnd, onToggle, onRetry, onDelete, applyUserPlaceholder, tr }) {
  const pointerDownAtRef = useRef(0);
  return <div className="mp-msg-note-wrap"><div className="mp-msg-note"
    onPointerDown={() => { pointerDownAtRef.current = Date.now(); onLongPressStart(); }}
    onPointerUp={onLongPressEnd}
    onPointerCancel={onLongPressEnd}
    onPointerLeave={onLongPressEnd}
    onClick={() => {
      const heldFor = Date.now() - pointerDownAtRef.current;
      pointerDownAtRef.current = 0;
      if (heldFor < 400) onToggle?.();
    }}
  >{share ? <div style={{ textAlign: "left" }}><div style={{ fontWeight: 700, marginBottom: 4 }}>{tr("社群分享", "Social share", "SNS共有", "소셜 공유")}</div><div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginBottom: 6 }}>{tr("來源：", "Source: ", "出典: ", "출처: ")}{share.meta.source || "-"}</div><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: 180, overflowY: "auto", paddingRight: 2 }}>{applyUserPlaceholder(share.body)}</div></div> : <div><div>{message.content}</div>{connectionError && <button className="mp-retry-btn" disabled={isTyping} onClick={(event) => { event.stopPropagation(); onRetry(); }}>重新生成</button>}</div>}</div>{active && <button className="mp-msg-editbtn" onClick={onDelete}>🗑</button>}</div>;
}

export function TransferMessage({ message, transfer, active, onToggle, onDelete, onAccept, onReturn, formatMoney, tr }) {
  const fromName = message.fromType === "player" ? tr("你", "You", "あなた", "당신") : (message.fromName || tr("對方", "The other party", "相手", "상대방"));
  const toName = message.toType === "player" ? tr("你", "You", "あなた", "당신") : (message.toName || tr("對方", "The other party", "相手", "상대방"));
  const heading = message.fromType === "player" ? `${tr("你", "You", "あなた", "당신")} ${tr("轉帳給", "transfer to", "送金先", "송금 대상")} ${toName}` : `${fromName} ${tr("轉帳給", "transfer to", "送金先", "송금 대상")} ${tr("你", "You", "あなた", "당신")}`;
  const status = transfer?.status || "accepted";
  const statusText = status === "pending" ? tr("等待收下", "Awaiting response", "受取待ち", "수락 대기 중")
    : status === "accepted" ? tr("已收下", "Accepted", "受取済み", "수락됨")
      : status === "expired" ? tr("逾期退回", "Expired and returned", "期限切れで返金", "만료되어 반환됨")
        : tr("已退回", "Returned", "返金済み", "반환됨");
  const isIncomingPending = status === "pending" && message.toType === "player";
  return <div className="mp-msg-wrap mp-msg-wrap-transfer"><div className="mp-msg mp-transfer-card" onClick={onToggle}><div className="mp-transfer-success"><div className="mp-transfer-check">{status === "accepted" ? "✓" : status === "pending" ? "…" : "↩"}</div><div className="mp-transfer-success-text">{statusText}</div></div><div className="mp-transfer-line">{heading}</div><div className="mp-transfer-meta"><div className="mp-transfer-row"><span className="mp-transfer-k">{tr("轉帳金額", "Amount", "金額", "금액")}</span><span className="mp-transfer-v">${formatMoney(message.amount || 0)}</span></div><div className="mp-transfer-row"><span className="mp-transfer-k">{tr("轉帳日期", "Date", "日付", "날짜")}</span><span className="mp-transfer-v">{new Date(message.time).toLocaleDateString("zh-TW")}</span></div></div><div className="mp-transfer-note">{message.note ? `${tr("備註", "Note", "メモ", "메모")}：${message.note}` : tr("無備註", "No note", "メモなし", "메모 없음")}</div>{isIncomingPending && <div style={{display:"flex",gap:8,marginTop:10}}><button className="mp-save" style={{flex:1}} onClick={(event)=>{event.stopPropagation();onAccept?.();}}>{tr("收下", "Accept", "受け取る", "받기")}</button><button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={(event)=>{event.stopPropagation();onReturn?.();}}>{tr("退回", "Return", "返す", "돌려주기")}</button></div>}<div className="mp-transfer-footer"><span>{new Date(message.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span><span className="mp-transfer-status">{statusText}</span></div></div>{active && status !== "pending" && <button className="mp-msg-editbtn" onClick={onDelete}>🗑</button>}</div>;
}

export function RealityChatMessage({ message, isUser, active, highlighted, displayContent, renderedContent, innerThought, thinking, voiceAction, onToggle, onEdit }) {
  return (
    <div data-message-id={message.id} className={`mp-reality-wrap ${isUser ? "mp-reality-user" : "mp-reality-ai"} ${highlighted ? "mp-thought-jump-highlight" : ""}`}>
      {isUser && <button className={`mp-msg-editbtn ${active ? "" : "mp-msg-editbtn-hidden"}`} onClick={onEdit}>✎</button>}
      <div className={`mp-thought-stack ${isUser ? "mp-thought-stack-user" : ""}`}>
        {!isUser && thinking}
        <div className="mp-reality-msg" onClick={onToggle}>
          {message.image && <img src={toImageDataUrl(message.image, message.imageMime)} className="mp-msg-img" alt="" />}
          {message.pseudoImage && <PseudoImageBubble pseudoImage={message.pseudoImage} />}
          {displayContent && renderedContent}
          {isUser && <div className="mp-reality-t">{new Date(message.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</div>}
        </div>
        {!isUser && <div className="mp-reality-footer"><span className="mp-reality-t">{new Date(message.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}{message.ttsGeneratedAt && <span className="mp-msg-tts-mark" title="曾生成語音" aria-label="曾生成語音">🔊</span>}</span>{active && <button className="mp-msg-editbtn" onClick={onEdit}>✎</button>}{voiceAction}</div>}
        {!isUser && innerThought}
      </div>
    </div>
  );
}

export function OnlineChatMessage({ message, isUser, active, highlighted, displayContent, innerThought, thinking, voiceAction, voicePlayback, onToggle, onEdit, tr }) {
  const intercepted = (!isUser && message.interceptedByBlock === true) || (isUser && message.interceptedByCharacterBlock === true);
  const interceptedLabel = isUser ? "傳送失敗 · 對方已封鎖你" : "已攔截 · 無法確認送達";
  return <div data-message-id={`${message.id}`} className={`mp-msg-wrap ${isUser ? "mp-msg-wrap-user" : "mp-msg-wrap-ai"} ${intercepted ? "mp-msg-wrap-intercepted" : ""} ${highlighted ? "mp-thought-jump-highlight" : ""}`}>{isUser && <button className={`mp-msg-editbtn ${active ? "" : "mp-msg-editbtn-hidden"}`} onClick={onEdit}>✎</button>}<div className={`mp-thought-stack ${isUser ? "mp-thought-stack-user" : ""}`}>{!isUser && thinking}<div className={`mp-msg-delivery-row ${isUser ? "is-user" : ""}`}>{isUser && intercepted && <span className="mp-msg-intercepted-mark" title={interceptedLabel}>!</span>}<div className={`mp-msg ${isUser ? "mp-msg-user" : "mp-msg-ai"}`} onClick={onToggle}>{message.image && <img src={toImageDataUrl(message.image, message.imageMime)} className="mp-msg-img" alt="" />}{message.pseudoImage && <PseudoImageBubble pseudoImage={message.pseudoImage} />}{message.pseudoVoice && <PseudoVoiceBubble pseudoVoice={message.pseudoVoice} playback={voicePlayback} tr={tr} />}{displayContent && !message.pseudoVoice && <div>{displayContent}</div>}<div className="mp-msg-t">{new Date(message.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}{!isUser && message.ttsGeneratedAt && <span className="mp-msg-tts-mark" title="曾生成語音" aria-label="曾生成語音">🔊</span>}</div></div>{!isUser && intercepted && <span className="mp-msg-intercepted-mark" title={interceptedLabel}>!</span>}</div>{intercepted && <div className="mp-msg-intercepted-label">{interceptedLabel}</div>}{!isUser && innerThought}</div>{!isUser && <button className={`mp-msg-editbtn ${active ? "" : "mp-msg-editbtn-hidden"}`} onClick={onEdit}>✎</button>}{!isUser && voiceAction}</div>;
}

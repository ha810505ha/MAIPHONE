import React, { useState } from "react";
import { ArrowDown } from "lucide-react";
import PseudoImageBubble from "./PseudoImageBubble";
import PseudoImagePicker from "./PseudoImagePicker";
import PhotoSourceChooser from "./PhotoSourceChooser";
import { pseudoImageStyle } from "../../utils/pseudoImage";
import useAutoResizeTextarea from "../../hooks/chat/useAutoResizeTextarea";
import PlayerPersonaIndicator from "./PlayerPersonaIndicator";

export default function GroupChatContent({ messages, isTyping, activeMessageId, setActiveMessageId, playerAvatar, playerProfile, persona, resolveSpeakerAvatar, chatMsgsRef, messagesEndRef, onScroll, isConnectionErrorNotice, onRetry, onEdit, onDelete, showScrollToBottom, onScrollToBottom, chatImage, onClearImage, chatPseudoImage, onSetPseudoImage, actionPanelOpen, setActionPanelOpen, fileInputRef, onImageUpload, chatInput, setChatInput, onSend, tr }) {
  const [pseudoPickerOpen, setPseudoPickerOpen] = useState(false);
  const [photoChooserOpen, setPhotoChooserOpen] = useState(false);
  const inputRef = useAutoResizeTextarea(chatInput);
  return (
    <>
      <div className="mp-cr" style={{ flex: 1, minHeight: 0 }}>
        <div className="mp-msgs" ref={chatMsgsRef} style={{ flex: 1, minHeight: 0, paddingBottom: 12 }} onScroll={(event) => onScroll(event.currentTarget)}>
          {messages.map((message) => {
            if (message.role === "system_notice") return <div key={message.id} className="mp-msg-note-wrap"><div className="mp-msg-note"><div>{message.content}</div>{isConnectionErrorNotice(message.content) && <button className="mp-retry-btn" disabled={isTyping} onClick={(event) => { event.stopPropagation(); onRetry(message.id); }}>{tr("重新生成", "Regenerate", "再生成", "다시 생성")}</button>}</div></div>;
            const speakerAvatar = message.role === "user" ? playerAvatar : resolveSpeakerAvatar?.(message);
            return <div key={message.id} className={`mp-msg-wrap ${message.role === "user" ? "mp-msg-wrap-user mp-group-msg-wrap-user" : "mp-msg-wrap-ai mp-group-msg-wrap-ai"}`}>
              <div className="mp-group-msg-meta"><div className="mp-group-msg-avatar">{speakerAvatar ? <img src={speakerAvatar} alt="" /> : (message.role === "user" ? null : "👥")}</div>{message.role !== "user" && <div className="mp-group-msg-name">{message.speakerName || tr("群組", "Group", "グループ", "그룹")}</div>}</div>
              <div className={`mp-msg ${message.role === "user" ? "mp-msg-user" : "mp-msg-ai"}`} onClick={() => setActiveMessageId((previous) => previous === message.id ? null : message.id)}>{message.image && <img src={`data:image/png;base64,${message.image}`} className="mp-msg-img" alt="" />}{message.pseudoImage && <PseudoImageBubble pseudoImage={message.pseudoImage} tr={tr} />}{message.content && <div>{message.content}</div>}<div className="mp-msg-t">{new Date(message.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</div></div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}><button className={`mp-msg-editbtn ${activeMessageId === message.id ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => onEdit(message)}>✎</button><button className={`mp-msg-editbtn ${activeMessageId === message.id ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => onDelete(message)}>🗑</button></div>
            </div>;
          })}
          {messages.length === 0 && <div style={{ fontSize: 11, color: "var(--mp-txt-l)", textAlign: "center", padding: "18px 0" }}>{tr("目前沒有群組訊息", "No group messages yet", "グループメッセージはまだありません", "아직 그룹 메시지가 없습니다")}</div>}
          {isTyping && <div className="mp-typing"><span /><span /><span /></div>}
          <div ref={messagesEndRef} />
        </div>
        {showScrollToBottom && <button type="button" className="mp-scroll-bottom" style={{ bottom: 8 }} aria-label={tr("捲到最新訊息", "Scroll to latest message", "最新メッセージへ移動", "최신 메시지로 이동")} title={tr("捲到最新訊息", "Scroll to latest message", "最新メッセージへ移動", "최신 메시지로 이동")} onClick={onScrollToBottom}><ArrowDown size={23} strokeWidth={2.2} aria-hidden="true" /></button>}
      </div>
      {chatImage && <div className="mp-imgprev"><img src={`data:${chatImage.mime};base64,${chatImage.data}`} alt="" /><div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 4 }}>{chatImage.width}x{chatImage.height} · {Math.round(chatImage.bytes / 1024)}KB</div><button onClick={onClearImage}>×</button></div>}
      {chatPseudoImage && <div className="mp-imgprev"><span className="mp-pseudo-img-chip" style={pseudoImageStyle(chatPseudoImage)} /><div style={{ flex: 1, minWidth: 0, fontSize: 10, color: "var(--mp-txt-l)" }}>{tr("示意照片", "Mock photo", "イメージ写真", "가상 사진")}：{chatPseudoImage.desc}</div><button onClick={() => onSetPseudoImage(null)}>×</button></div>}
      {pseudoPickerOpen && <PseudoImagePicker onCancel={() => setPseudoPickerOpen(false)} onConfirm={(pseudoImage) => { onSetPseudoImage(pseudoImage); setPseudoPickerOpen(false); }} tr={tr} />}
      {photoChooserOpen && <PhotoSourceChooser onCancel={() => setPhotoChooserOpen(false)} onUpload={() => { setPhotoChooserOpen(false); fileInputRef.current?.click(); }} onPseudo={() => { setPhotoChooserOpen(false); setPseudoPickerOpen(true); }} tr={tr} />}
      <PlayerPersonaIndicator playerProfile={playerProfile} persona={persona} tr={tr} />
      {actionPanelOpen && <div className="mp-chat-actions"><button className="mp-chat-action" onClick={() => { setActionPanelOpen(false); setPhotoChooserOpen(true); }}><span className="mp-chat-action-i">🖼</span><span>{tr("相片", "Photo", "写真", "사진")}</span></button><button className="mp-chat-action" disabled><span className="mp-chat-action-i">📅</span><span>{tr("日程", "Schedule", "予定", "일정")}</span></button><button className="mp-chat-action" disabled><span className="mp-chat-action-i">⚙️</span><span>{tr("更多", "More", "その他", "더보기")}</span></button></div>}
      <div className="mp-inp-bar" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}><button className={`mp-btn mp-btn-img ${actionPanelOpen ? "active" : ""}`} onClick={() => setActionPanelOpen((value) => !value)}>＋</button><input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={onImageUpload} /><div className="mp-inp-wrap"><textarea ref={inputRef} className="mp-inp" placeholder={tr("輸入群組訊息...", "Type a group message...", "グループメッセージを入力...", "그룹 메시지를 입력...")} rows={1} maxLength={4000} autoComplete="off" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} data-form-type="other" data-lpignore="true" value={chatInput} onChange={(event) => setChatInput(event.target.value.slice(0, 4000))} /><div className="mp-char-counter">{chatInput.length}/4000</div></div><button className="mp-btn mp-btn-send" onClick={onSend}><span className="mp-btn-send-glyph" aria-hidden="true">➤</span></button></div>
    </>
  );
}

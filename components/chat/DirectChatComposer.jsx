import React, { useState } from "react";
import DirectGiftModal from "../gacha/DirectGiftModal";
import PseudoImagePicker from "./PseudoImagePicker";
import PhotoSourceChooser from "./PhotoSourceChooser";
import { pseudoImageStyle } from "../../utils/pseudoImage";
import { estimatePseudoVoiceDuration, PSEUDO_VOICE_TEXT_LIMIT } from "../../utils/pseudoVoice";
import { GACHA_ENABLED } from "../../config/featureFlags";
import useAutoResizeTextarea from "../../hooks/chat/useAutoResizeTextarea";
import PlayerPersonaIndicator from "./PlayerPersonaIndicator";

export default function DirectChatComposer({ image, onClearImage, pseudoImage, onSetPseudoImage, pseudoVoiceMode, onSetPseudoVoiceMode, actionPanelOpen, setActionPanelOpen, allowTransfer, onOpenTransfer, onStartScreenshot, screenshotSelection, onCancelScreenshot, onSaveScreenshot, character, onGiftEpisodeStarted, fileInputRef, onImageUpload, value, setValue, textLimit, onSend, retryAvailable, onRetryLast, busy, mode, playerProfile, persona, quickActions, quickActionsEnabled, onQuickAction, tr }) {
  const [giftOpen, setGiftOpen] = useState(false);
  const [pseudoPickerOpen, setPseudoPickerOpen] = useState(false);
  const [photoChooserOpen, setPhotoChooserOpen] = useState(false);
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const inputRef = useAutoResizeTextarea(value);

  if (screenshotSelection?.active) {
    return <div className="mp-inp-bar" style={{ alignItems: "center", gap: 9 }}>
      <button type="button" className="mp-btn mp-btn-img" onClick={onCancelScreenshot}>×</button>
      <div style={{ flex: 1, minWidth: 0, color: "var(--mp-txt)", fontSize: 11, lineHeight: 1.45 }}>
        <b style={{ display: "block", color: "var(--mp-pink-dk)", fontSize: 12 }}>選取截圖範圍</b>
        {screenshotSelection.selectedIds?.length ? `已選 ${screenshotSelection.selectedIds.length} 則，可點其他訊息調整終點` : screenshotSelection.startId ? "已選起點，請點選終點訊息" : "請先點選起點訊息"}
      </div>
      {screenshotSelection.selectedIds?.length > 0 && <button type="button" className="mp-save" style={{ width: "auto", minWidth: 88, minHeight: 40, padding: "8px 13px" }} onClick={onSaveScreenshot}>儲存 PNG</button>}
    </div>;
  }

  return <div className="mp-chat-composer-shell">
    {image && !pseudoVoiceMode && <div className="mp-imgprev"><img src={`data:${image.mime};base64,${image.data}`} alt="" /><div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 4 }}>{image.width}x{image.height} · {Math.round(image.bytes / 1024)}KB</div><button onClick={onClearImage}>×</button></div>}
    {pseudoImage && !pseudoVoiceMode && <div className="mp-imgprev"><span className="mp-pseudo-img-chip" style={pseudoImageStyle(pseudoImage)} /><div style={{ flex: 1, minWidth: 0, fontSize: 10, color: "var(--mp-txt-l)" }}>{tr("示意照片", "Mock photo", "イメージ写真", "가상 사진")}：{pseudoImage.desc}</div><button onClick={() => onSetPseudoImage(null)}>×</button></div>}
    {pseudoVoiceMode && mode !== "reality" && <div className="mp-imgprev"><span style={{ fontSize: 18 }}>🎙️</span><div style={{ flex: 1, minWidth: 0, fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.45 }}><b style={{ color: "var(--mp-pink-dk)" }}>{tr("語音訊息模式", "Voice message mode", "ボイスメッセージモード", "음성 메시지 모드")}</b>{value.trim() ? ` · ${estimatePseudoVoiceDuration(value)}″` : ""}<br />{tr("純模擬，不會產生真實音訊", "Simulation only; no real audio", "シミュレーションのみ・実音声なし", "시뮬레이션 전용 · 실제 음성 없음")}</div><button onClick={() => onSetPseudoVoiceMode(false)}>×</button></div>}
    {pseudoPickerOpen && <PseudoImagePicker onCancel={() => setPseudoPickerOpen(false)} onConfirm={(next) => { onSetPseudoImage(next); setPseudoPickerOpen(false); }} tr={tr} />}
    {photoChooserOpen && <PhotoSourceChooser onCancel={() => setPhotoChooserOpen(false)} onUpload={() => { setPhotoChooserOpen(false); fileInputRef.current?.click(); }} onPseudo={() => { setPhotoChooserOpen(false); setPseudoPickerOpen(true); }} tr={tr} />}
    {actionPanelOpen && <div className="mp-chat-actions">
      <button className="mp-chat-action" onClick={() => { setActionPanelOpen(false); setPhotoChooserOpen(true); }}><span className="mp-chat-action-i">🖼</span><span>{tr("相片", "Photo", "写真", "사진")}</span></button>
      {mode !== "reality" && <button className="mp-chat-action" onClick={() => { onClearImage?.(); onSetPseudoImage?.(null); onSetPseudoVoiceMode?.(true); setActionPanelOpen(false); }}><span className="mp-chat-action-i">🎙️</span><span>{tr("語音訊息", "Voice message", "ボイスメッセージ", "음성 메시지")}</span></button>}
      {allowTransfer && <button className="mp-chat-action" onClick={() => { setActionPanelOpen(false); onOpenTransfer(); }}><span className="mp-chat-action-i">💸</span><span>{tr("轉帳", "Transfer", "送金", "송금")}</span></button>}
      {GACHA_ENABLED && <button className="mp-chat-action" onClick={() => { setActionPanelOpen(false); setGiftOpen(true); }}><span className="mp-chat-action-i">🎁</span><span>{tr("贈禮", "Gift", "ギフト", "선물")}</span></button>}
      <button className="mp-chat-action" onClick={() => { setActionPanelOpen(false); onStartScreenshot?.(); }}><span className="mp-chat-action-i">📸</span><span>{tr("截圖", "Screenshot", "スクショ", "캡처")}</span></button>
      <button className="mp-chat-action" disabled><span className="mp-chat-action-i">📅</span><span>{tr("日程", "Schedule", "予定", "일정")}</span></button>
    </div>}
    {GACHA_ENABLED && giftOpen && <DirectGiftModal character={character} onClose={() => setGiftOpen(false)} onStarted={(episode) => { setGiftOpen(false); onGiftEpisodeStarted?.(episode); }} />}
    <div className="mp-composer-tools-row">
      <PlayerPersonaIndicator playerProfile={playerProfile} persona={persona} tr={tr} compact slim />
      {quickActionsEnabled && <button type="button" className={`mp-quick-toggle ${quickDrawerOpen ? "active" : ""}`} onClick={() => setQuickDrawerOpen((open) => !open)}>✦ {tr("劇情快捷", "Story shortcuts", "ストーリーショートカット", "스토리 바로가기")}</button>}
    </div>
    {quickActionsEnabled && <div className={`mp-quick-drawer ${quickDrawerOpen ? "is-open" : ""}`} aria-hidden={!quickDrawerOpen}>{(quickActions || []).map((action) => <button key={action.id} type="button" tabIndex={quickDrawerOpen ? 0 : -1} className="mp-quick-action" onClick={() => onQuickAction?.(action)}>{action.label}</button>)}</div>}
    <div className="mp-inp-bar"><button className={`mp-btn mp-btn-img ${actionPanelOpen ? "active" : ""}`} onClick={() => setActionPanelOpen((open) => !open)}>＋</button><input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={onImageUpload} /><div className="mp-inp-wrap"><textarea ref={inputRef} className="mp-inp" placeholder={retryAvailable ? tr("上次未收到回覆，點右側重試", "No reply received. Tap retry", "返信がありません。右側で再試行", "답장이 없어요. 오른쪽에서 다시 시도하세요") : pseudoVoiceMode && mode !== "reality" ? tr("輸入語音內容...", "Type voice message...", "音声メッセージを入力...", "음성 메시지 입력...") : mode === "reality" ? tr("輸入對話（現實）...", "Speak in person...", "会話を入力（現実）...", "대화 입력（현실）...") : tr("輸入訊息（線上）...", "Type a message (online)...", "メッセージを入力（オンライン）...", "메시지 입력（온라인）...")} name="mali_chat_text" rows={1} maxLength={pseudoVoiceMode && mode !== "reality" ? PSEUDO_VOICE_TEXT_LIMIT : textLimit} autoComplete="off" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} data-form-type="other" data-lpignore="true" value={value} onChange={(event) => { const limit = pseudoVoiceMode && mode !== "reality" ? PSEUDO_VOICE_TEXT_LIMIT : textLimit; setValue(event.target.value.slice(0, limit)); }} /><div className="mp-char-counter">{value.length}/{pseudoVoiceMode && mode !== "reality" ? PSEUDO_VOICE_TEXT_LIMIT : textLimit}</div></div><button type="button" className={`mp-btn mp-btn-send ${retryAvailable ? "is-retry" : ""}`} disabled={busy} aria-label={retryAvailable ? tr("重新取得角色回覆", "Retry character reply", "キャラクターの返信を再試行", "캐릭터 답장 다시 시도") : tr("送出訊息", "Send message", "メッセージを送信", "메시지 보내기")} title={retryAvailable ? tr("重新取得角色回覆", "Retry character reply", "キャラクターの返信を再試行", "캐릭터 답장 다시 시도") : undefined} onClick={retryAvailable ? onRetryLast : onSend}>{retryAvailable ? "↻" : "➤"}</button></div>
  </div>;
}

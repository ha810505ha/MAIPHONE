import React, { useState } from "react";
import { OnlineChatMessage, RealityChatMessage, SystemNoticeMessage, TransferMessage } from "./DirectMessageTypes";
import CalendarAppointmentCard from "./CalendarAppointmentCard";
import SwipePicker from "./SwipePicker";
import { findTailAssistantSwipeAnchor } from "../../utils/assistantSwipeGroups.js";

function SwipeControls({ swipe, tr, afterThought = false, inline = false }) {
  if (!swipe) return null;
  if (swipe.count <= 1) {
    return <button type="button" className={`mp-swipe-regenerate ${afterThought ? "mp-swipe-after-thought" : ""} ${inline ? "mp-swipe-inline" : ""}`} onClick={swipe.onGenerate}>↻ {tr("再來一個", "Generate another", "もう一つ", "하나 더")}</button>;
  }
  return <div className={`mp-swipe-controls ${afterThought ? "mp-swipe-after-thought" : ""} ${inline ? "mp-swipe-inline" : ""}`} onClick={(event) => event.stopPropagation()}>
    <button type="button" disabled={!swipe.onPrevious} onClick={swipe.onPrevious} aria-label={tr("上一個回覆", "Previous reply", "前の返信", "이전 답장")}>‹</button>
    <button type="button" className="mp-swipe-count" onClick={swipe.onOpenPicker} aria-label={tr("查看所有回覆", "View all replies", "すべての返信を見る", "모든 답장 보기")}>{swipe.index + 1}/{swipe.count}</button>
    <button type="button" disabled={!swipe.onNext} onClick={swipe.onNext} aria-label={tr("下一個回覆", "Next reply", "次の返信", "다음 답장")}>›</button>
    <button type="button" className="mp-swipe-generate-icon" onClick={swipe.onGenerate} aria-label={tr("生成其他回覆", "Generate another reply", "別の返信を生成", "다른 답장 생성")}>↻</button>
  </div>;
}

export default function ChatMessageRenderer({
  messages,
  character,
  activeMessageId,
  setActiveMessageId,
  highlightedThoughtMessageId,
  isTyping,
  getModeLabel,
  getMessageMode,
  stripModeLabel,
  stripInternalBlocks,
  parseShareEventNotice,
  isConnectionErrorNotice,
  startNoticeLongPress,
  cancelNoticeLongPress,
  retryChatFromNotice,
  deleteChatMessage,
  applyUserPlaceholder,
  formatMoney,
  renderRealityText,
  renderInnerThought,
  canRenderInnerThought,
  renderCharacterVoiceAction,
  getCharacterVoiceBubblePlayback,
  setMessageEditor,
  screenshotSelection,
  transfers,
  onResolveTransfer,
  onAddCalendarProposal,
  onDismissCalendarProposal,
  onSelectSwipe,
  onGenerateSwipe,
  onDeleteSwipe,
  onCreateSwipeBranch,
  tr,
}) {
  const [pickerMessageId, setPickerMessageId] = useState(null);
  const pickerMessage = messages.find((message) => message.id === pickerMessageId) || null;
  const swipeAnchorId = findTailAssistantSwipeAnchor(messages);
  const wrapSelectable = (message, content) => {
    if (!screenshotSelection?.active) return content;
    const selected = screenshotSelection.selectedIds?.includes(message.id);
    const isStart = screenshotSelection.startId === message.id;
    const isEnd = screenshotSelection.endId === message.id;
    return <div key={`screenshot-${message.id}`} data-screenshot-message-id={message.id}
      onClickCapture={(event) => { event.preventDefault(); event.stopPropagation(); screenshotSelection.onSelect(message.id); }}
      style={{ position: "relative", cursor: "crosshair", borderRadius: 14, outline: selected ? "2px solid var(--mp-pink-dk)" : "1px dashed color-mix(in srgb,var(--mp-pink) 42%,transparent)", outlineOffset: 3 }}>
      {content}
      {(isStart || isEnd) && <span style={{ position: "absolute", top: -9, left: isStart ? 7 : "auto", right: isEnd && !isStart ? 7 : "auto", zIndex: 4, padding: "2px 7px", borderRadius: 99, background: "var(--mp-pink-dk)", color: "#fff", fontSize: 9, fontWeight: 900 }}>{isStart && isEnd ? "起點・終點" : isStart ? "起點" : "終點"}</span>}
    </div>;
  };
  const renderedMessages = messages.map((message, messageIndex) => {
    if (message.role === "mode_transition") {
      return wrapSelectable(message, <div key={message.id} className="mp-mode-sep"><span>{getModeLabel(message.toMode)}</span></div>);
    }
    if (message.role === "system_notice") {
      const share = parseShareEventNotice(message.content);
      return wrapSelectable(message, <SystemNoticeMessage key={message.id} message={message} share={share} connectionError={isConnectionErrorNotice(message.content)}
        active={activeMessageId === message.id} isTyping={isTyping}
        onLongPressStart={() => startNoticeLongPress(message.id)} onLongPressEnd={cancelNoticeLongPress}
        onRetry={() => retryChatFromNotice(message.id)} onDelete={() => deleteChatMessage(character.id, message.id)}
        applyUserPlaceholder={applyUserPlaceholder} tr={tr} />);
    }
    const isUser = message.role === "user";
    const isActive = activeMessageId === message.id;
    const swipeItems = Array.isArray(message.swipes) && message.swipes.length ? message.swipes : null;
    const swipeIndex = Math.min(Math.max(0, Number(message.swipeIndex) || 0), Math.max(0, (swipeItems?.length || 1) - 1));
    const canSwipe = !isUser
      && message.role === "assistant"
      && message.id === swipeAnchorId
      && !isTyping
      && !screenshotSelection?.active
      && !message.image
      && !message.pseudoImage
      && !message.pseudoVoice
      && !message.calendarProposal
      && typeof onGenerateSwipe === "function";
    const swipe = canSwipe ? {
      index: swipeIndex,
      count: swipeItems?.length || 1,
      onPrevious: swipeIndex > 0 ? () => onSelectSwipe?.(message.id, swipeIndex - 1) : null,
      onNext: swipeItems && swipeIndex < swipeItems.length - 1 ? () => onSelectSwipe?.(message.id, swipeIndex + 1) : null,
      onGenerate: () => onGenerateSwipe(message.id),
      onOpenPicker: () => setPickerMessageId(message.id),
    } : null;
    if (message.role === "transfer") {
      const transfer = (transfers || []).find((item) => item.id === message.transferId) || null;
      return wrapSelectable(message, <TransferMessage key={message.id} message={message} transfer={transfer} active={isActive}
        onToggle={() => setActiveMessageId((previous) => previous === message.id ? null : message.id)}
        onAccept={() => onResolveTransfer?.(transfer, "accepted", "player")}
        onReturn={() => onResolveTransfer?.(transfer, "returned", "player")}
        onDelete={() => {
          if (!window.confirm(tr("刪除後不保留這筆交易紀錄，確定嗎？", "This transaction record will be removed. Continue?", "削除するとこの取引記録は残りません。続けますか？", "삭제하면 이 거래 기록은 남지 않습니다. 계속할까요?"))) return;
          deleteChatMessage(character.id, message.id);
        }}
        formatMoney={formatMoney} tr={tr} />);
    }
    const displayContent = stripModeLabel(stripInternalBlocks(message.content));
    const rawInnerThought = canRenderInnerThought(message) ? renderInnerThought(character, message) : null;
    const inlineSwipe = swipe ? <SwipeControls swipe={swipe} tr={tr} inline /> : null;
    const innerThought = rawInnerThought && React.isValidElement(rawInnerThought)
      ? React.cloneElement(rawInnerThought, { trailingAction: inlineSwipe })
      : <>{rawInnerThought}{inlineSwipe}</>;
    const sharedProps = {
      message,
      isUser,
      active: isActive,
      highlighted: highlightedThoughtMessageId === message.id,
      displayContent,
      innerThought,
      onToggle: () => setActiveMessageId((previous) => previous === message.id ? null : message.id),
      onEdit: () => setMessageEditor({ id: message.id, content: message.content || "", mode: getMessageMode(message), pseudoVoice: !!message.pseudoVoice }),
      swipe,
      tr,
    };
    const appointmentCard = !isUser && message.calendarProposal
      ? <CalendarAppointmentCard message={message} proposal={message.calendarProposal} onAdd={onAddCalendarProposal} onDismiss={onDismissCalendarProposal} tr={tr} />
      : null;
    if (getMessageMode(message) === "reality") {
      return wrapSelectable(message, <React.Fragment key={message.id}>
        <RealityChatMessage {...sharedProps}
          renderedContent={renderRealityText(displayContent)}
          voiceAction={renderCharacterVoiceAction(character, message, isActive, true)} />
        {appointmentCard}
      </React.Fragment>);
    }
    return wrapSelectable(message, <React.Fragment key={message.id}>
      <OnlineChatMessage {...sharedProps}
        voicePlayback={!isUser && message.pseudoVoice ? getCharacterVoiceBubblePlayback?.(character, message) : null}
        voiceAction={message.pseudoVoice ? null : renderCharacterVoiceAction(character, message, isActive)} />
      {appointmentCard}
    </React.Fragment>);
  });
  return <>
    {renderedMessages}
    <SwipePicker
      open={!!pickerMessage}
      message={pickerMessage}
      onClose={() => setPickerMessageId(null)}
      onSelect={(swipeIndex) => onSelectSwipe?.(pickerMessage.id, swipeIndex)}
      onDelete={(swipeIndex) => onDeleteSwipe?.(pickerMessage.id, swipeIndex)}
      onGenerate={() => onGenerateSwipe?.(pickerMessage.id)}
      onCreateBranch={(swipeIndex) => onCreateSwipeBranch?.(pickerMessage.id, swipeIndex)}
      tr={tr}
    />
  </>;
}

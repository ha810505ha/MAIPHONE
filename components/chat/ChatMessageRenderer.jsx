import React from "react";
import { OnlineChatMessage, RealityChatMessage, SystemNoticeMessage, TransferMessage } from "./DirectMessageTypes";
import { ThinkingPanel } from "./ChatMessageParts";

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
  tr,
}) {
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
  return messages.map((message) => {
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
    const sharedProps = {
      message,
      isUser,
      active: isActive,
      highlighted: highlightedThoughtMessageId === message.id,
      displayContent,
      innerThought: canRenderInnerThought(message) ? renderInnerThought(character, message) : null,
      thinking: message.thinking?.content ? <ThinkingPanel content={message.thinking.content} tr={tr} /> : null,
      onToggle: () => setActiveMessageId((previous) => previous === message.id ? null : message.id),
      onEdit: () => setMessageEditor({ id: message.id, content: message.content || "", mode: getMessageMode(message), pseudoVoice: !!message.pseudoVoice }),
    };
    if (getMessageMode(message) === "reality") {
      return wrapSelectable(message, <RealityChatMessage key={message.id} {...sharedProps}
        renderedContent={renderRealityText(displayContent)}
        voiceAction={renderCharacterVoiceAction(character, message, isActive, true)} />);
    }
    return wrapSelectable(message, <OnlineChatMessage key={message.id} {...sharedProps}
      voicePlayback={!isUser && message.pseudoVoice ? getCharacterVoiceBubblePlayback?.(character, message) : null}
      voiceAction={message.pseudoVoice ? null : renderCharacterVoiceAction(character, message, isActive)} />);
  });
}

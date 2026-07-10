import React from "react";
import { OnlineChatMessage, RealityChatMessage, SystemNoticeMessage, TransferMessage } from "./DirectMessageTypes";

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
  setMessageEditor,
  tr,
}) {
  return messages.map((message) => {
    if (message.role === "mode_transition") {
      return <div key={message.id} className="mp-mode-sep"><span>{getModeLabel(message.toMode)}</span></div>;
    }
    if (message.role === "system_notice") {
      const share = parseShareEventNotice(message.content);
      return <SystemNoticeMessage key={message.id} message={message} share={share} connectionError={isConnectionErrorNotice(message.content)}
        active={activeMessageId === message.id} isTyping={isTyping}
        onLongPressStart={() => startNoticeLongPress(message.id)} onLongPressEnd={cancelNoticeLongPress}
        onRetry={() => retryChatFromNotice(message.id)} onDelete={() => deleteChatMessage(character.id, message.id)}
        applyUserPlaceholder={applyUserPlaceholder} tr={tr} />;
    }
    const isUser = message.role === "user";
    const isActive = activeMessageId === message.id;
    if (message.role === "transfer") {
      return <TransferMessage key={message.id} message={message} active={isActive}
        onToggle={() => setActiveMessageId((previous) => previous === message.id ? null : message.id)}
        onDelete={() => {
          if (!window.confirm(tr("刪除後不保留這筆交易紀錄，確定嗎？", "This transaction record will be removed. Continue?", "削除するとこの取引記録は残りません。続けますか？", "삭제하면 이 거래 기록은 남지 않습니다. 계속할까요?"))) return;
          deleteChatMessage(character.id, message.id);
        }}
        formatMoney={formatMoney} tr={tr} />;
    }
    const displayContent = stripModeLabel(stripInternalBlocks(message.content));
    const sharedProps = {
      message,
      isUser,
      active: isActive,
      highlighted: highlightedThoughtMessageId === message.id,
      displayContent,
      innerThought: canRenderInnerThought(message) ? renderInnerThought(character, message) : null,
      onToggle: () => setActiveMessageId((previous) => previous === message.id ? null : message.id),
      onEdit: () => setMessageEditor({ id: message.id, content: message.content || "", mode: getMessageMode(message) }),
    };
    if (getMessageMode(message) === "reality") {
      return <RealityChatMessage key={message.id} {...sharedProps}
        renderedContent={renderRealityText(displayContent)}
        voiceAction={renderCharacterVoiceAction(character, message, isActive, true)} />;
    }
    return <OnlineChatMessage key={message.id} {...sharedProps}
      voiceAction={renderCharacterVoiceAction(character, message, isActive)} />;
  });
}

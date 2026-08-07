import { PSEUDO_VOICE_TEXT_LIMIT, createPseudoVoice } from "../../utils/pseudoVoice";
import { getChatTextLimit } from "../../utils/chatMessageUtils";

/**
 * Owns the mutable actions attached to chat messages.
 *
 * The chat surface only needs callbacks for editing, deleting, and handling
 * long-press notices; the app shell should not need to know how direct and
 * group message collections are updated.
 */
export default function useChatMessageActions({
  currentChatChar,
  currentChatGroup,
  chatHistory,
  messageEditor,
  noticeLongPressTimerRef,
  setChatHistory,
  setGroupChats,
  setMessageEditor,
  setActiveMessageId,
  sanitizeText,
  showToast,
  tr,
}) {
  const closeMessageEditor = () => setMessageEditor(null);

  const deleteChatMessage = (charId, messageId) => {
    setChatHistory((history) => ({
      ...history,
      [charId]: (history[charId] || []).filter((message) => message.id !== messageId),
    }));
    setActiveMessageId(null);
  };

  const startNoticeLongPress = (messageId) => {
    clearTimeout(noticeLongPressTimerRef.current);
    noticeLongPressTimerRef.current = setTimeout(() => {
      setActiveMessageId(messageId);
    }, 450);
  };

  const cancelNoticeLongPress = () => {
    clearTimeout(noticeLongPressTimerRef.current);
    noticeLongPressTimerRef.current = null;
  };

  const saveEditedMessage = () => {
    if (!messageEditor) return;
    if (currentChatGroup && !currentChatChar) {
      const nextMessages = (currentChatGroup.messages || []).map((message) => (
        message.id === messageEditor.id
          ? { ...message, content: sanitizeText(messageEditor.content, 4000) }
          : message
      ));
      setGroupChats((groups) => groups.map((group) => (
        group.id === currentChatGroup.id
          ? { ...group, messages: nextMessages, updatedAt: Date.now() }
          : group
      )));
    } else if (currentChatChar) {
      const charId = currentChatChar.id;
      const limit = messageEditor.pseudoVoice
        ? PSEUDO_VOICE_TEXT_LIMIT
        : getChatTextLimit(messageEditor.mode);
      const content = sanitizeText(messageEditor.content, limit);
      const nextMessages = (chatHistory[charId] || []).map((message) => (
        message.id === messageEditor.id
          ? {
            ...message,
            content,
            ...(messageEditor.pseudoVoice ? { pseudoVoice: createPseudoVoice(content) } : {}),
          }
          : message
      ));
      setChatHistory((history) => ({ ...history, [charId]: nextMessages }));
    } else {
      return;
    }
    setMessageEditor(null);
    setActiveMessageId(null);
    showToast(tr("訊息已更新", "Message updated", "メッセージを更新しました", "메시지가 업데이트되었습니다"));
  };

  const deleteMessageWithConfirm = () => {
    if (!messageEditor) return;
    if (!window.confirm(tr(
      "確定要刪除這則對話嗎？",
      "Delete this message?",
      "このメッセージを削除しますか？",
      "이 메시지를 삭제할까요?",
    ))) return;
    if (currentChatGroup && !currentChatChar) {
      const nextMessages = (currentChatGroup.messages || []).filter((message) => message.id !== messageEditor.id);
      setGroupChats((groups) => groups.map((group) => (
        group.id === currentChatGroup.id
          ? { ...group, messages: nextMessages, updatedAt: Date.now() }
          : group
      )));
    } else if (currentChatChar) {
      const charId = currentChatChar.id;
      const nextMessages = (chatHistory[charId] || []).filter((message) => message.id !== messageEditor.id);
      setChatHistory((history) => ({ ...history, [charId]: nextMessages }));
    } else {
      return;
    }
    setMessageEditor(null);
    setActiveMessageId(null);
    showToast(tr("訊息已刪除", "Message deleted", "メッセージを削除しました", "메시지가 삭제되었습니다"));
  };

  return {
    closeMessageEditor,
    deleteChatMessage,
    startNoticeLongPress,
    cancelNoticeLongPress,
    saveEditedMessage,
    deleteMessageWithConfirm,
  };
}

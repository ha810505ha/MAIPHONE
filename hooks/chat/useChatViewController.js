import { useEffect } from "react";

/**
 * Keeps chat viewport state separate from message generation and app-shell
 * navigation. It owns scroll restoration, visible-message pagination, and
 * thought jumps so the chat surface can stay presentation-focused.
 */
export default function useChatViewController({
  currentChatChar,
  currentChatGroup,
  activeRoomIds,
  chatHistory,
  groupChats,
  chatSettingsOpen,
  pendingThoughtScrollId,
  chatVisibleCounts,
  isTyping,
  chatMsgsRef,
  messagesEndRef,
  chatLoadAdjustRef,
  chatScrollPositionsRef,
  thoughtJumpInProgressRef,
  setExpandedInnerThoughts,
  setHighlightedThoughtMessageId,
  setPendingThoughtScrollId,
  setShowScrollToBottom,
  setChatVisibleCounts,
  setChatSettingsOpen,
}) {
  useEffect(() => {
    if (!pendingThoughtScrollId || chatSettingsOpen) return;
    const frame = requestAnimationFrame(() => {
      const container = chatMsgsRef.current;
      const target = container
        ? Array.from(container.querySelectorAll("[data-message-id]"))
          .find((node) => node.dataset.messageId === pendingThoughtScrollId)
        : null;
      if (!target) return;
      const targetTop = target.offsetTop - (container.clientHeight - target.clientHeight) / 2;
      container.scrollTop = Math.max(0, targetTop);
      setExpandedInnerThoughts((previous) => ({ ...previous, [pendingThoughtScrollId]: true }));
      setHighlightedThoughtMessageId(pendingThoughtScrollId);
      setPendingThoughtScrollId(null);
      setTimeout(() => { thoughtJumpInProgressRef.current = false; }, 500);
      setTimeout(() => setHighlightedThoughtMessageId(null), 1800);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingThoughtScrollId, chatSettingsOpen, chatVisibleCounts, chatHistory]);

  useEffect(() => {
    if (!currentChatChar) return;
    if (thoughtJumpInProgressRef.current) return;
    const element = chatMsgsRef.current || messagesEndRef.current?.parentElement;
    if (!element) return;
    const timer = setTimeout(() => {
      element.scrollTop = element.scrollHeight;
      setShowScrollToBottom(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [currentChatChar?.id, chatHistory, isTyping, chatVisibleCounts]);

  useEffect(() => {
    if (!currentChatGroup) return;
    const element = chatMsgsRef.current || messagesEndRef.current?.parentElement;
    if (!element) return;
    const timer = setTimeout(() => {
      element.scrollTop = element.scrollHeight;
      setShowScrollToBottom(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [currentChatGroup?.id, groupChats, isTyping]);

  const updateScrollToBottomVisibility = (element) => {
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 250);
  };

  const scrollCurrentChatToBottom = () => {
    const element = chatMsgsRef.current;
    if (!element) return;
    thoughtJumpInProgressRef.current = false;
    setHighlightedThoughtMessageId(null);
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    setShowScrollToBottom(false);
  };

  const getCurrentChatScrollKey = (characterId = currentChatChar?.id, roomId = activeRoomIds[characterId]) => (
    characterId ? `${characterId}::${roomId || "default"}` : null
  );

  const rememberCurrentChatScroll = (element = chatMsgsRef.current) => {
    const key = getCurrentChatScrollKey();
    if (!key || !element) return;
    chatScrollPositionsRef.current[key] = {
      scrollTop: element.scrollTop,
      distanceFromBottom: Math.max(0, element.scrollHeight - element.scrollTop - element.clientHeight),
    };
  };

  useEffect(() => {
    if (chatSettingsOpen || !currentChatChar?.id) return;
    const key = getCurrentChatScrollKey();
    const saved = key ? chatScrollPositionsRef.current[key] : null;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      const element = chatMsgsRef.current;
      if (!element) return;
      if (saved) {
        const fromBottom = Math.max(0, Number(saved.distanceFromBottom) || 0);
        element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight - fromBottom);
        delete chatScrollPositionsRef.current[key];
      } else {
        element.scrollTop = element.scrollHeight;
      }
      updateScrollToBottomVisibility(element);
    }));
    return () => cancelAnimationFrame(frame);
  }, [chatSettingsOpen, currentChatChar?.id, activeRoomIds[currentChatChar?.id]]);

  useEffect(() => {
    if (!currentChatChar) return;
    setChatVisibleCounts((previous) => {
      const current = previous[currentChatChar.id];
      if (current === 50) return previous;
      return { ...previous, [currentChatChar.id]: 50 };
    });
  }, [currentChatChar?.id]);

  useEffect(() => {
    const adjust = chatLoadAdjustRef.current;
    if (!adjust?.charId) return;
    if (adjust.charId !== currentChatChar?.id) return;
    const element = chatMsgsRef.current;
    if (!element) return;
    const difference = element.scrollHeight - (adjust.prevScrollHeight || element.scrollHeight);
    if (difference > 0) element.scrollTop = (adjust.prevScrollTop || 0) + difference;
    chatLoadAdjustRef.current = null;
  }, [currentChatChar?.id, chatVisibleCounts]);

  const jumpToThoughtMessage = (messageId, characterId, messageCount) => {
    thoughtJumpInProgressRef.current = true;
    setChatVisibleCounts((previous) => ({ ...previous, [characterId]: messageCount }));
    setPendingThoughtScrollId(messageId);
    setChatSettingsOpen(false);
  };

  const loadEarlierMessages = (characterId, nextVisibleCount) => {
    const element = chatMsgsRef.current;
    if (!element) return;
    chatLoadAdjustRef.current = {
      charId: characterId,
      prevScrollHeight: element.scrollHeight,
      prevScrollTop: element.scrollTop,
    };
    setChatVisibleCounts((previous) => ({ ...previous, [characterId]: nextVisibleCount }));
  };

  const handleDirectChatScroll = (element, { characterId, hasEarlier, nextVisibleCount } = {}) => {
    updateScrollToBottomVisibility(element);
    if (!element || !characterId || element.scrollTop > 0 || !hasEarlier) return;
    loadEarlierMessages(characterId, nextVisibleCount);
  };

  return {
    updateScrollToBottomVisibility,
    scrollCurrentChatToBottom,
    getCurrentChatScrollKey,
    rememberCurrentChatScroll,
    jumpToThoughtMessage,
    loadEarlierMessages,
    handleDirectChatScroll,
  };
}

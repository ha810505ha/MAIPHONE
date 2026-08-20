import { useCallback, useEffect, useRef, useState } from "react";
import { createPseudoVoice, PSEUDO_VOICE_TEXT_LIMIT } from "../../utils/pseudoVoice";
import { isRequestCancelled } from "../../utils/networkRequest.js";
import { getRetryableTailUserMessage, isPendingRequestForRoom } from "../../services/chat/chatRetryState.js";
import { findAssistantSwipeGroup, replaceAssistantSwipeGroup } from "../../utils/assistantSwipeGroups.js";

const MAX_ASSISTANT_SWIPES = 8;

export default function useDirectChatAI({ currentCharacter, isTyping, chatHistory, chatInput, chatImage, chatPseudoImage, chatPseudoVoiceMode, getActiveRoomId, getCommittedMode, getSelectedMode, getMessageMode, getTextLimit, isPlayerBlockedByCharacter, sanitizeText, createId, setChatHistory, setChatInput, setChatImage, setChatPseudoImage, setChatPseudoVoiceMode, setActionPanelOpen, setIsTyping, generateAssistant, addErrorNotice, onSwipeError, onSwipeLimit }) {
  const requestRef = useRef(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  useEffect(() => {
    setPendingRequest(null);
    setIsTyping(false);
    return () => {
      const request = requestRef.current;
      requestRef.current = null;
      request?.abort();
    };
  }, [currentCharacter?.id, setIsTyping]);

  const sendMessage = useCallback(async (draftOverride) => {
    if (!currentCharacter || isTyping) return;
    const characterId = currentCharacter.id;
    const roomId = getActiveRoomId?.(characterId) || null;
    const previous = chatHistory[characterId] || [];
    const committedMode = getCommittedMode(characterId);
    const selectedMode = getSelectedMode(characterId);
    const pseudoVoiceActive = chatPseudoVoiceMode && selectedMode !== "reality";
    const sourceText = typeof draftOverride === "string" ? draftOverride : chatInput;
    const text = sanitizeText(sourceText.trim(), pseudoVoiceActive ? PSEUDO_VOICE_TEXT_LIMIT : getTextLimit(selectedMode));
    const image = pseudoVoiceActive ? null : (chatImage?.data || null);
    const pseudoImage = pseudoVoiceActive ? null : (chatPseudoImage || null);
    const pseudoVoice = pseudoVoiceActive ? createPseudoVoice(text) : null;
    if (!text && !image && !pseudoImage && !pseudoVoice) return;
    const now = Date.now();
    const transition = committedMode !== selectedMode ? { id: createId(), role: "mode_transition", fromMode: committedMode, toMode: selectedMode, time: now } : null;
    const userMessage = { id: createId(), role: "user", content: text, image, imageMime: image ? chatImage?.mime : null, pseudoImage, pseudoVoice, imageSummary: "", mode: selectedMode, interceptedByCharacterBlock: selectedMode === "online" && isPlayerBlockedByCharacter?.(characterId) === true, time: now };
    const nextHistory = transition ? [...previous, transition, userMessage] : [...previous, userMessage];
    setChatHistory((history) => ({ ...history, [characterId]: nextHistory }));
    setChatInput(""); setChatImage(null); setChatPseudoImage(null); setChatPseudoVoiceMode(false); setActionPanelOpen(false); setIsTyping(true);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setPendingRequest({ characterId, roomId, messageId: userMessage.id });
    try { await generateAssistant({ cid: characterId, roomId, char: currentCharacter, nextForDisplay: nextHistory, selectedMode, um: userMessage, text, signal: controller.signal }); }
    catch (error) { if (!isRequestCancelled(error)) addErrorNotice(characterId, error, roomId); }
    finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPendingRequest(null);
        setIsTyping(false);
      }
    }
  }, [currentCharacter, isTyping, chatHistory, chatInput, chatImage, chatPseudoImage, chatPseudoVoiceMode, getActiveRoomId, getCommittedMode, getSelectedMode, getTextLimit, isPlayerBlockedByCharacter, sanitizeText, createId, setChatHistory, setChatInput, setChatImage, setChatPseudoImage, setChatPseudoVoiceMode, setActionPanelOpen, setIsTyping, generateAssistant, addErrorNotice]);

  const addMessageToBatch = useCallback(() => {
    if (!currentCharacter || isTyping) return false;
    const characterId = currentCharacter.id;
    const selectedMode = getSelectedMode(characterId);
    if (selectedMode !== "online") return false;
    const pseudoVoiceActive = chatPseudoVoiceMode;
    const text = sanitizeText(chatInput.trim(), pseudoVoiceActive ? PSEUDO_VOICE_TEXT_LIMIT : getTextLimit(selectedMode));
    const image = pseudoVoiceActive ? null : (chatImage?.data || null);
    const pseudoImage = pseudoVoiceActive ? null : (chatPseudoImage || null);
    const pseudoVoice = pseudoVoiceActive ? createPseudoVoice(text) : null;
    if (!text && !image && !pseudoImage && !pseudoVoice) return false;
    const previous = chatHistory[characterId] || [];
    const committedMode = getCommittedMode(characterId);
    const now = Date.now();
    const transition = committedMode !== selectedMode ? { id: createId(), role: "mode_transition", fromMode: committedMode, toMode: selectedMode, time: now } : null;
    const userMessage = { id: createId(), role: "user", content: text, image, imageMime: image ? chatImage?.mime : null, pseudoImage, pseudoVoice, imageSummary: "", mode: selectedMode, interceptedByCharacterBlock: isPlayerBlockedByCharacter?.(characterId) === true, time: now };
    setChatHistory((history) => ({ ...history, [characterId]: transition ? [...previous, transition, userMessage] : [...previous, userMessage] }));
    setChatInput(""); setChatImage(null); setChatPseudoImage(null); setChatPseudoVoiceMode(false); setActionPanelOpen(false);
    return true;
  }, [currentCharacter, isTyping, chatHistory, chatInput, chatImage, chatPseudoImage, chatPseudoVoiceMode, getCommittedMode, getSelectedMode, getTextLimit, isPlayerBlockedByCharacter, sanitizeText, createId, setChatHistory, setChatInput, setChatImage, setChatPseudoImage, setChatPseudoVoiceMode, setActionPanelOpen]);

  const retryMessage = useCallback(async (noticeId) => {
    if (!currentCharacter || isTyping) return;
    const characterId = currentCharacter.id;
    const roomId = getActiveRoomId?.(characterId) || null;
    const list = chatHistory[characterId] || [];
    const noticeIndex = list.findIndex((message) => message.id === noticeId);
    if (noticeIndex < 0) return;
    const userMessage = [...list.slice(0, noticeIndex)].reverse().find((message) => message.role === "user");
    if (!userMessage) return;
    const nextHistory = list.filter((message) => message.id !== noticeId);
    setChatHistory((history) => ({ ...history, [characterId]: nextHistory }));
    setIsTyping(true);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setPendingRequest({ characterId, roomId, messageId: userMessage.id });
    try { await generateAssistant({ cid: characterId, roomId, char: currentCharacter, nextForDisplay: nextHistory, selectedMode: getMessageMode(userMessage), um: userMessage, text: userMessage.content || "", signal: controller.signal }); }
    catch (error) { if (!isRequestCancelled(error)) addErrorNotice(characterId, error, roomId); }
    finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPendingRequest(null);
        setIsTyping(false);
      }
    }
  }, [currentCharacter, isTyping, chatHistory, getActiveRoomId, getMessageMode, setChatHistory, setIsTyping, generateAssistant, addErrorNotice]);

  const retryLastUnansweredMessage = useCallback(async ({ allowInterceptedByCharacterBlock = false } = {}) => {
    if (!currentCharacter || isTyping) return false;
    const characterId = currentCharacter.id;
    const roomId = getActiveRoomId?.(characterId) || null;
    if (isPendingRequestForRoom(pendingRequest, characterId, roomId)) return false;
    const nextHistory = chatHistory[characterId] || [];
    const userMessage = getRetryableTailUserMessage(nextHistory, { allowInterceptedByCharacterBlock });
    if (!userMessage) return false;
    setIsTyping(true);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setPendingRequest({ characterId, roomId, messageId: userMessage.id });
    try {
      await generateAssistant({
        cid: characterId,
        roomId,
        char: currentCharacter,
        nextForDisplay: nextHistory,
        selectedMode: getMessageMode(userMessage),
        um: userMessage,
        text: userMessage.content || "",
        signal: controller.signal,
      });
      return true;
    } catch (error) {
      if (!isRequestCancelled(error)) addErrorNotice(characterId, error, roomId);
      return false;
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPendingRequest(null);
        setIsTyping(false);
      }
    }
  }, [currentCharacter, isTyping, pendingRequest, chatHistory, getActiveRoomId, getMessageMode, setIsTyping, generateAssistant, addErrorNotice]);

  const selectAssistantSwipe = useCallback((messageId, swipeIndex) => {
    if (!currentCharacter || isTyping || !Number.isInteger(swipeIndex) || swipeIndex < 0) return;
    const characterId = currentCharacter.id;
    setChatHistory((history) => ({
      ...history,
      [characterId]: replaceAssistantSwipeGroup(history[characterId] || [], messageId, swipeIndex, createId),
    }));
  }, [currentCharacter, isTyping, createId, setChatHistory]);

  const generateAssistantSwipe = useCallback(async (messageId) => {
    if (!currentCharacter || isTyping) return false;
    const characterId = currentCharacter.id;
    const roomId = getActiveRoomId?.(characterId) || null;
    const list = chatHistory[characterId] || [];
    const group = findAssistantSwipeGroup(list, messageId);
    const target = group?.anchor;
    if (!target || target.id !== messageId) return false;
    const existingCount = Array.isArray(target.swipes) && target.swipes.length ? target.swipes.length : 1;
    if (existingCount >= MAX_ASSISTANT_SWIPES) {
      onSwipeLimit?.(MAX_ASSISTANT_SWIPES);
      return false;
    }
    const sourceMessage = [...list.slice(0, group.startIndex)].reverse().find((message) => message.role === "user");
    if (!sourceMessage) return false;
    setIsTyping(true);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setPendingRequest({ characterId, roomId, messageId: target.id, swipe: true });
    try {
      await generateAssistant({ cid: characterId, roomId, char: currentCharacter, nextForDisplay: list.slice(0, group.startIndex), selectedMode: getMessageMode(target), um: sourceMessage, text: sourceMessage.content || "", swipeTargetId: target.id, signal: controller.signal });
      return true;
    } catch (error) {
      if (!isRequestCancelled(error)) onSwipeError?.(error);
      return false;
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPendingRequest(null);
        setIsTyping(false);
      }
    }
  }, [currentCharacter, isTyping, chatHistory, getActiveRoomId, getMessageMode, setIsTyping, generateAssistant, onSwipeError, onSwipeLimit]);

  const deleteAssistantSwipe = useCallback((messageId, swipeIndex) => {
    if (!currentCharacter || isTyping || !Number.isInteger(swipeIndex) || swipeIndex < 0) return;
    const characterId = currentCharacter.id;
    setChatHistory((history) => ({
      ...history,
      [characterId]: (history[characterId] || []).map((message) => {
        if (message.id !== messageId || !Array.isArray(message.swipes) || message.swipes.length <= 1 || swipeIndex === message.swipeIndex) return message;
        if (swipeIndex >= message.swipes.length) return message;
        const swipes = message.swipes.filter((_, index) => index !== swipeIndex);
        const swipeIndexAfterDelete = swipeIndex < message.swipeIndex ? message.swipeIndex - 1 : message.swipeIndex;
        return { ...message, swipes, swipeIndex: swipeIndexAfterDelete };
      }),
    }));
  }, [currentCharacter, isTyping, setChatHistory]);

  const startCalendarStory = useCallback(async (calendarEvent) => {
    if (!currentCharacter || !calendarEvent?.id || isTyping) return false;
    const characterId = currentCharacter.id;
    const roomId = getActiveRoomId?.(characterId) || null;
    const previous = chatHistory[characterId] || [];
    const selectedMode = getSelectedMode(characterId);
    const notice = {
      id: createId(),
      role: "system_notice",
      noticeType: "calendar_story_start",
      calendarEvent,
      content: `📅 約定開始：${calendarEvent.title || "約定"}`,
      time: Date.now(),
    };
    const nextHistory = [...previous, notice];
    setChatHistory((history) => ({ ...history, [characterId]: nextHistory }));
    setIsTyping(true);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setPendingRequest({ characterId, roomId, messageId: notice.id });
    try {
      await generateAssistant({
        cid: characterId,
        roomId,
        char: currentCharacter,
        nextForDisplay: nextHistory,
        selectedMode,
        um: notice,
        text: "",
        signal: controller.signal,
      });
      return true;
    } catch (error) {
      if (!isRequestCancelled(error)) addErrorNotice(characterId, error, roomId);
      return false;
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPendingRequest(null);
        setIsTyping(false);
      }
    }
  }, [currentCharacter, isTyping, chatHistory, getActiveRoomId, getSelectedMode, createId, setChatHistory, setIsTyping, generateAssistant, addErrorNotice]);

  return { sendMessage, addMessageToBatch, retryMessage, retryLastUnansweredMessage, selectAssistantSwipe, generateAssistantSwipe, deleteAssistantSwipe, pendingRequest, startCalendarStory };
}

import { useCallback, useEffect, useRef } from "react";
import { createPseudoVoice, PSEUDO_VOICE_TEXT_LIMIT } from "../../utils/pseudoVoice";
import { isRequestCancelled } from "../../utils/networkRequest.js";

export default function useDirectChatAI({ currentCharacter, isTyping, chatHistory, chatInput, chatImage, chatPseudoImage, chatPseudoVoiceMode, getCommittedMode, getSelectedMode, getMessageMode, getTextLimit, isPlayerBlockedByCharacter, sanitizeText, createId, setChatHistory, setChatInput, setChatImage, setChatPseudoImage, setChatPseudoVoiceMode, setActionPanelOpen, setIsTyping, generateAssistant, addErrorNotice }) {
  const requestRef = useRef(null);
  useEffect(() => {
    requestRef.current?.abort();
    return () => requestRef.current?.abort();
  }, [currentCharacter?.id]);

  const sendMessage = useCallback(async () => {
    if (!currentCharacter || isTyping) return;
    const characterId = currentCharacter.id;
    const previous = chatHistory[characterId] || [];
    const committedMode = getCommittedMode(characterId);
    const selectedMode = getSelectedMode(characterId);
    const pseudoVoiceActive = chatPseudoVoiceMode && selectedMode !== "reality";
    const text = sanitizeText(chatInput.trim(), pseudoVoiceActive ? PSEUDO_VOICE_TEXT_LIMIT : getTextLimit(selectedMode));
    const image = pseudoVoiceActive ? null : (chatImage?.data || null);
    const pseudoImage = pseudoVoiceActive ? null : (chatPseudoImage || null);
    const pseudoVoice = pseudoVoiceActive ? createPseudoVoice(text) : null;
    if (!text && !image && !pseudoImage && !pseudoVoice) return;
    const now = Date.now();
    const transition = committedMode !== selectedMode ? { id: createId(), role: "mode_transition", fromMode: committedMode, toMode: selectedMode, time: now } : null;
    const userMessage = { id: createId(), role: "user", content: text, image, pseudoImage, pseudoVoice, imageSummary: "", mode: selectedMode, interceptedByCharacterBlock: selectedMode === "online" && isPlayerBlockedByCharacter?.(characterId) === true, time: now };
    const nextHistory = transition ? [...previous, transition, userMessage] : [...previous, userMessage];
    setChatHistory((history) => ({ ...history, [characterId]: nextHistory }));
    setChatInput(""); setChatImage(null); setChatPseudoImage(null); setChatPseudoVoiceMode(false); setActionPanelOpen(false); setIsTyping(true);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    try { await generateAssistant({ cid: characterId, char: currentCharacter, nextForDisplay: nextHistory, selectedMode, um: userMessage, text, signal: controller.signal }); }
    catch (error) { if (!isRequestCancelled(error)) addErrorNotice(characterId, error); }
    finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsTyping(false);
      }
    }
  }, [currentCharacter, isTyping, chatHistory, chatInput, chatImage, chatPseudoImage, chatPseudoVoiceMode, getCommittedMode, getSelectedMode, getTextLimit, isPlayerBlockedByCharacter, sanitizeText, createId, setChatHistory, setChatInput, setChatImage, setChatPseudoImage, setChatPseudoVoiceMode, setActionPanelOpen, setIsTyping, generateAssistant, addErrorNotice]);

  const retryMessage = useCallback(async (noticeId) => {
    if (!currentCharacter || isTyping) return;
    const characterId = currentCharacter.id;
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
    try { await generateAssistant({ cid: characterId, char: currentCharacter, nextForDisplay: nextHistory, selectedMode: getMessageMode(userMessage), um: userMessage, text: userMessage.content || "", signal: controller.signal }); }
    catch (error) { if (!isRequestCancelled(error)) addErrorNotice(characterId, error); }
    finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsTyping(false);
      }
    }
  }, [currentCharacter, isTyping, chatHistory, getMessageMode, setChatHistory, setIsTyping, generateAssistant, addErrorNotice]);

  return { sendMessage, retryMessage };
}

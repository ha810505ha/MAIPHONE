import { useCallback } from "react";

export default function useDirectChatAI({ currentCharacter, isTyping, chatHistory, chatInput, chatImage, getCommittedMode, getSelectedMode, getMessageMode, getTextLimit, sanitizeText, createId, setChatHistory, setChatInput, setChatImage, setActionPanelOpen, setIsTyping, generateAssistant, addErrorNotice }) {
  const sendMessage = useCallback(async () => {
    if (!currentCharacter || isTyping) return;
    const characterId = currentCharacter.id;
    const previous = chatHistory[characterId] || [];
    const committedMode = getCommittedMode(characterId);
    const selectedMode = getSelectedMode(characterId);
    const text = sanitizeText(chatInput.trim(), getTextLimit(selectedMode));
    const image = chatImage?.data || null;
    if (!text && !image) return;
    const now = Date.now();
    const transition = committedMode !== selectedMode ? { id: createId(), role: "mode_transition", fromMode: committedMode, toMode: selectedMode, time: now } : null;
    const userMessage = { id: createId(), role: "user", content: text, image, imageSummary: "", mode: selectedMode, time: now };
    const nextHistory = transition ? [...previous, transition, userMessage] : [...previous, userMessage];
    setChatHistory((history) => ({ ...history, [characterId]: nextHistory }));
    setChatInput(""); setChatImage(null); setActionPanelOpen(false); setIsTyping(true);
    try { await generateAssistant({ cid: characterId, char: currentCharacter, nextForDisplay: nextHistory, selectedMode, um: userMessage, text }); }
    catch (error) { addErrorNotice(characterId, error); }
    finally { setIsTyping(false); }
  }, [currentCharacter, isTyping, chatHistory, chatInput, chatImage, getCommittedMode, getSelectedMode, getTextLimit, sanitizeText, createId, setChatHistory, setChatInput, setChatImage, setActionPanelOpen, setIsTyping, generateAssistant, addErrorNotice]);

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
    try { await generateAssistant({ cid: characterId, char: currentCharacter, nextForDisplay: nextHistory, selectedMode: getMessageMode(userMessage), um: userMessage, text: userMessage.content || "" }); }
    catch (error) { addErrorNotice(characterId, error); }
    finally { setIsTyping(false); }
  }, [currentCharacter, isTyping, chatHistory, getMessageMode, setChatHistory, setIsTyping, generateAssistant, addErrorNotice]);

  return { sendMessage, retryMessage };
}

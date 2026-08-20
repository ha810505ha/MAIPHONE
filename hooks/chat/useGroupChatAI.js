import { useCallback, useEffect, useRef } from "react";
import { appendGroupMessages, removeGroupMessage } from "../../utils/messageState";
import { isRequestCancelled } from "../../utils/networkRequest.js";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export default function useGroupChatAI({ currentGroup, isTyping, input, image, pseudoImage, setInput, setImage, setPseudoImage, setActionPanelOpen, setIsTyping, setGroups, getMembers, getPlayerName, sanitizeText, createId, generateReplies, connectionErrorPrefix, tr }) {
  const requestRef = useRef(null);
  useEffect(() => {
    requestRef.current?.abort();
    return () => requestRef.current?.abort();
  }, [currentGroup?.id]);

  const appendReplies = useCallback(async (group, replies, signal) => {
    for (let index = 0; index < replies.length; index += 1) {
      if (index > 0) await wait(Math.round(220 + Math.max(0, Math.min(1, (replies[index - 1]?.content?.length || 0) / 220)) * 520));
      if (signal?.aborted) return;
      const reply = { id: createId(), role: "assistant", content: replies[index].content, pseudoImage: replies[index].pseudoImage || null, time: Date.now(), speakerId: replies[index].speakerId, speakerName: replies[index].speakerName };
      setGroups((groups) => appendGroupMessages(groups, group.id, [reply]));
    }
  }, [createId, setGroups]);

  const run = useCallback(async ({ group, baseMessages, userMessage, text, currentImage, signal }) => {
    try {
      const members = getMembers(group).map((member) => ({ ...member, profileText: member.profileText || "" }));
      const replies = await generateReplies({ group, members, messages: baseMessages, currentImage, signal });
      if (signal?.aborted) return;
      await appendReplies(group, replies, signal);
      if (signal?.aborted) return;
      if (currentImage && replies.length) {
        const summary = sanitizeText(`${text ? `{{user}} 訊息：${text}\n` : ""}重點：${replies.map((reply) => reply.content).join(" / ")}`.slice(0, 220), 220);
        if (summary) setGroups((groups) => groups.map((item) => item.id === group.id ? { ...item, messages: (item.messages || []).map((message) => message.id === userMessage.id ? { ...message, imageSummary: summary } : message), updatedAt: Date.now() } : item));
      }
    } catch (error) {
      if (isRequestCancelled(error)) return;
      const notice = { id: createId(), role: "system_notice", content: `${connectionErrorPrefix()}${sanitizeText(error?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 500)}`, time: Date.now() };
      setGroups((groups) => appendGroupMessages(groups, group.id, [notice]));
    }
  }, [getMembers, generateReplies, appendReplies, sanitizeText, setGroups, createId, connectionErrorPrefix, tr]);

  const sendGroupMessage = useCallback(async () => {
    if (!currentGroup || isTyping) return;
    const text = sanitizeText(input.trim(), 4000); const currentImage = image?.data || null;
    const currentPseudoImage = pseudoImage || null;
    if (!text && !currentImage && !currentPseudoImage) return;
    const userMessage = { id: createId(), role: "user", content: text, image: currentImage, imageMime: currentImage ? image?.mime : null, pseudoImage: currentPseudoImage, imageSummary: "", time: Date.now(), speakerName: getPlayerName() };
    const baseMessages = [...(currentGroup.messages || []), userMessage];
    setGroups((groups) => appendGroupMessages(groups, currentGroup.id, [userMessage]));
    setInput(""); setImage(null); setPseudoImage(null); setActionPanelOpen(false); setIsTyping(true);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    try { await run({ group: currentGroup, baseMessages, userMessage, text, currentImage, signal: controller.signal }); }
    finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsTyping(false);
      }
    }
  }, [currentGroup, isTyping, input, image, pseudoImage, sanitizeText, createId, getPlayerName, setGroups, setInput, setImage, setPseudoImage, setActionPanelOpen, setIsTyping, run]);

  const retryGroupMessage = useCallback(async (noticeId) => {
    if (!currentGroup || isTyping) return;
    const list = currentGroup.messages || []; const index = list.findIndex((message) => message.id === noticeId);
    if (index < 0) return;
    const userMessage = [...list.slice(0, index)].reverse().find((message) => message.role === "user");
    if (!userMessage) return;
    const baseMessages = list.filter((message) => message.id !== noticeId);
    setGroups((groups) => removeGroupMessage(groups, currentGroup.id, noticeId));
    setIsTyping(true);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    try { await run({ group: currentGroup, baseMessages, userMessage, text: userMessage.content || "", currentImage: null, signal: controller.signal }); }
    finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsTyping(false);
      }
    }
  }, [currentGroup, isTyping, setGroups, setIsTyping, run]);
  return { sendGroupMessage, retryGroupMessage };
}

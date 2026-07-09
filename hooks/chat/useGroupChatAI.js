import { useCallback } from "react";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export default function useGroupChatAI({ currentGroup, isTyping, input, image, setInput, setImage, setActionPanelOpen, setIsTyping, setGroups, getMembers, getPlayerName, getPlayerAvatar, sanitizeText, sanitizeImageUrl, createId, generateReplies, connectionErrorPrefix, tr }) {
  const appendReplies = useCallback(async (group, baseMessages, replies) => {
    let working = [...baseMessages];
    for (let index = 0; index < replies.length; index += 1) {
      if (index > 0) await wait(Math.round(220 + Math.max(0, Math.min(1, (replies[index - 1]?.content?.length || 0) / 220)) * 520));
      const reply = { id: createId(), role: "assistant", content: replies[index].content, time: Date.now(), speakerName: replies[index].speakerName, speakerAvatar: replies[index].speakerAvatar };
      working = [...working, reply];
      setGroups((groups) => groups.map((item) => item.id === group.id ? { ...item, messages: working, updatedAt: Date.now() } : item));
    }
    return working;
  }, [createId, setGroups]);

  const run = useCallback(async ({ group, baseMessages, userMessage, text, currentImage }) => {
    try {
      const members = getMembers(group).map((member) => ({ ...member, profileText: member.profileText || "" }));
      const replies = await generateReplies({ group, members, messages: baseMessages, currentImage });
      await appendReplies(group, baseMessages, replies);
      if (currentImage && replies.length) {
        const summary = sanitizeText(`${text ? `{{user}} 訊息：${text}\n` : ""}重點：${replies.map((reply) => reply.content).join(" / ")}`.slice(0, 220), 220);
        if (summary) setGroups((groups) => groups.map((item) => item.id === group.id ? { ...item, messages: (item.messages || []).map((message) => message.id === userMessage.id ? { ...message, imageSummary: summary } : message), updatedAt: Date.now() } : item));
      }
    } catch (error) {
      const notice = { id: createId(), role: "system_notice", content: `${connectionErrorPrefix()}${sanitizeText(error?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 500)}`, time: Date.now() };
      setGroups((groups) => groups.map((item) => item.id === group.id ? { ...item, messages: [...baseMessages, notice], updatedAt: Date.now() } : item));
    }
  }, [getMembers, generateReplies, appendReplies, sanitizeText, setGroups, createId, connectionErrorPrefix, tr]);

  const sendGroupMessage = useCallback(async () => {
    if (!currentGroup || isTyping) return;
    const text = sanitizeText(input.trim(), 4000); const currentImage = image?.data || null;
    if (!text && !currentImage) return;
    const userMessage = { id: createId(), role: "user", content: text, image: currentImage, imageSummary: "", time: Date.now(), speakerName: getPlayerName(), speakerAvatar: sanitizeImageUrl(getPlayerAvatar()) };
    const baseMessages = [...(currentGroup.messages || []), userMessage];
    setGroups((groups) => groups.map((group) => group.id === currentGroup.id ? { ...group, messages: baseMessages, updatedAt: Date.now() } : group));
    setInput(""); setImage(null); setActionPanelOpen(false); setIsTyping(true);
    try { await run({ group: currentGroup, baseMessages, userMessage, text, currentImage }); } finally { setIsTyping(false); }
  }, [currentGroup, isTyping, input, image, sanitizeText, createId, getPlayerName, sanitizeImageUrl, getPlayerAvatar, setGroups, setInput, setImage, setActionPanelOpen, setIsTyping, run]);

  const retryGroupMessage = useCallback(async (noticeId) => {
    if (!currentGroup || isTyping) return;
    const list = currentGroup.messages || []; const index = list.findIndex((message) => message.id === noticeId);
    if (index < 0) return;
    const userMessage = [...list.slice(0, index)].reverse().find((message) => message.role === "user");
    if (!userMessage) return;
    const baseMessages = list.filter((message) => message.id !== noticeId);
    setGroups((groups) => groups.map((group) => group.id === currentGroup.id ? { ...group, messages: baseMessages, updatedAt: Date.now() } : group));
    setIsTyping(true);
    try { await run({ group: currentGroup, baseMessages, userMessage, text: userMessage.content || "", currentImage: null }); } finally { setIsTyping(false); }
  }, [currentGroup, isTyping, setGroups, setIsTyping, run]);
  return { sendGroupMessage, retryGroupMessage };
}

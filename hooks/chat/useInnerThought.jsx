import React from "react";
import { InnerThoughtPanel } from "../../components/chat/ChatMessageParts";
import { pseudoImagePromptLine } from "../../utils/pseudoImage";
import { pseudoVoicePromptLine } from "../../utils/pseudoVoice";
import { getMaliTestPlayerError } from "../../services/cloud/maliTestService";

export default function useInnerThought({
  chatHistory,
  getActiveStoryStatus,
  innerThoughtLoading,
  expandedInnerThoughts,
  apiConfig,
  setChatHistory,
  getActiveRoomId,
  updateRoomMessages,
  setInnerThoughtLoading,
  setExpandedInnerThoughts,
  pickMemoriesForPrompt,
  getMessageMode,
  getOutputLanguageDirective,
  getUserDisplayName,
  applyUserPlaceholder,
  estimateTokens,
  stripInternalBlocks,
  callAI,
  sanitizeText,
  showToast,
  tr,
}) {
  const normalizeInnerThought = (text) => {
    let clean = stripInternalBlocks(String(text || ""))
      .replace(/^\s*(?:心聲|內心(?:想法|獨白)?|想法)\s*[：:]\s*/i, "")
      .replace(/^[「『"']+|[」』"']+$/g, "")
      .replace(/\{\{char\}\}/gi, "")
      .replace(/\{\{user\}\}/gi, getUserDisplayName())
      .replace(/\n{2,}/g, "\n")
      .trim();
    clean = sanitizeText(clean, 240);
    if (clean.length === 240) {
      const lastEnd = Math.max(...["。", "！", "？", "…", "～", "!", "?", "."].map((mark) => clean.lastIndexOf(mark)));
      if (lastEnd > 0) clean = clean.slice(0, lastEnd + 1);
    }
    return clean;
  };

  const isIncompleteInnerThought = (text) => {
    const clean = String(text || "").trim();
    return !clean || !/[。！？…～!?.」』"'）)\]】]$/.test(clean);
  };

  const generateInnerThought = async ({ char, messageId, source = "manual", historySnapshot = null, updateMessages = null }) => {
    if (!char?.id || !messageId || innerThoughtLoading[messageId]) return;
    const sourceRoomId = getActiveRoomId?.(char.id) || null;
    const fullHistory = Array.isArray(historySnapshot) ? historySnapshot : (chatHistory[char.id] || []);
    const targetIndex = fullHistory.findIndex((message) => message.id === messageId);
    if (targetIndex < 0 || fullHistory[targetIndex]?.role !== "assistant") return;
    const target = fullHistory[targetIndex];
    const replyMessages = target.replyGroupId
      ? fullHistory.slice(0, targetIndex + 1).filter((message) => message.role === "assistant" && message.replyGroupId === target.replyGroupId)
      : (() => {
          const group = [];
          for (let index = targetIndex; index >= 0 && fullHistory[index]?.role === "assistant"; index -= 1) group.unshift(fullHistory[index]);
          return group;
        })();
    const targetReply = replyMessages.map((message) => message.content || "").filter(Boolean).join("\n");
    const targetMode = getMessageMode(target);
    const roundLimit = targetMode === "reality" ? 3 : 6;
    const eligibleMessages = fullHistory
      .slice(0, targetIndex + 1)
      .filter((message) => message.role === "user" || message.role === "assistant")
      .filter((message) => getMessageMode(message) === targetMode);
    const recentRoundMessages = [];
    let includedRounds = 0;
    for (let index = eligibleMessages.length - 1; index >= 0; index -= 1) {
      const message = eligibleMessages[index];
      if (message.role === "user") {
        includedRounds += 1;
        if (includedRounds > roundLimit) break;
      }
      recentRoundMessages.unshift(message);
    }
    let contextMessages = recentRoundMessages.map((message) => ({
      role: message.role,
      content: sanitizeText(`${message.pseudoVoice ? "" : (message.content || "")}${pseudoImagePromptLine(message.pseudoImage, message.role === "user" ? "{{user}}" : "你")}${pseudoVoicePromptLine(message.pseudoVoice, message.role === "user" ? "{{user}}" : "你")}`.trim() || (message.image ? "[圖片]" : ""), 1200),
    }));
    const memoryContext = pickMemoriesForPrompt(char.id, contextMessages).map((memory, index) => `- ${index + 1}. ${memory.text}`).join("\n");
    const scene = getActiveStoryStatus?.(char.id) || {};
    const sceneContext = [
      scene.scene ? `當前場景：${sanitizeText(scene.scene, 240)}` : "",
      scene.relationship ? `當前關係：${sanitizeText(scene.relationship, 240)}` : "",
      scene.mood ? `當前情緒：${sanitizeText(scene.mood, 240)}` : "",
      scene.current ? `進行中：${sanitizeText(scene.current, 240)}` : "",
    ].filter(Boolean).join("\n");
    const prompt = `${getOutputLanguageDirective()}

你要寫的是角色「${char.name}」在目標訊息當下沒有說出口的心聲。

規則：
1. 必須使用角色第一人稱，並與目標訊息及當時劇情直接相關。
2. 只輸出心聲本身，不要角色名、標籤、引號、旁白、Markdown 或「我心想」。
3. 只寫 1 到 2 句，簡短自然，最多 80 字；每句都必須完整，不得在逗號、冒號或未完成語意處中斷。
4. 可以呈現嘴硬、猶豫、期待、隱瞞或話語與真心的反差，但不要為了反差硬加感情。
5. 不要替玩家描述內心、感受或未說出口的意圖。
6. 不要使用角色在當時不可能知道的資訊，也不要參考目標訊息之後的劇情。
7. 保留曖昧與留白，不要一次揭露角色所有秘密。

${sceneContext ? `[當時場景]\n${sceneContext}\n` : ""}${memoryContext ? `[相關記憶]\n${memoryContext}\n` : ""}
目標回覆（前端可能拆成多個氣泡，但屬於同一次回覆）：
${targetReply || target.content || "（無文字）"}`;
    const thoughtInstruction = "請根據以上對話與系統規則，生成角色在目標回覆當下沒有說出口的心聲。只輸出心聲本身。";
    const countTokens = () => estimateTokens(prompt) + estimateTokens(thoughtInstruction) + contextMessages.reduce((sum, message) => sum + estimateTokens(message.content || ""), 0);
    while (contextMessages.length > 1 && countTokens() > 3000) contextMessages = contextMessages.slice(1);

    setInnerThoughtLoading((previous) => ({ ...previous, [messageId]: true }));
    try {
      const thoughtMessages = [...contextMessages, { role: "user", content: thoughtInstruction }];
      let raw = await callAI(thoughtMessages, { ...apiConfig, maxTokens: 3000 }, applyUserPlaceholder(prompt), {
        app: "chat",
        action: "inner_thought",
      });
      if (isIncompleteInnerThought(raw)) {
        raw = await callAI([
          ...thoughtMessages,
          { role: "assistant", content: raw },
          { role: "user", content: "上一版心聲在語意未完成處中斷。請重新輸出一版完整的心聲，維持 1 到 2 句、最多 80 字，只輸出心聲本身。" },
        ], { ...apiConfig, maxTokens: 3000 }, applyUserPlaceholder(prompt), {
          app: "chat",
          action: "inner_thought_retry",
        });
      }
      if (isIncompleteInnerThought(raw)) throw new Error(tr("模型回傳的心聲不完整，請再試一次", "The generated thought was incomplete. Please try again.", "生成された心の声が不完全です。もう一度お試しください", "생성된 속마음이 완전하지 않습니다. 다시 시도해주세요"));
      const content = normalizeInnerThought(raw);
      if (!content) throw new Error(tr("模型沒有產生心聲", "No inner thought was generated", "心の声が生成されませんでした", "속마음이 생성되지 않았습니다"));
      const applyThought = (messages) => messages.map((message) => message.id === messageId
        ? { ...message, innerThought: { content, generatedAt: Date.now(), source, seen: source !== "auto" } }
        : message);
      if (typeof updateMessages === "function") updateMessages(applyThought);
      else if (typeof updateRoomMessages === "function") updateRoomMessages(char.id, sourceRoomId, applyThought);
      else {
        setChatHistory((previous) => ({
          ...previous,
          [char.id]: applyThought(previous[char.id] || []),
        }));
      }
      setExpandedInnerThoughts((previous) => ({ ...previous, [messageId]: source !== "auto" }));
      if (source === "auto") showToast(`${char.name || tr("角色", "The character", "キャラ", "캐릭터")}${tr(" 好像在想些什麼…", " seems to be thinking about something...", " は何か考えているみたい…", "이(가) 뭔가 생각하는 것 같아…")}`);
    } catch (error) {
      const playerError = getMaliTestPlayerError(error, tr);
      showToast(playerError || `${tr("心聲生成失敗", "Failed to generate inner thought", "心の声の生成に失敗しました", "속마음 생성 실패")}：${sanitizeText(error?.message || "", 120)}`);
    } finally {
      setInnerThoughtLoading((previous) => ({ ...previous, [messageId]: false }));
    }
  };

  const renderInnerThought = (char, message) => {
    if (message?.role !== "assistant") return null;
    const thought = message.innerThought?.content || "";
    const expanded = !!expandedInnerThoughts[message.id];
    const loading = !!innerThoughtLoading[message.id];
    const unseen = !!thought && message.innerThought?.source === "auto" && message.innerThought?.seen === false;
    const markSeen = () => {
      if (!unseen) return;
      setChatHistory((previous) => ({
        ...previous,
        [char.id]: (previous[char.id] || []).map((item) => item.id === message.id ? { ...item, innerThought: { ...item.innerThought, seen: true } } : item),
      }));
    };
    return <InnerThoughtPanel thought={thought} expanded={expanded} loading={loading} unseen={unseen} tr={tr} onToggle={() => {
      if (thought) {
        if (!expanded) markSeen();
        setExpandedInnerThoughts((previous) => ({ ...previous, [message.id]: !previous[message.id] }));
      } else void generateInnerThought({ char, messageId: message.id, source: "manual" });
    }} onRegenerate={() => void generateInnerThought({ char, messageId: message.id, source: "manual" })} />;
  };

  return { generateInnerThought, renderInnerThought };
}

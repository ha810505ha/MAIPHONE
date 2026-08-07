import { REALITY_CHAT_TEXT_LIMIT, normalizeAssistantReply, normalizeRealityReply, splitAssistantBubbles } from "../../utils/chatMessageUtils";
import { gid, sanitizeText as defaultSanitizeText } from "../../utils/coreUtils";
import { extractPhotoDirectives } from "../../utils/pseudoImage";
import { extractPseudoVoiceDirectives, VOICE_MESSAGE_RULE_CONTEXT } from "../../utils/pseudoVoice";
import { buildCharacterBlockPromptContext } from "../../services/chat/characterBlockState";
import { stripInternalBlocks, stripModeLabel } from "../../utils/chatMessageUtils";

const PROACTIVE_FREQUENCY_HOURS = {
  occasional: [8, 16],
  normal: [4, 8],
  active: [2.5, 4],
  always: [1.5, 2.5],
  low: [8, 16],
  high: [2.5, 4],
};

const PROACTIVE_DAILY_CAP = {
  off: 0,
  occasional: 3,
  normal: 6,
  active: 10,
  always: 15,
  low: 3,
  high: 10,
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 角色可以選擇不開口。
 *
 * 排程只負責「現在可以問問看」，要不要說話交給角色自己判斷：省下的是 API 額度，
 * 換來的是角色不會每次時間到就機械性地冒出一句話。沉默不寫入訊息、不計入每日上限，
 * 但會重置閒置時鐘（見 lastSilentAt），否則下一輪掃描會立刻重問同一個角色。
 */
const SILENT_MARKER = "SILENT";
const SILENT_PATTERN = /^[\s"'「『（(\[【]*silent[\s"'」』）)\]】。.!！]*$/i;
const isSilentReply = (text) => SILENT_PATTERN.test(String(text || "").trim());

/**
 * Coordinates idle-triggered character messages.
 *
 * Eligibility, daily caps, prompt assembly, and unread bookkeeping belong to
 * the proactive chat domain rather than the phone shell. The controller is
 * intentionally callback-driven so it can reuse the app's existing storage,
 * prompt, provider, and message state boundaries.
 */
export default function useProactiveChatController({
  characters,
  chatHistory,
  proactiveSettings,
  proactiveUnread,
  characterBlockStates,
  hydrated,
  apiConfig,
  pauseProactive,
  proactiveSweepingRef,
  currentChatCharIdRef,
  buildChatSystemPrompt,
  formatMessagesForPrompt,
  pickMemoriesForPrompt,
  pickLorebookEntriesForPrompt,
  getLastCommittedChatMode,
  applyUserPlaceholder,
  sanitizeText = defaultSanitizeText,
  callAI,
  canUseCurrentProvider,
  setChatHistory,
  setProactiveSettings,
  setProactiveUnread,
  createId = gid,
}) {
  const proactiveDayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

  const getProactiveIdleThresholdMs = (frequency) => {
    const [minHours, maxHours] = PROACTIVE_FREQUENCY_HOURS[frequency] || PROACTIVE_FREQUENCY_HOURS.normal;
    return (minHours + Math.random() * (maxHours - minHours)) * 60 * 60 * 1000;
  };

  const getProactiveEligibleCharacters = () => {
    const now = Date.now();
    const today = proactiveDayKey();
    return characters.filter((character) => {
      const settings = proactiveSettings?.[character.id];
      if (!settings?.enabled) return false;
      const frequency = settings.frequency || "normal";
      if (frequency === "off") return false;
      const dailyCount = settings.proactiveDay === today ? Number(settings.proactiveCount) || 0 : 0;
      if (dailyCount >= (PROACTIVE_DAILY_CAP[frequency] ?? 6)) return false;
      if (proactiveUnread?.[character.id]) return false;
      const messages = chatHistory[character.id] || [];
      if (!messages.length) return false;
      const lastMessage = messages[messages.length - 1];
      // 上次選擇沉默也算「剛互動過」，否則下一輪掃描會立刻重問同一個角色。
      const since = Math.max(Number(lastMessage?.time) || 0, Number(settings.lastSilentAt) || 0);
      const idle = now - since;
      return idle > getProactiveIdleThresholdMs(frequency);
    });
  };

  const triggerProactiveMessage = async (character) => {
    const characterId = character.id;
    try {
      const recent = formatMessagesForPrompt((chatHistory[characterId] || []).slice(-16));
      const memoryContext = pickMemoriesForPrompt(characterId, recent)
        .map((memory, index) => `- ${index + 1}. ${memory.text}`)
        .join("\n");
      const pinnedLoreContext = pickLorebookEntriesForPrompt(characterId, recent)
        .filter((item) => item.mode === "PIN")
        .map((item, index) => `${index + 1}. [${item.bookName}] ${item.entry.title || "條目"}：${item.entry.content || ""}`)
        .join("\n");
      const mergedMemoryContext = [
        memoryContext,
        pinnedLoreContext ? `[強制條目]\n${pinnedLoreContext}` : "",
      ].filter(Boolean).join("\n\n");
      const selectedMode = getLastCommittedChatMode(characterId);
      // 沉默出口寫在規則最後，避免被前面「請主動傳訊息」的指令蓋過。
      const silenceRule = `\n\n[可以選擇不開口]\n如果依照 {{char}} 的個性、當下處境或你們最近的關係，此刻主動開口並不自然（例如剛吵完架、角色正在忙、上一段對話已經好好收尾、或就是沒有想說的事），那就不要勉強找話題。這種情況下只輸出 ${SILENT_MARKER} 這個字，不要有任何其他內容、標點或解釋。沉默是正常且允許的選擇，不會被視為失敗。`;
      const proactiveRule = selectedMode === "reality"
        ? `[主動互動觸發 - 系統規則]\n距離上次互動已經過了一段時間。現在請你以 {{char}} 的身份，在現實場景中主動與 {{user}} 互動，用一段連貫的段落呈現（可包含敘述、動作、對話），自然地開啟話題或延續先前情境，符合角色個性與最近脈絡。不要提到「系統」「AI」「觸發」等字眼，也不要解釋自己為什麼開口，也不要輸出轉帳指令。`
        : `[主動訊息觸發 - 系統規則]\n距離上次互動已經過了一段時間沒有新訊息。現在請你以 {{char}} 的身份，主動傳一則（或幾則）訊息給 {{user}}，自然地開啟話題或延續先前對話，語氣與內容要符合角色個性與最近對話脈絡。不要提到「系統」「AI」「觸發」等字眼，也不要解釋自己為什麼傳訊息，也不要輸出轉帳指令。`;
      const proactiveBlockContext = buildCharacterBlockPromptContext({
        state: characterBlockStates?.[characterId],
        mode: selectedMode,
        now: Date.now(),
      });
      const proactiveContext = [
        mergedMemoryContext,
        proactiveBlockContext,
        selectedMode === "online" ? VOICE_MESSAGE_RULE_CONTEXT : "",
      ].filter(Boolean).join("\n\n");
      const systemPrompt = applyUserPlaceholder(
        `${buildChatSystemPrompt(character, proactiveContext, apiConfig.model, selectedMode)}\n\n${proactiveRule}${silenceRule}`,
      );
      const triggerMessage = {
        role: "user",
        content: applyUserPlaceholder("[系統觸發]\n這不是 {{user}} 說的話，只是系統提示：時間已經過去，請 {{char}} 主動傳訊息給 {{user}}。"),
        image: null,
      };
      const finalHistory = [
        ...recent.map((message) => ({ ...message, content: applyUserPlaceholder(message.content) })),
        triggerMessage,
      ];
      const reply = await callAI(finalHistory, apiConfig, systemPrompt, {
        feature: "chat",
        mode: selectedMode === "reality" ? "reality" : "online",
        app: "chat",
        action: "proactive_reply",
      });
      const markSilent = () => setProactiveSettings((settings) => ({
        ...settings,
        [characterId]: { ...(settings?.[characterId] || {}), lastSilentAt: Date.now() },
      }));
      if (isSilentReply(reply)) return markSilent();
      const cleanReplyRaw = selectedMode === "reality"
        ? sanitizeText(normalizeRealityReply(reply), REALITY_CHAT_TEXT_LIMIT)
        : normalizeAssistantReply(reply);
      const voiceExtracted = selectedMode === "online"
        ? extractPseudoVoiceDirectives(cleanReplyRaw)
        : { text: cleanReplyRaw, voices: [] };
      const photoExtracted = extractPhotoDirectives(voiceExtracted.text);
      const cleanReply = stripModeLabel(stripInternalBlocks(photoExtracted.text));
      // 再檢一次：模型可能把 SILENT 包在模式標籤或內部區塊裡，清乾淨後才看得出來。
      const onlySilent = isSilentReply(cleanReply)
        && !photoExtracted.photos.length
        && !voiceExtracted.voices.length;
      if (onlySilent) return markSilent();
      if (!cleanReply.trim() && !photoExtracted.photos.length && !voiceExtracted.voices.length) return markSilent();
      const bubbles = (selectedMode === "reality" ? [cleanReply] : splitAssistantBubbles(cleanReply))
        .filter((bubble) => bubble.trim());
      const replyGroupId = createId();
      let firedAny = false;
      for (let index = 0; index < bubbles.length; index += 1) {
        await wait(index === 0 ? 260 : Math.min(900, 400 + bubbles[index].length * 14));
        const message = {
          id: createId(),
          replyGroupId,
          replyGroupIndex: index,
          replyGroupSize: bubbles.length,
          role: "assistant",
          content: bubbles[index],
          mode: selectedMode,
          proactive: true,
          interceptedByBlock: selectedMode === "online" && characterBlockStates?.[characterId]?.blocked === true,
          time: Date.now(),
        };
        firedAny = true;
        setChatHistory((history) => ({ ...history, [characterId]: [...(history[characterId] || []), message] }));
      }
      for (const pseudoVoice of voiceExtracted.voices) {
        await wait(320);
        firedAny = true;
        setChatHistory((history) => ({
          ...history,
          [characterId]: [...(history[characterId] || []), {
            id: createId(),
            role: "assistant",
            content: pseudoVoice.transcript,
            pseudoVoice,
            mode: "online",
            proactive: true,
            interceptedByBlock: characterBlockStates?.[characterId]?.blocked === true,
            time: Date.now(),
          }],
        }));
      }
      for (const photo of photoExtracted.photos) {
        await wait(320);
        firedAny = true;
        setChatHistory((history) => ({
          ...history,
          [characterId]: [...(history[characterId] || []), {
            id: createId(),
            role: "assistant",
            content: "",
            pseudoImage: photo,
            mode: selectedMode,
            proactive: true,
            interceptedByBlock: selectedMode === "online" && characterBlockStates?.[characterId]?.blocked === true,
            time: Date.now(),
          }],
        }));
      }
      if (!firedAny) return;
      const today = proactiveDayKey();
      setProactiveSettings((settings) => ({
        ...settings,
        [characterId]: {
          ...(settings?.[characterId] || {}),
          proactiveDay: today,
          proactiveCount: (settings?.[characterId]?.proactiveDay === today
            ? Number(settings?.[characterId]?.proactiveCount) || 0
            : 0) + 1,
        },
      }));
      if (currentChatCharIdRef.current !== characterId) {
        setProactiveUnread((unread) => ({
          ...unread,
          [characterId]: (Number(unread?.[characterId]) || 0) + bubbles.length,
        }));
      }
    } catch (error) {
      console.warn("[proactive message]", error);
    }
  };

  const runProactiveSweep = () => {
    if (!hydrated || proactiveSweepingRef.current || !canUseCurrentProvider()) return;
    if (pauseProactive) return;
    const eligible = getProactiveEligibleCharacters();
    if (!eligible.length) return;
    const character = eligible[Math.floor(Math.random() * eligible.length)];
    proactiveSweepingRef.current = true;
    triggerProactiveMessage(character).finally(() => {
      proactiveSweepingRef.current = false;
    });
  };

  return {
    getProactiveEligibleCharacters,
    triggerProactiveMessage,
    runProactiveSweep,
  };
}

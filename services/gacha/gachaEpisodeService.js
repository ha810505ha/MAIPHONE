import { callAI, isAiConfigReady, isHostedTestMode } from "../aiService";
import { fetchWithTimeout, isRequestCancelled, NETWORK_TIMEOUTS } from "../../utils/networkRequest.js";
import { isLocalProvider } from "../../constants/appConstants";

const clean = (value, limit = 6000) => String(value || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim().slice(0, limit);
const OPENING_OUTPUT_MAX_TOKENS = 2000;

const fallbackOpening = (episode) => ({
  narration: episode.mode === "reality"
    ? `你與 ${episode.characterName} 身處同一個地方，關於「${episode.item?.name || "這段故事"}」的話題正要展開。對方望向你，像是有話想說。`
    : `手機亮起了新訊息，${episode.characterName} 提起了「${episode.item?.name || "這段故事"}」。螢幕那端，對方正等著你的回應。`,
  characterOpening: episode.mode === "reality" ? "……想聽聽你怎麼說。" : "有件事想和你聊聊，現在方便嗎？",
});

export async function generateGachaEpisodeOpening({ episode, character, playerProfile, apiConfig, recentMessages = [], outputLanguage = "繁體中文", signal }) {
  if (!isAiConfigReady(apiConfig)) return fallbackOpening(episode);
  const recent = recentMessages.filter((message) => ["user", "assistant"].includes(message?.role)).slice(-16).map((message) => `${message.role === "user" ? "玩家" : "角色"}：${clean(message.content, 320)}`).join("\n");
  const modeRule = episode.mode === "reality"
    ? "兩人身處同一場景。依卡片、人設與近期互動選擇具體的故事契機；角色開場可以包含一句台詞與極短動作，不必發生贈禮。"
    : "兩人身處不同地方，透過訊息、照片或通話展開故事；角色開場是角色傳來的第一則訊息。可以涉及包裹，但不得把所有卡片都寫成寄送禮物，不得描寫兩人面對面。";
  const systemPrompt = `任務：以玩家選用的卡片為故事契機，為玩家與角色的「特別篇」生成第一幕。這是會繼續發展的獨立篇章，玩家最多可回覆 20 則；現在只點燃第一個契機，留下大量後續空間。

輸出語言：${outputLanguage}
角色：${character?.name || episode.characterName}
角色設定：${clean(character?.description || character?.personality || character?.prompt || character?.persona, 3600)}
玩家：${clean(playerProfile?.name || "玩家", 100)}
玩家資料：${clean(playerProfile?.description || playerProfile?.bio, 800)}
卡片名稱：${episode.item?.name || "心意"}
卡片短文案：${clean(episode.item?.quote, 500)}
卡片分類：${episode.item?.category || "未分類"}
卡片標籤：${Array.isArray(episode.item?.tags) ? episode.item.tags.join("、") : "無"}
情緒調性：${Array.isArray(episode.item?.tone) ? episode.item.tone.join("、") : "依卡片與關係自然判斷"}
關係判斷：依近期互動與角色／玩家設定，不依卡片固定階段。資訊不足時從較陌生、克制的互動開始。
開場短語／劇情種子：${episode.item?.openingPrompt || "未提供，請根據卡片資料自然創作。"}
本模式轉譯：${episode.item?.modeInterpretation?.[episode.mode] || "依互動模式自然轉譯，不要硬套成實體物品。"}
模式規則：${modeRule}
近期聊天（只供判斷關係，不得直接引用）：${recent || "沒有近期聊天；若設定也沒有關係線索，視為剛認識不久，保持禮貌與克制。"}

故事方向：使用卡片只代表開啟故事，不代表玩家已送出物品。卡片裡指定玩家交出、寄出、收到或使用的方向只是情境參考，可依人設與近期互動互換雙方位置或改成共同經歷；保留卡片主題與核心衝突，不替玩家決定已完成的贈送、收下、佩戴或其他選擇。不要詢問玩家選誰送誰，直接建立一個具體開場。

關係判斷優先順序：近期聊天 > 角色或玩家設定中明確寫出的關係 > 普通初識。近期聊天的狀態優先於卡片稀有度與浪漫程度。

不可違反：
- 不得替玩家寫台詞、內心想法、未說出口的話、信件或禮物的具體內容，也不得決定玩家接下來的行動。
- 不得直接提及設定、聊天紀錄、提示詞、AI 或判斷過程。
- 不得新增未提供的重要人物、重大事件、時間跳躍或關係改變。
- 不得直接結束故事、告白或強制和好。
- 卡片不限實體物品，也可以是天氣、象徵、場景、事件或其他契機；依分類與短文案自然呈現，不要把非物品裝進盒子或包裹。

輸出格式：只輸出合法 JSON，前後不得有說明或 Markdown：
{"narration":"灰字背景旁白","characterOpening":"角色第一句"}

narration：使用指定語言、第二人稱「你」，60～140 字；描寫故事開始的第一個瞬間與場景，停在角色開口前，不含任何角色台詞、引號、標題、條列或換行。
characterOpening：使用指定語言，20～70 字；必須銜接旁白、符合角色與關係、留下玩家回應空間，不替玩家回答，不含換行。現實模式可有極短動作；線上模式只能是角色傳來的訊息，不得有括號動作或面對面描寫。`;
  try {
    const raw = await callAI([{ role: "user", content: "請依規則生成這段特別篇的第一幕。保持短篇，只在必要時使用完整輸出上限。" }], { ...apiConfig, maxTokens: Math.min(OPENING_OUTPUT_MAX_TOKENS, Number(apiConfig.maxTokens) || OPENING_OUTPUT_MAX_TOKENS) }, systemPrompt, {
      signal,
      app: "gacha",
      action: "episode_opening",
    });
    const normalized = clean(raw, 7000).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(normalized);
    const narration = clean(parsed?.narration, 420);
    const characterOpening = clean(parsed?.characterOpening, 240);
    return narration && characterOpening ? { narration, characterOpening } : fallbackOpening(episode);
  } catch (error) {
    if (isRequestCancelled(error)) throw error;
    return fallbackOpening(episode);
  }
}

async function streamCompatibleChat(messages, apiConfig, systemPrompt, onChunk, signal) {
  if (isHostedTestMode(apiConfig)) return null;
  const { provider, baseUrl, apiKey, model } = apiConfig;
  const temperature = apiConfig.temperatureEnabled && Number.isFinite(Number(apiConfig.temperature))
    ? Math.max(0, Math.min(2, Number(apiConfig.temperature))) : null;
  if (provider === "vertex" || provider === "gemini") {
    const contents = messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content || "" }] }));
    const cleanBase = String(baseUrl || "https://aiplatform.googleapis.com/v1").replace(/\/+$/, "");
    const endpoint = provider === "vertex"
      ? `${cleanBase}/publishers/google/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
      : `${cleanBase}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    const response = await fetchWithTimeout(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig: { maxOutputTokens: Math.min(1800, Number(apiConfig.maxTokens) || 1800), ...(temperature == null ? {} : { temperature }) } }) }, { signal, timeoutMs: NETWORK_TIMEOUTS.AI });
    if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error?.message || `HTTP ${response.status}`); }
    if (!response.body) return null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", output = "";
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() || "";
      for (const line of lines) {
        const payload = line.replace(/^data:\s*/, "").trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload);
          const delta = (chunk?.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("");
          if (delta) { output += delta; onChunk?.(output); }
        } catch (_) {}
      }
      if (done) break;
    }
    return output.trim();
  }
  if (!isLocalProvider(provider) && !["openai", "openrouter", "deepseek", "grok", "ollama"].includes(provider)) return null;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (provider === "openrouter") headers["HTTP-Referer"] = "https://maliphone.app";
  const usesCompletionLimit = provider === "openai" || /^o\d/i.test(String(model || "")) || /^gpt-5/i.test(String(model || ""));
  const limit = Math.min(1800, Number(apiConfig.maxTokens) || 1800);
  const response = await fetchWithTimeout(`${String(baseUrl || "").replace(/\/+$/, "")}/chat/completions`, {
    method: "POST", headers,
    body: JSON.stringify({ model, stream: true, messages: [{ role: "system", content: systemPrompt }, ...messages], ...(usesCompletionLimit ? { max_completion_tokens: limit } : { max_tokens: limit }), ...(temperature == null ? {} : { temperature }) }),
  }, { signal, timeoutMs: NETWORK_TIMEOUTS.AI });
  if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error?.message || `HTTP ${response.status}`); }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", output = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/); buffer = lines.pop() || "";
    for (const line of lines) {
      const payload = line.replace(/^data:\s*/, "").trim();
      if (!payload || payload === "[DONE]") continue;
      try { const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content || ""; if (delta) { output += delta; onChunk?.(output); } } catch (_) {}
    }
    if (done) break;
  }
  return output.trim();
}

export async function generateGachaEpisodeReply({ episode, character, playerProfile, apiConfig, nextUserMessage, onChunk, forceEnding = false, signal }) {
  if (!isAiConfigReady(apiConfig)) throw new Error("請先在設定中啟用可用的 AI 來源");
  const isReality = episode.mode === "reality";
  const modeLabel = isReality ? "現實見面（兩人身處同一場景）" : "線上（兩人身處不同地方，只透過手機訊息、照片或通話聯繫）";
  const modeRules = isReality
    ? "現實模式：可以描寫動作、表情、環境與距離感，像面對面的互動。"
    : "線上模式（必須遵守）：你與玩家不在同一個地方，所有內容都是你透過手機傳出的訊息。只能寫角色傳送的文字內容，可以分成多則短訊息（以換行分隔）；可以提到自己正在做什麼或看到什麼，但不得用旁白或括號描寫動作、表情、環境，不得出現「看著你」「走近」「握住」等面對面接觸，不得描寫玩家的表情或身體反應。若想見面，只能提議或約定，不可在本回合直接變成面對面。";
  const currentTurn = Math.min(20, Math.max(1, Number(episode.playerMessageCount || 0) + 1));
  const storyPhase = forceEnding
    ? "提前收尾：玩家選擇在此刻結束本篇。請根據已發生的對話，讓角色自然完成目前互動、回應本篇經歷並留下符合人設的結尾。不得責怪玩家、不得提出需要繼續回答的新問題、不得開啟新事件，也不得提及回合、系統或『提前結束』按鈕。"
    : currentTurn <= 3
    ? "開場期：接續開場事件與玩家的反應，建立當下場景和情緒，不要急著推進或結束。"
    : currentTurn <= 10
      ? "發展期：依玩家選擇自然深化互動、關係與故事契機帶來的話題，可以加入小幅事件，但不要跳過大量時間。"
      : currentTurn <= 15
        ? "轉折期：讓本篇的核心情緒或事件逐漸明朗，開始回收前面出現的細節，不再無限制增加支線。"
        : currentTurn <= 19
          ? "收束期：朝自然結局推進，不可開啟新的大型事件或懸念；逐步回收話題，讓角色表達本篇最重要的感受。"
          : "最終回覆：這是本篇最後一次角色回覆。必須完成目前場景並給出具有結束感的回應；不得提出需要玩家繼續回答的新問題，不得留下明顯懸念，也不得替玩家決定行動。";
  const systemPrompt = `你正在扮演角色「${character?.name || episode.characterName}」，進行一段獨立的特別篇。

角色設定：
${clean(character?.description || character?.personality || character?.prompt || character?.persona || "請維持角色既有個性。", 9000)}

玩家資料：
${clean(playerProfile?.name ? `姓名：${playerProfile.name}\n${playerProfile.description || playerProfile.bio || ""}` : "依對話自然稱呼玩家。", 2500)}

故事契機：${episode.item?.name || "共同經歷"}（${episode.item?.rarity || ""}）
卡片文案：${episode.item?.quote || ""}
情緒調性：${Array.isArray(episode.item?.tone) ? episode.item.tone.join("、") : "依既有故事"}
關係判斷：依本篇已發生的互動與角色／玩家設定；資訊不足時保持陌生、克制，不因卡片或稀有度自動變親密。
互動模式：${modeLabel}
${modeRules}
目前進度：${forceEnding ? `玩家在第 ${episode.playerMessageCount || 0}／20 則後選擇結束本篇` : `玩家第 ${currentTurn}／20 則訊息`}
本回合劇情階段：${storyPhase}

規則：
1. 只輸出角色此刻的回應（現實模式可含必要的簡短動作描寫；線上模式只能是訊息文字），不要解釋規則，不要輸出 JSON。
2. 嚴格維持角色人設、語氣、關係與世界觀，不要替玩家說話或決定玩家行動。
3. 嚴格遵守上方「互動模式」的規則；線上模式整篇都隔著螢幕，任何回合都不可突然變成面對面。
4. 卡片是故事契機，不預設玩家送禮。沿用已發生的開場與對話，不可中途交換贈送者、接收者、使用者或人物位置；舊故事已確定的送禮方向也必須保留。不要替玩家接受物品、佩戴物品或改變關係。不得根據卡片舊的關係欄位預設告白、同居或已認識對方家人，實際互動優先。
5. 劇情總長固定以玩家最多 20 則訊息為上限。必須依照上方「目前進度」與「劇情階段」控制節奏，不可假裝不知道回合數。
6. 回覆使用繁體中文。內容應有足夠的情緒、反應與互動細節，不要只用一兩句話草率帶過。現實模式通常約 250 至 600 個中文字、2 至 5 個自然段落；線上模式通常約 120 至 350 個中文字、1 至 5 則訊息，用角色平常傳訊的語氣與長度，不要寫成小說段落。`;
  const history = (episode.messages || []).filter((message) => message.role !== "system").slice(-30).map((message) => ({ role: message.role === "user" ? "user" : "assistant", content: clean(message.content, 4000) }));
  if (forceEnding) history.push({ role: "user", content: "（請依照目前劇情自然完成這段特別篇，這是角色的最後一則回覆。）" });
  else {
    const nextText = clean(nextUserMessage, 4000).trim();
    if (nextText) history.push({ role: "user", content: nextText });
  }
  const streamed = await streamCompatibleChat(history, apiConfig, systemPrompt, onChunk, signal);
  const raw = streamed ?? await callAI(history, { ...apiConfig, maxTokens: Math.min(1800, Number(apiConfig.maxTokens) || 1800) }, systemPrompt, {
    signal,
    feature: "chat",
    mode: episode.mode === "reality" ? "reality" : "online",
    app: "gacha",
    action: "episode_reply",
  });
  const reply = clean(raw, 5000);
  if (!reply) throw new Error("AI 沒有回傳內容，請重試");
  if (streamed == null) onChunk?.(reply);
  return reply;
}

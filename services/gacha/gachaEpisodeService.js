import { callAI } from "../aiService";

const clean = (value, limit = 6000) => String(value || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim().slice(0, limit);

async function streamCompatibleChat(messages, apiConfig, systemPrompt, onChunk) {
  const { provider, baseUrl, apiKey, model } = apiConfig;
  if (provider === "vertex" || provider === "gemini") {
    const contents = messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content || "" }] }));
    const cleanBase = String(baseUrl || "https://aiplatform.googleapis.com/v1").replace(/\/+$/, "");
    const endpoint = provider === "vertex"
      ? `${cleanBase}/publishers/google/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
      : `${cleanBase}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig: { maxOutputTokens: Math.min(1800, Number(apiConfig.maxTokens) || 1800) } }) });
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
  if (!["openai", "openrouter", "deepseek", "grok", "ollama"].includes(provider)) return null;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (provider === "openrouter") headers["HTTP-Referer"] = "https://maliphone.app";
  const usesCompletionLimit = provider === "openai" || /^o\d/i.test(String(model || "")) || /^gpt-5/i.test(String(model || ""));
  const limit = Math.min(1800, Number(apiConfig.maxTokens) || 1800);
  const response = await fetch(`${String(baseUrl || "").replace(/\/+$/, "")}/chat/completions`, {
    method: "POST", headers,
    body: JSON.stringify({ model, stream: true, messages: [{ role: "system", content: systemPrompt }, ...messages], ...(usesCompletionLimit ? { max_completion_tokens: limit } : { max_tokens: limit }) }),
  });
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

export async function generateGachaEpisodeReply({ episode, character, playerProfile, apiConfig, nextUserMessage, onChunk, forceEnding = false }) {
  if (!apiConfig?.provider || (!apiConfig.apiKey && apiConfig.provider !== "ollama")) throw new Error("請先在設定中完成 AI API 設定");
  const modeLabel = episode.mode === "reality" ? "現實見面" : "線上聊天／寄送禮物";
  const currentTurn = Math.min(20, Math.max(1, Number(episode.playerMessageCount || 0) + 1));
  const storyPhase = forceEnding
    ? "提前收尾：玩家選擇在此刻結束本篇。請根據已發生的對話，讓角色自然完成當前互動、回應這份禮物並留下符合人設的結尾。不得責怪玩家、不得提出需要繼續回答的新問題、不得開啟新事件，也不得提及回合、系統或『提前結束』按鈕。"
    : currentTurn <= 3
    ? "開場期：接住玩家的贈禮與反應，建立當下場景和情緒，不要急著推進或結束。"
    : currentTurn <= 10
      ? "發展期：依玩家選擇自然深化互動、關係與禮物帶來的話題，可以加入小幅事件，但不要跳過大量時間。"
      : currentTurn <= 15
        ? "轉折期：讓本篇的核心情緒或事件逐漸明朗，開始回收前面出現的細節，不再無限制增加支線。"
        : currentTurn <= 19
          ? "收束期：朝自然結局推進，不可開啟新的大型事件或懸念；逐步回收話題，讓角色表達本篇最重要的感受。"
          : "最終回覆：這是本篇最後一次角色回覆。必須完成當前場景並給出具有結束感的回應；不得提出需要玩家繼續回答的新問題，不得留下明顯懸念，也不得替玩家決定行動。";
  const systemPrompt = `你正在扮演角色「${character?.name || episode.characterName}」，進行一段獨立的贈禮特別篇。

角色設定：
${clean(character?.description || character?.personality || character?.prompt || character?.persona || "請維持角色既有個性。", 9000)}

玩家資料：
${clean(playerProfile?.name ? `姓名：${playerProfile.name}\n${playerProfile.description || playerProfile.bio || ""}` : "依對話自然稱呼玩家。", 2500)}

本次心意：${episode.item?.name || "禮物"}（${episode.item?.rarity || ""}）
卡片文案：${episode.item?.quote || ""}
互動模式：${modeLabel}
目前進度：${forceEnding ? `玩家在第 ${episode.playerMessageCount || 0}／20 則後選擇結束本篇` : `玩家第 ${currentTurn}／20 則訊息`}
本回合劇情階段：${storyPhase}

規則：
1. 只輸出角色此刻說的話與必要的簡短動作描寫，不要解釋規則，不要輸出 JSON。
2. 嚴格維持角色人設、語氣、關係與世界觀，不要替玩家說話或決定玩家行動。
3. 現實模式可以描寫動作、表情與環境；線上模式以訊息口吻為主，不可突然變成面對面。
4. 劇情總長固定以玩家最多 20 則訊息為上限。必須依照上方「目前進度」與「劇情階段」控制節奏，不可假裝不知道回合數。
5. 回覆使用繁體中文。內容應有足夠的情緒、反應與互動細節，通常約 250 至 600 個中文字、2 至 5 個自然段落；不要只用一兩句話草率帶過。`;
  const history = (episode.messages || []).filter((message) => message.role !== "system").slice(-30).map((message) => ({ role: message.role === "user" ? "user" : "assistant", content: clean(message.content, 4000) }));
  history.push({ role: "user", content: forceEnding ? "（請依照目前劇情自然完成這段特別篇，這是角色的最後一則回覆。）" : clean(nextUserMessage, 4000) });
  const streamed = await streamCompatibleChat(history, apiConfig, systemPrompt, onChunk);
  const raw = streamed ?? await callAI(history, { ...apiConfig, maxTokens: Math.min(1800, Number(apiConfig.maxTokens) || 1800) }, systemPrompt);
  const reply = clean(raw, 5000);
  if (!reply) throw new Error("AI 沒有回傳內容，請重試");
  if (streamed == null) onChunk?.(reply);
  return reply;
}

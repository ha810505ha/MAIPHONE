import { callAI, isAiConfigReady } from "../aiService";

const clean = (value, limit = 6000) => String(value || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim().slice(0, limit);
const MEMORY_OUTPUT_MIN_TOKENS = 3000;
const MEMORY_OUTPUT_MAX_TOKENS = 6000;

// 容錯解析：去掉 Markdown 圍欄與前後說明，只取第一個 { 到最後一個 } 之間的內容。
const parseMemoryJson = (raw) => {
  const text = clean(raw, 8000).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const candidates = [text];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed;
    } catch { /* 試下一個候選 */ }
  }
  return null;
};

const fallbackMemory = (episode) => ({
  title: clean(episode.item?.name, 20) || "特別的回憶",
  summary: `這段關於「${episode.item?.name || "共同經歷"}」的故事已告一段落。`,
  monologue: "這段經歷，留在了我們的故事裡。",
  memoryText: `我與你經歷了一段關於「${episode.item?.name || "共同經歷"}」的故事。`,
});

// 紀念卡提示詞：把完結的特別篇整理成
//   summary   對話摘要（旁白視角，印在紀念卡上）
//   monologue 角色自白（第一人稱，像寫在卡片背面的話）
//   memoryText 注入日常聊天 prompt 用的長期記憶
export async function generateSpecialMemorySummary({ episode, character, playerProfile, apiConfig }) {
  if (!isAiConfigReady(apiConfig)) return fallbackMemory(episode);
  const playerName = clean(playerProfile?.name || "玩家", 100);
  const transcript = (episode.messages || [])
    .filter((message) => ["user", "assistant", "narrator"].includes(message?.role))
    .map((message) => `${message.role === "user" ? playerName : message.role === "narrator" ? "旁白" : "角色"}：${clean(message.content, 600)}`)
    .join("\n")
    .slice(-12000);
  const systemPrompt = `任務：${playerName} 與角色「${character?.name || episode.characterName}」以「${episode.item?.name || "共同經歷"}」為契機經歷了一段故事，故事已經結束。請為這段故事製作一張紀念卡的文字內容。

角色設定（只供理解口吻，不要複述）：${clean(character?.description || character?.personality || character?.prompt || character?.persona, 2400)}

故事全文：
${transcript || "（沒有對話紀錄，請只根據卡片與角色資訊撰寫。）"}

輸出四個欄位：
1. title：4～12 字，替這段回憶取的名字。要像一句詩或一本短篇的書名，取材自故事中真實出現的意象或關鍵詞，不可只複述故事契機的名稱，不含引號與結尾標點。
2. summary：60～110 字的對話摘要，旁白視角、過去式，像故事書最後一頁的收束段。必須點出：這段故事裡實際發生的最關鍵一幕（引用具體的場景或舉動，不可泛寫）、兩人之間情感的走向。禁止條列、禁止換行。
3. monologue：40～90 字的角色自白，第一人稱「我」對「你」說，像角色偷偷寫在卡片背面的一段話。要呼應故事中 ${playerName} 說過的某句話或做過的某件事，語氣完全符合角色人設（含口癖、稱呼習慣），情感真摯但不脫離角色性格。禁止換行。
4. memoryText：60～140 字，角色第一人稱的長期記憶，之後日常聊天會參考。記下：發生了什麼、${playerName} 做了或說了什麼讓角色印象最深、這段經歷帶來的情感結果或關係變化。必須具體到之後聊天可以自然提起。

共同規則：
- 不得提及系統、回合、卡片稀有度、AI、「特別篇」這類詞。
- 不得替 ${playerName} 虛構故事中沒有出現的台詞或行動。
- 只依實際故事記錄誰贈送、接收或使用物品；不得預設玩家送禮、角色收禮，不得把天氣、場景或事件寫成實體禮物。沒有對話紀錄時不得編造具體經過或關係變化。
- 只輸出合法 JSON，前後不得有說明或 Markdown：
{"title":"…","summary":"…","monologue":"…","memoryText":"…"}`;
  // 思考型模型（Gemini 2.5／3.x）的思考 token 也算在輸出上限內，上限太低會把 JSON 截斷。
  const configured = Number(apiConfig.maxTokens) || 0;
  const maxTokens = configured > 0 ? Math.max(MEMORY_OUTPUT_MIN_TOKENS, Math.min(MEMORY_OUTPUT_MAX_TOKENS, configured)) : MEMORY_OUTPUT_MAX_TOKENS;
  const raw = await callAI([{ role: "user", content: "請依規則輸出這張紀念卡的 JSON。" }], { ...apiConfig, maxTokens }, systemPrompt, {
    app: "gacha",
    action: "special_memory_generate",
  });
  const parsed = parseMemoryJson(raw);
  if (!parsed) throw Object.assign(new Error(""), { code: "special_memory_parse_failed" });
  const fallback = fallbackMemory(episode);
  const title = clean(parsed.title, 20);
  const summary = clean(parsed.summary, 240);
  const monologue = clean(parsed.monologue, 200);
  const memoryText = clean(parsed.memoryText, 300);
  if (!summary && !monologue && !memoryText) throw Object.assign(new Error(""), { code: "special_memory_empty" });
  return {
    title: title || fallback.title,
    summary: summary || fallback.summary,
    monologue: monologue || fallback.monologue,
    memoryText: memoryText || summary || fallback.memoryText,
  };
}

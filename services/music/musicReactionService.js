import { callAI } from "../aiService";
import { isLocalProvider } from "../../constants/appConstants";

const clean = (value, limit = 2000) => String(value || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim().slice(0, limit);
const hasApi = (apiConfig) => apiConfig?.provider && (apiConfig.apiKey || isLocalProvider(apiConfig.provider) || apiConfig.provider === "ollama");
const charProfile = (character) => clean(character?.description || character?.personality || character?.prompt || character?.persona, 2000);
const decodeJsonText = (value) => String(value || "")
  .replace(/\\"/g, "\"")
  .replace(/\\n/g, " ")
  .replace(/\\\\/g, "\\")
  .trim();

function parseSongPickResponse(raw) {
  const normalized = clean(raw, 1200)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  const candidate = start >= 0 ? normalized.slice(start, end > start ? end + 1 : undefined) : normalized;
  try {
    return JSON.parse(candidate);
  } catch {
    // Some models occasionally truncate the closing quote or brace. Preserve
    // complete fields and accept an unfinished reason instead of exposing a
    // JSON parser error to the player.
    const readField = (key, allowUnclosed = false) => {
      const closed = candidate.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"])*)"` , "i"));
      if (closed) return decodeJsonText(closed[1]);
      if (!allowUnclosed) return "";
      const open = candidate.match(new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)(?:\\}\\s*$|$)`, "i"));
      return decodeJsonText(open?.[1]?.replace(/"\s*,?\s*$/, "") || "");
    };
    const title = readField("title");
    if (!title) throw new Error("角色推薦的歌曲資料不完整，請再試一次");
    return {
      title,
      artist: readField("artist"),
      reason: readField("reason", true),
      incomplete: true,
    };
  }
}

// 歌曲切換時，讓角色對正在播放的歌說一句話。
export async function generateMusicReaction({ track, character, playerProfile, apiConfig }) {
  if (!hasApi(apiConfig) || !track || !character) return null;
  const systemPrompt = `你正在扮演角色「${character.name}」，和 ${clean(playerProfile?.name || "玩家", 60)} 一起用手機聽歌。對方剛放了一首歌，請你用角色的語氣即時回應一句。

角色設定（只供理解口吻，不要複述）：${charProfile(character)}
正在播放：${clean(track.title, 200)}${track.artist ? ` — ${clean(track.artist, 100)}` : ""}

規則：
1. 只輸出角色說的一句話，20～60 字，繁體中文，像即時傳訊的口吻。
2. 可以聊歌名給你的聯想、氣氛、或跟對方的互動，但不要假裝知道歌詞內容細節。
3. 不要提到系統、AI、播放器這類詞，不要用引號包住整句。`;
  try {
    const raw = await callAI([{ role: "user", content: "（歌開始播了，說點什麼吧）" }], { ...apiConfig, maxTokens: Math.min(800, Math.max(500, Number(apiConfig.maxTokens) || 800)) }, systemPrompt);
    const text = clean(raw, 200);
    return text || null;
  } catch {
    return null;
  }
}

// 跟角色點歌：輸入非連結文字時，讓角色推薦一首歌並附一句理由。
export async function generateSongPick({ request, character, playerProfile, apiConfig }) {
  if (!hasApi(apiConfig)) throw new Error("請先在設定中完成 AI API 設定");
  const systemPrompt = `你正在扮演角色「${character?.name || "角色"}」，${clean(playerProfile?.name || "玩家", 60)} 請你點一首歌。

角色設定（只供理解口吻，不要複述）：${charProfile(character)}
對方的點歌需求：${clean(request, 300) || "（沒有特別說，依你的心情推薦）"}

請推薦一首真實存在、知名度足夠的歌（華語、日語、韓語或西洋皆可，依角色品味選擇）。
只輸出合法 JSON，前後不得有說明或 Markdown：
{"title":"歌名","artist":"演唱者","reason":"一句符合角色語氣的推薦理由，15～40 字"}`;
  const requestPick = (retry = false) => callAI(
    [{ role: "user", content: retry ? "上次輸出被截斷。請重新輸出完整且精簡的單行 JSON，務必包含完整 reason 與結尾大括號。" : "請依規則輸出點歌 JSON。" }],
    { ...apiConfig, maxTokens: Math.min(1600, Math.max(1000, Number(apiConfig.maxTokens) || 1200)) },
    systemPrompt,
  );
  let parsed = parseSongPickResponse(await requestPick(false));
  const firstReason = clean(parsed?.reason, 120);
  if (parsed?.incomplete || firstReason.length < 8) {
    parsed = parseSongPickResponse(await requestPick(true));
  }
  const title = clean(parsed?.title, 120);
  const artist = clean(parsed?.artist, 80);
  const reason = clean(parsed?.reason, 120);
  if (!title) throw new Error("角色沒點出歌，請再試一次");
  if (parsed?.incomplete || reason.length < 8) throw new Error("角色的推薦理由輸出不完整，請再試一次");
  return { title, artist, reason };
}

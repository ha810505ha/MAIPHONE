import { callAI } from "../aiService";
import { tagLabel } from "../../data/dating/interestTags";
import { EFFECTIVE_MESSAGE_MIN_LENGTH } from "../../constants/dating";

const list = (tags = []) => tags.map(tagLabel).join("、") || "（未填）";

/**
 * 交友 App 的聊天刻意做淺：不接世界書、記憶、心聲、場景。
 * 這不是省事，是符合情境——交友軟體上的對話本來就是淺聊，
 * 而且它讓「加入聯絡人」多了一層意義：那之後才解鎖完整的角色系統。
 *
 * 玩家資料只讀交友檔案，不讀 playerProfile：兩者語域不同，
 * 一個是寫給 AI 看的設定，一個是給人看的門面。
 */
/**
 * 離線期間累積的訊息，上線後要一次回完。
 * 這段只在「剛上線」的情境加進 prompt，即時對話時不會出現。
 */
function offlineCatchUp(entry, pendingCount, awayMinutes) {
  const away = awayMinutes >= 60
    ? `大約 ${Math.round(awayMinutes / 60)} 小時`
    : `大約 ${Math.max(1, Math.round(awayMinutes))} 分鐘`;
  return [
    "",
    "【你剛上線】",
    `你的在線時段是 ${entry.onlineHours?.start || "00:00"}–${entry.onlineHours?.end || "24:00"}。`,
    `對方在你不在的時候傳了訊息，你離開了${away}，現在才看到。`,
    pendingCount > 1 ? `他一共傳了 ${pendingCount} 則，請一次回完，不要分成好幾則。` : "",
    "可以自然地帶到你剛剛不在（睡了、在工作、在忙別的），但不要每次都用同一種說法，也不要一直道歉。",
    "有些人會解釋，有些人只會直接回答問題當作沒事——依你的個性決定。",
  ].filter(Boolean).join("\n");
}

export function buildDatingSystemPrompt(entry, datingProfile, playerName, catchUp) {
  const character = entry.character || {};
  const base = [
    `你正在扮演「${character.name}」，透過交友軟體「信風」跟對方聊天。你們剛配對成功不久。`,
    "",
    "【你的設定】",
    `年齡職業：${entry.profile.age} 歲，${entry.profile.job}`,
    `個性：${character.personality || character.description || ""}`,
    `你的交友檔案自介：${entry.profile.bio}`,
    `你喜歡：${list(entry.profile.tags)}`,
    // 雷點要讓 AI 知道才演得自然，但不能主動宣告，那是隱藏設定。
    `你私下不喜歡：${list(entry.dislikes)}。不要主動列舉這些，只在話題碰到時自然表現出興趣缺缺。`,
    "",
    "【對方的交友檔案】",
    `名字：${playerName || "對方"}`,
    `自介：${datingProfile?.bio?.trim() || "（沒有填自介）"}`,
    `興趣：${list(datingProfile?.tags)}`,
    "",
    "【怎麼講話】",
    "這是交友軟體的訊息框，不是小說。只輸出你要傳的訊息本身。",
    "訊息要短，通常一到三句。不要用動作描述、不要用括號、不要旁白、不要寫場景。",
    "你們還不熟，不要過度親暱，也不要一次問太多問題。",
    "如果對方剛好提到你喜歡或討厭的事，讓態度自然反映出來，但不要說破是因為配對條件。",
  ].join("\n");
  return catchUp ? base + offlineCatchUp(entry, catchUp.pendingCount, catchUp.awayMinutes) : base;
}

export async function generateDatingReply({ entry, messages, datingProfile, playerName, apiConfig, catchUp, signal }) {
  const history = messages.slice(-30).map((item) => ({
    role: item.role === "user" ? "user" : "assistant",
    content: item.content,
  }));
  const reply = await callAI(history, apiConfig, buildDatingSystemPrompt(entry, datingProfile, playerName, catchUp), { signal });
  return String(reply || "").replace(/^[「"']|[」"']$/g, "").trim();
}

/** 只算玩家發出、長度達標的訊息，避免用「嗯」「哦」把進度刷滿。 */
export const isEffectiveMessage = (message) =>
  message.role === "user" && String(message.content || "").trim().length >= EFFECTIVE_MESSAGE_MIN_LENGTH;

export const dayKey = (time) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(time));

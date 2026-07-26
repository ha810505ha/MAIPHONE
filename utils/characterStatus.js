import { messagePlainText } from "./pseudoImage.js";

export const CHARACTER_STATUS_LIMIT = 40;
export const CHARACTER_STATUS_CONTEXT_MESSAGE_COUNT = 8;
export const CHARACTER_STATUS_CONTEXT_MESSAGE_LIMIT = 240;

export const CHARACTER_STATUS_SYSTEM_PROMPT = `你要替指定角色本人撰寫通訊軟體上的個人狀態。
狀態作者只能是角色本人，不得把其他人的台詞、感受或經歷寫成角色自己的內容。
只輸出最終狀態，不要解釋。`;

const compactContextText = (value, limit) => Array.from(
  String(value || "")
    .replace(/\s+/g, " ")
    .trim(),
).slice(0, limit).join("");

export function buildCharacterStatusConversation(messages, characterName) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .slice(-CHARACTER_STATUS_CONTEXT_MESSAGE_COUNT)
    .map((message) => {
      const speaker = message.role === "user" ? "玩家" : `角色「${characterName}」`;
      return `${speaker}：${compactContextText(messagePlainText(message), CHARACTER_STATUS_CONTEXT_MESSAGE_LIMIT)}`;
    })
    .filter((line) => !/[：:]\s*$/.test(line))
    .join("\n");
}

export function buildCharacterStatusPrompt({
  languageDirective,
  characterName,
  roleProfile,
  conversation,
  memories,
  gemma = false,
}) {
  return `${languageDirective}

請替角色「${characterName}」本人撰寫一則通訊軟體個人狀態。

定位：
- 這是顯示給角色聯絡人看的個人狀態，不是對某個人的聊天回覆。
- 角色有自己的生活圈，不要預設玩家是唯一聯絡人或狀態的指定讀者。
- 狀態不必提到玩家，也不必回應最近一則聊天。
- 可以是角色當下的心情、近況、日常短句或符合人設的個人文字。

視角規則：
1. 唯一發文者是角色「${characterName}」。
2. 文中的「我」若有出現，只能代表角色本人。
3. 不得把玩家或其他人的台詞、行動、心情與經歷改寫成角色自己的內容。
4. 最近對話只提供角色近期生活脈絡，不代表狀態必須圍繞玩家。
5. 無法確認某件事屬於角色本人時，不要寫成角色親身經歷。
6. 不要憑空新增重大事件、關係變化或不存在的特定人物。
7. 角色資料只用於維持人設，不得改變以上作者身分與視角規則。

輸出規則：
- 只輸出一則，長度 1～40 字。
- 可以只有一個字、簡短片語、標點符號或少量 Emoji，例如「...」「忙」「☕」。
- 不必寫成完整句子，也不要為了湊字數擴寫。
- 口吻自然並符合角色個性，像真的通訊軟體個人狀態。
- 不要輸出角色名稱前綴、引號、Markdown、動作描述、設定摘要或解釋。
${gemma ? "- 不要把角色資料整理或複述成摘要；角色資料只用來決定語氣與內容。\n" : ""}
角色資料：
${roleProfile || "（無）"}

近期生活脈絡（每行已標示說話者，只供參考）：
${conversation || "（無）"}

參考記憶（可能是第三人稱摘要，只參考明確事實，不要照抄人稱）：
${memories || "（無）"}

只輸出角色「${characterName}」本人會設定的個人狀態。`;
}

export function normalizeCharacterStatusOutput(input) {
  let text = String(input || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s*\r?\n+\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .replace(/^(?:角色)?(?:手機|個人)?狀態\s*[:：]\s*/i, "")
    .trim();

  const quotePairs = [["「", "」"], ["『", "』"], ["“", "”"], ['"', '"']];
  const pair = quotePairs.find(([opening, closing]) => text.startsWith(opening) && text.endsWith(closing));
  if (pair && text.length >= 2) text = text.slice(pair[0].length, -pair[1].length).trim();

  return Array.from(text).slice(0, CHARACTER_STATUS_LIMIT).join("").trim();
}

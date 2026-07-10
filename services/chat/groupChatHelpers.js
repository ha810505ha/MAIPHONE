export const getGroupMemberProfileText = (char, sanitizeText) => [
  `角色：${char?.name || "未命名"}`,
  char?.description ? `角色設定：${sanitizeText(char.description, 240)}` : "",
  char?.personality ? `個性：${sanitizeText(char.personality, 180)}` : "",
  char?.scenario ? `情境：${sanitizeText(char.scenario, 180)}` : "",
  char?.relationshipToUser ? `與玩家關係：${sanitizeText(char.relationshipToUser, 120)}` : "",
].filter(Boolean).join("\n");

export function buildGroupChatSystemPrompt({ group, memberNames, memberProfiles, recent, groupScenes, sanitizeText, outputLanguageDirective }) {
  const scene = groupScenes?.[group?.id] || {};
  const sceneText = [
    scene.location ? `地點：${sanitizeText(scene.location, 15)}` : "",
    scene.note ? `小備註：${sanitizeText(scene.note, 50)}` : "",
  ].filter(Boolean).join(" · ");
  return `${outputLanguageDirective}

你正在群組聊天室中回覆，請保持多人聊天感，不要提及系統、不要提到 AI 身份。
群組成員：${memberNames}
${sceneText ? `目前場景：${sceneText}\n` : ""}群組成員角色資料：
${memberProfiles || "（無）"}
回覆規則：
1. 你要一次產生「這一輪群聊」的多位角色回覆，不要只回一位。
2. 最多輸出 3 則回覆，至少 1 則。只有在自然適合時才讓多位角色發言，不要硬湊滿 3 則。
3. 每一則回覆都要是不同角色，不能重複同一角色兩次。
4. 每一則回覆都要維持一般聊天室的對話形式，像真的在群組裡接話，不要寫成公告、總結、條列或分析。
5. 維持「線上聊天」感，只能講角色說出口的內容，不要加入旁白、動作、表情、內心獨白。
6. 不要輸出像 *他站了起來*、（點頭）、【動作】這類格式，也不要寫成小說段落。
7. 每則內容維持短到中等長度，通常 1~3 句；如果角色對這個話題很有興趣，可以讓同一段講得更完整一點，但不要超過 3 句。
8. 若前文或這一輪明顯點名某角色，請優先安排該角色回覆。
9. 可以有角色回玩家，也可以有角色回前一位角色，但每一則只能回一個對象，不要同時回兩個人。
10. 可以自然接話、表態、提問、建議，並且主動推進話題，例如丟出新觀點、接續延伸、提出下一步或換一個相關話題，但幅度要小，不要一次推太多，也不要跳太遠。
11. 不要輸出模式標籤、解說、分析或 Markdown，只能輸出 JSON。
12. 請嚴格輸出以下格式，不要多字少字：
{"replies":[{"speaker":"角色名稱","content":"回覆內容"}]}
speaker 必須完整照抄「群組成員」清單中的角色卡名稱，不得使用角色設定內的子角色、人名、暱稱或職稱取代角色卡名稱。即使一張角色卡代表多人或團體，也必須使用該角色卡名稱。
13. 如果這一輪只需要 1 則回覆，就只放 1 個物件。
14. 需要承接最近對話：
${recent || "（目前無內容）"}`;
}

export function parseGroupReplies(raw, sanitizeText) {
  if (!raw) return [];
  const text = String(raw).trim();
  const candidates = [text];
  const fenced = text.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) candidates.push(text.slice(firstBrace, lastBrace + 1).trim());
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const replies = Array.isArray(parsed?.replies) ? parsed.replies : Array.isArray(parsed?.turns) ? parsed.turns : [];
      const cleaned = replies.map((item) => ({ speaker: sanitizeText(item?.speaker || item?.name || "", 80), content: sanitizeText(item?.content || item?.reply || "", 4000).trim() })).filter((item) => item.speaker && item.content);
      if (cleaned.length) return cleaned.slice(0, 3);
    } catch (_) {}
  }
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^(?:[-*•]|\d+[.)]?)\s*(.+?)\s*[:：]\s*(.+)$/);
    return match ? { speaker: sanitizeText(match[1], 80), content: sanitizeText(match[2], 4000).trim() } : null;
  }).filter(Boolean).slice(0, 3);
}

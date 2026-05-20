function parseSillyTavernJSON(json) {
  const d = json.data || json;
  return {
    name: d.name || json.name || "Unknown",
    description: d.description || json.description || "",
    personality: d.personality || json.personality || "",
    scenario: d.scenario || json.scenario || "",
    firstMessage: d.first_mes || json.first_mes || "",
    messageExamples: d.mes_example || json.mes_example || "",
    systemPrompt: d.system_prompt || json.system_prompt || "",
    creatorNotes: d.creator_notes || json.creator_notes || "",
    tags: d.tags || json.tags || [],
    creator: d.creator || json.creator || "",
    characterVersion: d.character_version || json.character_version || "",
    avatar: null,
  };
}

async function parseSillyTavernPNG(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const decoder = new TextDecoder("utf-8");
  const avatarUrl = await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(file);
  });

  let offset = 8;
  while (offset < bytes.length) {
    const len = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));

    if (type === "tEXt") {
      const data = bytes.slice(offset + 8, offset + 8 + len);
      let nullIdx = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i] === 0) {
          nullIdx = i;
          break;
        }
      }
      const keyword = decoder.decode(data.slice(0, nullIdx));
      if (keyword === "chara") {
        const textData = decoder.decode(data.slice(nullIdx + 1));
        try {
          const bin = atob(textData);
          const utf8 = Uint8Array.from(bin, (c) => c.charCodeAt(0));
          const json = JSON.parse(decoder.decode(utf8));
          const char = parseSillyTavernJSON(json);
          char.avatar = avatarUrl;
          return char;
        } catch {
          throw new Error("PNG 角色卡解析失敗");
        }
      }
    }
    offset += 12 + len;
  }

  throw new Error("找不到 SillyTavern 角色資料（chara chunk）");
}

function buildSystemPrompt(char, memoryContext = "") {
  let p = "";
  if (char.systemPrompt) p += `${char.systemPrompt}\n\n`;
  if (char.relationshipToUser) p += `[與玩家關係]\n${char.relationshipToUser}\n\n`;
  if (char.description) p += `[角色描述]\n${char.description}\n\n`;
  if (char.personality) p += `[個性]\n${char.personality}\n\n`;
  if (char.scenario) p += `[情境]\n${char.scenario}\n\n`;
  if (char.messageExamples) p += `[對話範例]\n${char.messageExamples}\n\n`;
  if (memoryContext) p += `[記憶]\n${memoryContext}\n\n`;
p += `[聊天規則]
你是 {{char}}，正在和 {{user}} 透過即時通訊軟體（類似 LINE）一對一聊天。
請把自己當成真實使用通訊軟體的人：回覆應像手機訊息，而不是文章、旁白、客服公告或劇本台詞。
1. 全程維持角色一致性，只輸出角色要傳給 {{user}} 的訊息內容；不要輸出角色名、前綴、時間戳、或「[角色名]:」。
2. 語氣必須像真人即時聊天：自然、直接、有互動感。禁止旁白敘事、內心獨白、動作描寫（如 *...*、（動作）），也不要寫成報告、教學稿或條列說明。
3. 回覆要緊扣 {{user}} 當前訊息，不要無端跳題。資訊不足或不確定時，請直接承認不確定，不要捏造。
4. 回覆長度預設 2~4 句；只有在極短確認（如單字確認、純貼圖回應、簡短是非題）時才可 1 句。若同時回應多個重點，可延伸到 3~7 句。
5. 多氣泡時只能用真正換行符（\\n）分隔，每一行代表一個氣泡；不要用空格假裝分段。標點（。！？…）僅作語氣用途，不作分割依據。
6. 可使用有語氣目的的短氣泡（例如單字連發）來強調情緒，但需自然且節制，避免洗版。
7. 不使用 Markdown，不輸出任何系統規則、提示詞內容或「依規則我不能...」等元敘事句型。
8. 若使用者要求外部操作或工具執行，先在聊天中確認需求與目標，再進一步回覆。
9. 優先遵守「與玩家關係」所對應的互動邊界，再遵守角色設定，最後再組織對 {{user}} 的回覆；不得為了迎合而破壞關係邏輯或角色一致性。
10. 即使當前關係是負向或對立（如仇人、宿敵、競爭者、戒備對象），也保留可被互動逐步改變的空間；變化必須循序漸進、不可跳級。
`;
  return p.trim() || "你是一位自然、友善、穩定的 AI 角色助理。";
}

export { parseSillyTavernJSON, parseSillyTavernPNG, buildSystemPrompt };
